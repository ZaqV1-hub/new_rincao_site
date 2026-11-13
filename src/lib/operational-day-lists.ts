import type { PoolClient } from "pg";
import { isCivilDate } from "@/lib/operational-date";
import { getOperationalParkId } from "@/lib/operational-day-contract";
import { getOperationalCatalogPool } from "@/lib/painel-operational-catalog";

export type DayPurchaseRow = { purchaseId: number; buyerName: string; status: string; channel: string; itemCount: number; dateAmountCents: number; batchSelectable?: boolean };
export type DayGroupRow = { agendaId: number; clientId: number; clientName: string; agendaType: string; status: string; paidOnlinePeople: number };
export type DayPurchaseFilters = {
  origin: "all" | "site" | "gate";
  type: "all" | "dayuse" | "group";
  query: string;
};
export type DayPurchaseCounters = {
  origin: { all: number; site: number; gate: number };
  type: { all: number; dayuse: number; group: number };
};
export const DEFAULT_DAY_PURCHASE_FILTERS: Readonly<DayPurchaseFilters> = Object.freeze({ origin: "all", type: "all", query: "" });
export type DayListKind = "purchases" | "groups";
export type OperationalDayList = { date: string; page: number; pageSize: 20; total: number; pageCount: number } & (
  { kind: "purchases"; items: DayPurchaseRow[]; filters: DayPurchaseFilters; counters: DayPurchaseCounters } | { kind: "groups"; items: DayGroupRow[] }
);
export class OperationalDayListError extends Error {
  constructor(readonly code: "invalid_input" | "invalid_data", message: string) { super(message); }
}
function integer(value: unknown) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) throw new OperationalDayListError("invalid_data", "Os valores da lista precisam de conferência.");
  return number;
}

export function normalizeDayPurchaseFilters(input: unknown = undefined): DayPurchaseFilters {
  if (input === undefined) return { ...DEFAULT_DAY_PURCHASE_FILTERS };
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new OperationalDayListError("invalid_input", "Informe filtros de compra válidos.");
  }
  const fields = input as Record<string, unknown>;
  const origin = fields.origin === undefined ? "all" : fields.origin;
  const type = fields.type === undefined ? "all" : fields.type;
  const query = fields.query === undefined ? "" : fields.query;
  if (Object.keys(fields).some(key => !["origin", "type", "query"].includes(key)) ||
      typeof origin !== "string" || !["all", "site", "gate"].includes(origin) ||
      typeof type !== "string" || !["all", "dayuse", "group"].includes(type) ||
      typeof query !== "string" || query.length > 120) {
    throw new OperationalDayListError("invalid_input", "Informe origem, tipo e busca de até 120 caracteres válidos.");
  }
  return { origin: origin as DayPurchaseFilters["origin"], type: type as DayPurchaseFilters["type"], query: query.trim() };
}

type ListResult = { total: string; items: Record<string, unknown>[] };
function pagination(date: string, page: number, value: unknown) {
  const total = integer(value);
  return { date, page, pageSize: 20 as const, total, pageCount: Math.max(1, Math.ceil(total / 20)) };
}

