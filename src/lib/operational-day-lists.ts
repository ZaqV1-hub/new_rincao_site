import type { PoolClient } from "pg";
import { isCivilDate } from "@/lib/operational-date";
import { getOperationalParkId } from "@/lib/operational-day-contract";
import { getOperationalCatalogPool } from "@/lib/painel-operational-catalog";

export type DayPurchaseRow = { purchaseId: number; buyerName: string; status: string; channel: string; itemCount: number; dateAmountCents: number };
export type DayGroupRow = { agendaId: number; clientId: number; clientName: string; agendaType: string; status: string; paidOnlinePeople: number };
export type DayListKind = "purchases" | "groups";
export type OperationalDayList = { date: string; page: number; pageSize: 20; total: number; pageCount: number } & (
  { kind: "purchases"; items: DayPurchaseRow[] } | { kind: "groups"; items: DayGroupRow[] }
);
export class OperationalDayListError extends Error {
  constructor(readonly code: "invalid_input" | "invalid_data", message: string) { super(message); }
}
function integer(value: unknown) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) throw new OperationalDayListError("invalid_data", "Os valores da lista precisam de conferência.");
  return number;
}

export async function readOperationalDayList(client: Pick<PoolClient, "query">, date: string, kind: DayListKind, page: number): Promise<OperationalDayList> {
  if (!isCivilDate(date) || !["purchases", "groups"].includes(kind) || !Number.isSafeInteger(page) || page < 1 || page > 1000000) {
    throw new OperationalDayListError("invalid_input", "Informe uma data, lista e página válidas.");
  }
  const park = getOperationalParkId();
  const matching = kind === "purchases" ? `
    SELECT c.idcompra AS "purchaseId", COALESCE(NULLIF(TRIM(c.checkout_buyer_name),''),NULLIF(TRIM(u.nmusuario),''),'Comprador não identificado') AS "buyerName",
      COALESCE(c.stcompra,'') AS status, COALESCE(c.tpcompra,'') AS channel,
      COUNT(*)::text AS "itemCount", SUM(v.vlunicompra*100)::text AS "dateAmountCents",
      COUNT(*) FILTER (WHERE v.vlunicompra IS NULL OR v.vlunicompra<0 OR v.vlunicompra*100<>TRUNC(v.vlunicompra*100))::text AS invalid
    FROM voucher v JOIN compra c ON c.idcompra=v.idcompra JOIN agenda a ON a.idagenda=v.idagenda
    LEFT JOIN usuario u ON u.cpf=c.cpf
    WHERE COALESCE(v.dtinicio_validade,a.dtagenda)=$1::date AND (v.parque_operacional IS NULL OR v.parque_operacional=$2)
    GROUP BY c.idcompra,u.nmusuario,c.checkout_buyer_name,c.stcompra,c.tpcompra
  ` : `
    SELECT ae.idagenda AS "agendaId", ae.idcliente AS "clientId", COALESCE(c.nome,'Cliente não identificado') AS "clientName",
      COALESCE(a.tpagenda,'') AS "agendaType", COALESCE(ae.stagenda_cli,'abe') AS status,
      (SELECT COUNT(*)::text FROM voucher v JOIN compra cp ON cp.idcompra=v.idcompra
       WHERE v.idagenda=ae.idagenda AND v.idescola=ae.idcliente AND cp.stcompra='conc' AND cp.tpcompra='ponli'
         AND v.tpvoucher IN ('escol','norma','infan','isent','corte') AND v.servico_id IS NULL AND v.stusado IS DISTINCT FROM 'inv'
         AND (v.parque_operacional IS NULL OR v.parque_operacional=$2)) AS "paidOnlinePeople"
    FROM agenda_extras ae JOIN agenda a ON a.idagenda=ae.idagenda LEFT JOIN clientes c ON c.idcliente=ae.idcliente
    WHERE a.dtagenda=$1::date
  `;
  const order = kind === "purchases" ? '"purchaseId" DESC' : '"agendaId", "clientId"';
  const { rows: [result] } = await client.query<{ total: string; items: Record<string, unknown>[] }>(`
    WITH matching AS (${matching}), paged AS (SELECT * FROM matching ORDER BY ${order} LIMIT 20 OFFSET $3)
    SELECT (SELECT COUNT(*)::text FROM matching) AS total,
      COALESCE((SELECT jsonb_agg(paged ORDER BY ${order}) FROM paged),'[]'::jsonb) AS items
  `, [date, park, (page - 1) * 20]);
  const total = integer(result.total);
  const pagination = { date, page, pageSize: 20 as const, total, pageCount: Math.max(1, Math.ceil(total / 20)) };
  if (kind === "purchases") {
    return { ...pagination, kind, items: result.items.map((row) => {
      if (integer(row.invalid) > 0) throw new OperationalDayListError("invalid_data", "Há itens com valores ausentes ou inválidos nesta data.");
      return { purchaseId: integer(row.purchaseId), buyerName: String(row.buyerName), status: String(row.status), channel: String(row.channel),
        itemCount: integer(row.itemCount), dateAmountCents: integer(row.dateAmountCents) };
    }) };
  }
  return { ...pagination, kind, items: result.items.map((row) => ({ agendaId: integer(row.agendaId), clientId: integer(row.clientId),
    clientName: String(row.clientName), agendaType: String(row.agendaType), status: String(row.status), paidOnlinePeople: integer(row.paidOnlinePeople) })) };
}

export async function getOperationalDayList(date: string, kind: DayListKind, page = 1) {
  return readOperationalDayList(getOperationalCatalogPool(), date, kind, page);
}
