import type { PoolClient } from "pg";
import { getOperationalParkId } from "@/lib/operational-day-contract";
import { lockOperationalDay } from "@/lib/operational-day-lock";
import { isCivilDate } from "@/lib/operational-date";
import { getSchoolPaymentHold } from "@/lib/school-payment-eligibility";
import { lockOnlinePurchaseCapacity } from "@/lib/online-capacity";

type Client = Pick<PoolClient, "query">;
type Context = {
  idvoucher: number; cpf: string; idagenda: number | null; parque_operacional: string | null;
  date: string | null; dtuso: string | null; closed_at: string | null;
  periodo_id: number | null; validacao_periodo_id: number | null;
  caixa_periodo_id: number | null; payment_period_ids: number[];
};
type Period = { id: number; parque: string | null; date: string | null; closed: boolean };
export class LegacyVoucherMutationError extends Error {
  readonly status = 409;
  constructor(readonly code: string, message: string) { super(message); }
}
function fail(code: string, message: string): never { throw new LegacyVoucherMutationError(code, message); }

async function readContext(client: Client, purchaseId: number) {
  return (await client.query<Context>(`SELECT v.idvoucher,c.cpf,v.idagenda,v.parque_operacional,
    COALESCE(v.dtinicio_validade,a.dtagenda)::text AS date,v.dtuso::text,v.closed_at::text,
    v.periodo_id,v.validacao_periodo_id,c.caixa_periodo_id,
    ARRAY(SELECT cp.periodo_id FROM compra_pagamentos cp WHERE cp.idcompra=c.idcompra
      AND cp.periodo_id IS NOT NULL ORDER BY cp.periodo_id) AS payment_period_ids
    FROM voucher v JOIN compra c ON c.idcompra=v.idcompra
    LEFT JOIN agenda a ON a.idagenda=v.idagenda WHERE c.idcompra=$1 ORDER BY v.idvoucher`, [purchaseId])).rows;
}
async function readPeriods(client: Client, ids: number[]) {
  return (await client.query<Period>(`SELECT id,parque,data_operacional::text AS date,
    fechado_em IS NOT NULL OR folha_id IS NOT NULL OR EXISTS
    (SELECT 1 FROM caixa_fechamentos f WHERE f.periodo_id=caixa_periodos.id) AS closed
    FROM caixa_periodos WHERE id=ANY($1::int[]) ORDER BY id`, [ids])).rows;
}
const periodIds = (rows: Context[]) => [...new Set(rows.flatMap((r) =>
  [r.periodo_id,r.validacao_periodo_id,r.caixa_periodo_id,...r.payment_period_ids].filter((id): id is number => id != null)))].sort((a,b) => a-b);

async function readCapacityIdentity(client: Client, purchaseId: number) {
  return (await client.query<{ park: string; date: string }>(
    'SELECT parque AS park, data::text AS date FROM online_capacity_reservations WHERE idcompra=$1', [purchaseId])).rows[0] ?? null;
}

export async function lockLegacyReservationCancellation(client: Client, purchaseId: number, cpf: string) {
  const first = (await client.query<{ idvoucher: number; idagenda: number }>(`SELECT v.idvoucher,v.idagenda
    FROM voucher v JOIN compra c ON c.idcompra=v.idcompra
    WHERE c.idcompra=$1 AND c.cpf=$2 AND c.tpcompra='reser' AND c.stcompra<>'canc'
      AND v.stusado='n' ORDER BY v.idvoucher LIMIT 1`, [purchaseId,cpf])).rows[0];
  if (!first) fail("reservation_cancel_unavailable", "Esta reserva não pode mais ser cancelada.");
  return lockLegacyVoucherMutation(client, {
    voucherId: first.idvoucher, targetAgendaId: first.idagenda, purchaseId, cpf, cancellation: true,
  });
}