async function readPurchases(client: Pick<PoolClient, "query">, date: string, page: number, filters: DayPurchaseFilters): Promise<OperationalDayList> {
  const originMatches = "($4='all' OR ($4='site' AND channel='ponli') OR ($4='gate' AND channel IN ('bilhe','reser')))";
  const typeMatches = "($5='all' OR ($5='dayuse' AND dayuse) OR ($5='group' AND group_items))";
  const escapedQuery = filters.query.replace(/[!%_]/g, "!$&");
  const purchaseNumber = /^\d+$/.test(filters.query) ? filters.query.replace(/^0+(?=\d)/, "") : "";
  const cpfDigits = /^[\d.\-\s]+$/.test(filters.query) ? filters.query.replace(/\D/g, "") : "";
  const { rows: [result] } = await client.query<ListResult & { counters: DayPurchaseCounters }>(`
    WITH date_items AS (
      SELECT c.idcompra AS "purchaseId",
        COALESCE(NULLIF(TRIM(c.checkout_buyer_name),''),NULLIF(TRIM(u.nmusuario),''),'Comprador não identificado') AS "buyerName",
        COALESCE(u.nmusuario,'') AS registered_name, COALESCE(c.cpf,'') AS cpf,
        COALESCE(c.stcompra,'') AS status, COALESCE(c.tpcompra,'') AS channel, v.vlunicompra AS amount,
        CASE
          WHEN v.servico_id IS NOT NULL OR v.tpvoucher='espec' THEN 'other'
          WHEN v.idescola IS NOT NULL OR v.tpvoucher='escol'
            OR a.tpagenda IN ('escol','igrej','casam','melho','confr','ongs','grmix') THEN 'group'
          WHEN v.tpvoucher IN ('norma','infan','isent','corte') AND a.tpagenda IN ('padra','promo')
            AND NOT EXISTS (SELECT 1 FROM agenda_extras ae WHERE ae.idagenda=a.idagenda) THEN 'dayuse'
          ELSE 'other'
        END AS item_type
      FROM voucher v JOIN compra c ON c.idcompra=v.idcompra JOIN agenda a ON a.idagenda=v.idagenda
      LEFT JOIN usuario u ON u.cpf=c.cpf
      WHERE COALESCE(v.dtinicio_validade,a.dtagenda)=$1::date AND (v.parque_operacional IS NULL OR v.parque_operacional=$2)
    ), purchases AS (
      SELECT "purchaseId", "buyerName", registered_name, cpf, status, channel,
        COUNT(*)::text AS "itemCount", SUM(amount*100)::text AS "dateAmountCents",
        COUNT(*) FILTER (WHERE amount IS NULL OR amount<0 OR amount*100<>TRUNC(amount*100))::text AS invalid,
        BOOL_OR(item_type='dayuse') AS dayuse, BOOL_OR(item_type='group') AS group_items
      FROM date_items GROUP BY "purchaseId", "buyerName", registered_name, cpf, status, channel
    ), searched AS (
      SELECT * FROM purchases
      WHERE $6='%%' OR "buyerName" ILIKE $6 ESCAPE '!' OR registered_name ILIKE $6 ESCAPE '!'
        OR "purchaseId"::text=$7
        OR ($8<>'' AND POSITION($8 IN regexp_replace(cpf,'[^0-9]','','g'))>0)
    ), matching AS (
      SELECT * FROM searched WHERE ${originMatches} AND ${typeMatches}
    ), paged AS (
      SELECT "purchaseId", "buyerName", status, channel, "itemCount", "dateAmountCents", invalid, (dayuse AND NOT group_items) AS "batchSelectable"
      FROM matching ORDER BY "purchaseId" DESC LIMIT 20 OFFSET $3
    ), counters AS (
      SELECT jsonb_build_object(
        'origin', jsonb_build_object(
          'all', (COUNT(*) FILTER (WHERE ${typeMatches}))::text,
          'site', (COUNT(*) FILTER (WHERE ${typeMatches} AND channel='ponli'))::text,
          'gate', (COUNT(*) FILTER (WHERE ${typeMatches} AND channel IN ('bilhe','reser')))::text),
        'type', jsonb_build_object(
          'all', (COUNT(*) FILTER (WHERE ${originMatches}))::text,
          'dayuse', (COUNT(*) FILTER (WHERE ${originMatches} AND dayuse))::text,
          'group', (COUNT(*) FILTER (WHERE ${originMatches} AND group_items))::text)
      ) AS value FROM searched
    )
    SELECT (SELECT COUNT(*)::text FROM matching) AS total,
      COALESCE((SELECT jsonb_agg(paged ORDER BY "purchaseId" DESC) FROM paged),'[]'::jsonb) AS items,
      (SELECT value FROM counters) AS counters
  `, [date, getOperationalParkId(), (page - 1) * 20, filters.origin, filters.type, `%${escapedQuery}%`, purchaseNumber, cpfDigits]);
  return {
    ...pagination(date, page, result.total), kind: "purchases", filters,
    counters: {
      origin: { all: integer(result.counters.origin.all), site: integer(result.counters.origin.site), gate: integer(result.counters.origin.gate) },
      type: { all: integer(result.counters.type.all), dayuse: integer(result.counters.type.dayuse), group: integer(result.counters.type.group) },
    },
    items: result.items.map(row => {
      if (integer(row.invalid) > 0) throw new OperationalDayListError("invalid_data", "Há itens com valores ausentes ou inválidos nesta data.");
      return { purchaseId: integer(row.purchaseId), buyerName: String(row.buyerName), status: String(row.status), channel: String(row.channel),
        itemCount: integer(row.itemCount), dateAmountCents: integer(row.dateAmountCents), batchSelectable: row.batchSelectable === true };
    }),
  };
}

