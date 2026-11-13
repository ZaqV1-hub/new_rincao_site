import type { PoolClient } from "pg";
import { registerOpsAuditLog } from "@/lib/ops-audit-log";
import type { QueryClient, GatewayPurchaseStatus } from "@/lib/payment-reconciliation-contract";
import { lockOperationalDay } from "@/lib/operational-day-lock";
import { getOperationalParkId, type OperationalParkId } from "@/lib/operational-day-contract";
import type { OperationalValidity } from "@/lib/operational-date";

export class OnlineCapacityError extends Error {
  readonly status = 409;
  constructor(readonly code: string, message = code) { super(message); }
}
export type OnlineCapacityDay = {
  park: OperationalParkId;
  date: string;
  agendaId: number;
  priceTableId: number;
  validity: OperationalValidity;
  ticketTypes: string[];
  onlineLimit: number | null;
  closed: boolean;
};
type CapacityContext = {
  park: OperationalParkId;
  date: string;
  quantity: number;
  status: string;
  active: boolean;
  unexpired: boolean;
  deliveryHold: boolean;
};
const eligible = `NOT reservation.delivery_hold AND (compra.stcompra = 'conc' OR
  (compra.stcompra = 'pend' AND (reservation.expires_at > NOW() OR reservation.attempt_started_at IS NOT NULL)))`;

export async function getOnlineCapacityOccupied(client: QueryClient, park: OperationalParkId, date: string, excludePurchaseId: number | null = null) {
  const result = await client.query<{ occupied: string }>(`SELECT COALESCE(SUM(reservation.quantidade),0)::text AS occupied
    FROM online_capacity_reservations reservation JOIN compra USING (idcompra)
    WHERE reservation.parque=$1 AND reservation.data=$2::date AND ($3::bigint IS NULL OR reservation.idcompra<>$3) AND ${eligible}`,
  [park, date, excludePurchaseId]);
  return Number(result.rows[0]?.occupied ?? 0);
}

export async function assertOnlineCapacityAvailable(client: QueryClient, day: Pick<OnlineCapacityDay, "park" | "date" | "onlineLimit">, quantity: number, excludePurchaseId: number | null = null) {
  if (!Number.isSafeInteger(quantity) || quantity <= 0) throw new OnlineCapacityError("invalid_purchase");
  if (day.onlineLimit !== null && await getOnlineCapacityOccupied(client, day.park, day.date, excludePurchaseId) + quantity > day.onlineLimit) {
    throw new OnlineCapacityError("online_capacity_exceeded", "Não há vagas online suficientes para esta data.");
  }
}

export async function lockOnlineCapacityDay(client: QueryClient, agendaId: number): Promise<OnlineCapacityDay | null> {
  const initial = await client.query<{ date: string }>("SELECT dtagenda::text AS date FROM agenda WHERE idagenda=$1", [agendaId]);
  if (!initial.rows[0]) return null;
  const park = getOperationalParkId();
  const date = initial.rows[0].date;
  await lockOperationalDay(client, park, date);
  const result = await client.query<OnlineCapacityDay>(`SELECT parque AS park, data::text AS date,
    day_use_agenda_id AS "agendaId", tabela_preco_id AS "priceTableId", validade AS validity, tipos_ingresso AS "ticketTypes",
    limite_online AS "onlineLimit", estado='closed' AS closed FROM operacao_dias
    WHERE parque=$1 AND data=$2::date FOR UPDATE`, [park, date]);
  const day = result.rows[0];
  if (!day) return null;
  if (day.closed || day.agendaId !== agendaId) throw new OnlineCapacityError("agenda_unavailable", "Esta data não está disponível para compra online.");
  return day;
}

export async function validateOnlineCapacitySelection(client: QueryClient, day: OnlineCapacityDay | null, types: { type: string; quantity: number }[]) {
  if (!day) return;
  if (types.some(({ type, quantity }) => quantity > 0 && !day.ticketTypes.includes(type))) {
    throw new OnlineCapacityError("ticket_type_unavailable", "Um dos tipos de ingresso não está disponível nesta data.");
  }
  const quantity = types.reduce((total, line) => total + line.quantity, 0);
  await assertOnlineCapacityAvailable(client, day, quantity);
}

export async function reserveOnlineCapacity(client: QueryClient, day: OnlineCapacityDay | null, purchaseId: number, quantity: number) {
  if (!day) return;
  await client.query(`INSERT INTO online_capacity_reservations (idcompra,parque,data,quantidade,expires_at)
    VALUES ($1,$2,$3::date,$4,NOW()+INTERVAL '12 hours')`, [purchaseId, day.park, day.date, quantity]);
}