/** Caller owns BEGIN/COMMIT. No domain lock may be held before this function. */
export async function lockLegacyVoucherMutation(client: Client, input: {
  voucherId: number; targetAgendaId: number; purchaseId?: number; cpf?: string; mutatesPurchase?: boolean; cancellation?: boolean;
}): Promise<number> {
  const park = getOperationalParkId();
  const identity = (await client.query<{ idcompra: number; cpf: string }>(
    `SELECT c.idcompra,c.cpf FROM voucher v JOIN compra c ON c.idcompra=v.idcompra WHERE v.idvoucher=$1`, [input.voucherId])).rows[0];
  if (!identity || (input.purchaseId != null && identity.idcompra !== input.purchaseId) ||
    (input.cpf != null && identity.cpf !== input.cpf)) fail("voucher_not_found", "Ingresso não encontrado para esta compra ou conta.");
  const purchaseId = identity.idcompra;
  const before = await readContext(client, purchaseId);
  const ids = periodIds(before);
  const periods = await readPeriods(client, ids);
  const capacity = input.cancellation ? await readCapacityIdentity(client, purchaseId) : null;
  const target = (await client.query<{ date: string }>("SELECT dtagenda::text AS date FROM agenda WHERE idagenda=$1", [input.targetAgendaId])).rows[0];
  if (!target || !isCivilDate(target.date) || before.some((r) => !isCivilDate(r.date))) {
    fail("voucher_context_unavailable", "Não foi possível identificar as datas do ingresso.");
  }
  if (before.some((r) => r.parque_operacional != null && r.parque_operacional !== park) ||
    periods.some((p) => p.parque != null && p.parque !== park) || (capacity && capacity.park !== park)) fail("voucher_park_mismatch", "O ingresso pertence a outro parque.");
  if (capacity && !isCivilDate(capacity.date)) fail("voucher_context_unavailable", "Não foi possível identificar a data da reserva.");
  const dates = [...new Set([target.date,capacity?.date,...before.flatMap((r) => [r.date,r.dtuso]),...periods.map((p) => p.date)]
    .filter((date): date is string => isCivilDate(date)))].sort();
  for (const date of dates) await lockOperationalDay(client, park, date);
  const days = (await client.query<{ estado: string }>(
    "SELECT estado FROM operacao_dias WHERE parque=$1 AND data=ANY($2::date[]) ORDER BY data FOR UPDATE", [park,dates])).rows;
  if (days.some((day) => day.estado === "closed")) fail("voucher_day_closed", "O dia está finalizado. Use um ajuste explícito; o histórico não pode ser alterado.");
  const finalizedTrip = await client.query(`SELECT o.agenda_id FROM passeio_operacao o
    WHERE o.parque=$1 AND to_jsonb(o)->>'finalized_receipt_id' IS NOT NULL
      AND EXISTS(SELECT 1 FROM voucher v WHERE v.idcompra=$2 AND v.idagenda=o.agenda_id AND v.idescola=o.cliente_id)`, [park,purchaseId]);
  if (finalizedTrip.rowCount) fail("trip_finalized", "O ingresso compõe um recibo de passeio finalizado. Solicite revisão financeira antes de alterar seus dados.");
  await client.query("SELECT id FROM caixa_periodos WHERE id=ANY($1::int[]) ORDER BY id FOR UPDATE", [ids]);
  const currentPeriods = await readPeriods(client, ids);
  if (currentPeriods.some((p) => p.closed)) fail("voucher_cash_closed", "O ingresso faz parte de um caixa ou fechamento encerrado.");
  if (JSON.stringify(currentPeriods) !== JSON.stringify(periods)) fail("voucher_context_changed", "O contexto do ingresso mudou. Atualize antes de tentar novamente.");
  // Agenda before parent, matching the sales path. Recheck its date after waiting.
  const lockedTarget = (await client.query<{ date: string }>("SELECT dtagenda::text AS date FROM agenda WHERE idagenda=$1 FOR SHARE", [input.targetAgendaId])).rows[0];
  if (lockedTarget?.date !== target.date) fail("voucher_context_changed", "A data de destino mudou. Atualize antes de tentar novamente.");
  if (input.cancellation) {
    if (JSON.stringify(await readCapacityIdentity(client, purchaseId)) !== JSON.stringify(capacity)) {
      fail("voucher_context_changed", "A reserva de capacidade mudou. Atualize antes de tentar novamente.");
    }
    // Its day is already in the ordered lock set; the canonical helper owns the
    // purchase/reservation lock protocol shared with payment reconciliation.
    const lockedCapacity = await lockOnlinePurchaseCapacity(client, purchaseId);
    if ((lockedCapacity?.park ?? null) !== (capacity?.park ?? null) || (lockedCapacity?.date ?? null) !== (capacity?.date ?? null)) {
      fail("voucher_context_changed", "A reserva de capacidade mudou. Atualize antes de tentar novamente.");
    }
  }
  await client.query("SELECT idcompra FROM compra WHERE idcompra=$1 FOR UPDATE", [purchaseId]);
  await client.query("SELECT idvoucher FROM voucher WHERE idcompra=$1 ORDER BY idvoucher FOR UPDATE", [purchaseId]);
  // Separate statement gets a fresh READ COMMITTED snapshot after either lock wait.
  const current = await readContext(client, purchaseId);
  if (current.some((r) => r.closed_at || periodIds([r]).length)) {
    fail("purchase_financial_adjustment_required", "Esta compra possui operação em caixa. Use um ajuste financeiro explícito.");
  }
  if (JSON.stringify(current) !== JSON.stringify(before)) fail("voucher_context_changed", "O contexto do ingresso mudou. Atualize antes de tentar novamente.");
  if (input.cancellation) {
    if (JSON.stringify(await readCapacityIdentity(client, purchaseId)) !== JSON.stringify(capacity)) {
      fail("voucher_context_changed", "A reserva de capacidade mudou. Atualize antes de tentar novamente.");
    }
    const eligible = (await client.query<{ eligible: boolean }>(`SELECT (
      cpf=$2 AND tpcompra='reser' AND stcompra='pend' AND dtpagamento IS NULL
      AND caixa_periodo_id IS NULL
      AND NOT EXISTS (SELECT 1 FROM compra_pagamentos WHERE idcompra=$1)
      AND NOT EXISTS (SELECT 1 FROM voucher WHERE idcompra=$1 AND stusado='s')
    ) AS eligible FROM compra WHERE idcompra=$1`, [purchaseId,input.cpf])).rows[0];
    if (!eligible?.eligible) fail("reservation_cancel_unavailable", "Esta reserva possui recebimento ou uso, ou não está mais disponível para cancelamento.");
    return purchaseId;
  }
  const restrictions = (await client.query<{ blocked: boolean }>(`SELECT (
    EXISTS (SELECT 1 FROM online_capacity_reservations WHERE idcompra=$1)
    OR EXISTS (SELECT 1 FROM voucher WHERE idcompra=$1 AND ($3::boolean OR idvoucher=$2) AND
      (dtinicio_validade IS NOT NULL OR stusado IN ('s','inv')))
    ) AS blocked`, [purchaseId,input.voucherId,input.mutatesPurchase === true])).rows[0];
  if (restrictions?.blocked) fail("voucher_operational_change_required", "Esta compra exige alteração operacional explícita; o editor legado não pode reagendá-la.");
  const hold = await getSchoolPaymentHold(client, purchaseId);
  if (hold && hold.status !== "released") fail("school_payment_held", "O ingresso está retido para análise do atendimento.");
  return purchaseId;
}