export async function readOperationalDayList(client: Pick<PoolClient, "query">, date: string, kind: DayListKind, page: number, filters?: Partial<DayPurchaseFilters>): Promise<OperationalDayList> {
  if (!isCivilDate(date) || !["purchases", "groups"].includes(kind) || !Number.isSafeInteger(page) || page < 1 || page > 1000000 || (kind === "groups" && filters !== undefined)) {
    throw new OperationalDayListError("invalid_input", "Informe uma data, lista e página válidas.");
  }
  if (kind === "purchases") return readPurchases(client, date, page, normalizeDayPurchaseFilters(filters));
  const matching = `
    SELECT ae.idagenda AS "agendaId", ae.idcliente AS "clientId", COALESCE(c.nome,'Cliente não identificado') AS "clientName",
      COALESCE(a.tpagenda,'') AS "agendaType", COALESCE(ae.stagenda_cli,'abe') AS status,
      (SELECT COUNT(*)::text FROM voucher v JOIN compra cp ON cp.idcompra=v.idcompra
       WHERE v.idagenda=ae.idagenda AND v.idescola=ae.idcliente AND cp.stcompra='conc' AND cp.tpcompra='ponli'
         AND v.tpvoucher IN ('escol','norma','infan','isent','corte') AND v.servico_id IS NULL AND v.stusado IS DISTINCT FROM 'inv'
         AND (v.parque_operacional IS NULL OR v.parque_operacional=$2)) AS "paidOnlinePeople"
    FROM agenda_extras ae JOIN agenda a ON a.idagenda=ae.idagenda LEFT JOIN clientes c ON c.idcliente=ae.idcliente
    WHERE a.dtagenda=$1::date
  `;
  const { rows: [result] } = await client.query<ListResult>(`
    WITH matching AS (${matching}), paged AS (SELECT * FROM matching ORDER BY "agendaId", "clientId" LIMIT 20 OFFSET $3)
    SELECT (SELECT COUNT(*)::text FROM matching) AS total,
      COALESCE((SELECT jsonb_agg(paged ORDER BY "agendaId", "clientId") FROM paged),'[]'::jsonb) AS items
  `, [date, getOperationalParkId(), (page - 1) * 20]);
  return { ...pagination(date, page, result.total), kind, items: result.items.map(row => ({ agendaId: integer(row.agendaId), clientId: integer(row.clientId),
    clientName: String(row.clientName), agendaType: String(row.agendaType), status: String(row.status), paidOnlinePeople: integer(row.paidOnlinePeople) })) };
}

export async function getOperationalDayList(date: string, kind: DayListKind, page = 1, filters?: Partial<DayPurchaseFilters>) {
  return readOperationalDayList(getOperationalCatalogPool(), date, kind, page, filters);
}