// Discover the day before parent locks; a concurrent reschedule requires a fresh transaction.
export async function lockOnlinePurchaseCapacity(client: QueryClient, purchaseId: number): Promise<CapacityContext | null> {
  const identity = await client.query<{ park: OperationalParkId; date: string }>(
    'SELECT parque AS park, data::text AS date FROM online_capacity_reservations WHERE idcompra=$1', [purchaseId]);
  if (!identity.rows[0]) return null;
  await lockOperationalDay(client, identity.rows[0].park, identity.rows[0].date);
  const result = await client.query<CapacityContext>(`SELECT reservation.parque AS park, reservation.data::text AS date,
    reservation.quantidade AS quantity, compra.stcompra AS status, reservation.delivery_hold AS "deliveryHold",
    reservation.expires_at > NOW() AS unexpired, (${eligible}) AS active
    FROM online_capacity_reservations reservation JOIN compra USING (idcompra)
    WHERE reservation.idcompra=$1 FOR UPDATE OF compra, reservation`, [purchaseId]);
  const context = result.rows[0];
  if (!context || context.park !== identity.rows[0].park || context.date !== identity.rows[0].date) {
    throw new OnlineCapacityError("online_capacity_context_changed", "A data da compra mudou. Confira os dados antes de tentar novamente.");
  }
  return context;
}

export async function assertOnlineCapacityReleased(client: QueryClient, purchaseId: number) {
  const result = await client.query<{ deliveryHold: boolean }>(
    'SELECT delivery_hold AS "deliveryHold" FROM online_capacity_reservations WHERE idcompra=$1', [purchaseId]);
  if (result.rows[0]?.deliveryHold) throw new OnlineCapacityError("online_capacity_delivery_hold");
}

async function reacquire(client: QueryClient, purchaseId: number, context: CapacityContext) {
  const day = await client.query<{ onlineLimit: number | null }>('SELECT limite_online AS "onlineLimit" FROM operacao_dias WHERE parque=$1 AND data=$2::date', [context.park, context.date]);
  if (!day.rows[0]) throw new OnlineCapacityError("online_capacity_configuration_missing");
  await assertOnlineCapacityAvailable(client, { ...context, onlineLimit: day.rows[0].onlineLimit }, context.quantity, purchaseId);
}

// This transaction must commit before any gateway HTTP request; no day lock spans HTTP.
export async function beginOnlinePaymentAttempt(client: QueryClient, purchaseId: number) {
  try {
    await client.query("BEGIN");
    const context = await lockOnlinePurchaseCapacity(client, purchaseId);
    if (context) {
      if (!context.unexpired) throw new OnlineCapacityError("online_capacity_expired", "O prazo de 12 horas para continuar o pagamento terminou.");
      if (!["pend", "canc"].includes(context.status)) throw new OnlineCapacityError("checkout_unavailable");
      if (context.deliveryHold) throw new OnlineCapacityError("online_capacity_delivery_hold");
      if (!context.active) await reacquire(client, purchaseId, context);
      await client.query("UPDATE compra SET stcompra='pend' WHERE idcompra=$1", [purchaseId]);
      await client.query("UPDATE online_capacity_reservations SET attempt_started_at = COALESCE(attempt_started_at,NOW()) WHERE idcompra=$1", [purchaseId]);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

export async function reconcileOnlineCapacity(client: QueryClient, purchaseId: number, status: GatewayPurchaseStatus, context: CapacityContext | null) {
  if (!context) return false;
  if (status !== "conc" && status !== "pend") return context.deliveryHold;
  if (context.deliveryHold) return true;
  let holdReason: string | null = null;
  if (!context.active) {
    try { await reacquire(client, purchaseId, context); }
    catch (error) {
      if (!(error instanceof OnlineCapacityError)) throw error;
      holdReason = error.code;
    }
  }
  await client.query(`UPDATE online_capacity_reservations SET attempt_started_at=COALESCE(attempt_started_at,NOW()),
    delivery_hold=$2, hold_reason=$3 WHERE idcompra=$1`, [purchaseId, holdReason !== null, holdReason]);
  if (holdReason) await registerOpsAuditLog(client as PoolClient, {
    origem: "online-capacity", acao: "delivery_hold", compraId: purchaseId,
    descricao: "Pagamento registrado; entrega retida por falta de capacidade online.",
    motivo: holdReason, detalhes: { park: context.park, date: context.date, quantity: context.quantity, status },
  }, "postgres");
  return holdReason !== null;
}
