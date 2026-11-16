import type { PoolClient } from "pg";
import { DAY_SALES_SQL, DAY_COUNTS_SQL, DAY_FINANCIAL_SQL } from "./operational-day-summary-sql";
import { getOperationalCatalogPool } from "./painel-operational-catalog";
import { getOperationalParkId, type OperationalParkId } from "./operational-day-contract";
import { getSaoPauloToday, isCivilDate } from "./operational-date";
import type { OperationalDaySummary } from "./operational-day-summary";

export type OperationalCalendarDay = {
  date: string; plannedPeople: number | null; groupCount: number | null; vehicleCount: number;
  counting: boolean; revenueCents: number | null; closed: boolean; closurePending: boolean;
};
type CalendarRow = {
  date: string; closed: boolean; frozen: OperationalDaySummary | null; scheduled: boolean;
  sales: Record<string, string> | null; metadata: Record<string, string> | null; financial: Record<string, string> | null;
  vehicleCount: string; counting: boolean;
};
const forDate = (sql: string) => sql.replaceAll("$1", "dates.day").replaceAll("$2", "$3");
// One bounded month query, sharing the daily revenue classification and frozen receipts.
export const OPERATIONAL_CALENDAR_SQL = `WITH dates AS (SELECT d::date AS day FROM generate_series($1::date,$2::date,interval '1 day') d)
 SELECT dates.day::text AS date,COALESCE(d.estado='closed',false) AS closed,f.snapshot->'summary' AS frozen,
 CASE WHEN d.estado IS DISTINCT FROM 'closed' THEN (SELECT row_to_json(s) FROM (${forDate(DAY_SALES_SQL)}) s) END AS sales,
 CASE WHEN d.estado IS DISTINCT FROM 'closed' THEN (SELECT row_to_json(m) FROM (${forDate(DAY_COUNTS_SQL)}) m) END AS metadata,
 CASE WHEN d.estado IS DISTINCT FROM 'closed' THEN (SELECT row_to_json(x) FROM (${forDate(DAY_FINANCIAL_SQL)}) x) END AS financial,
 EXISTS(SELECT 1 FROM agenda a WHERE a.dtagenda=dates.day AND a.tpagenda IN ('padra','promo') AND a.stagenda IN ('abe','lot')) AS scheduled,
 (SELECT COUNT(*)::text FROM passeio_veiculos v JOIN agenda a ON a.idagenda=v.agenda_id WHERE v.parque=$3 AND a.dtagenda=dates.day) AS "vehicleCount",
 EXISTS(SELECT 1 FROM passeio_veiculos v JOIN agenda a ON a.idagenda=v.agenda_id WHERE v.parque=$3 AND a.dtagenda=dates.day AND v.estado='counting') AS counting
 FROM dates LEFT JOIN operacao_dias d ON d.parque=$3 AND d.data=dates.day
 LEFT JOIN operacao_fechamentos f ON d.estado='closed' AND f.id=d.fechamento_id AND f.parque=d.parque AND f.data=d.data ORDER BY dates.day`;
function count(value: unknown): number {
  const result = Number(value);
  if (value === null || value === undefined || !Number.isSafeInteger(result) || result < 0) throw new Error("Indicadores da agenda precisam de conferência.");
  return result;
}
export function mapOperationalCalendarDay(row: CalendarRow, park: OperationalParkId, today: string): OperationalCalendarDay {
  const result: OperationalCalendarDay = { date: row.date, plannedPeople: null, groupCount: null, vehicleCount: count(row.vehicleCount), counting: !row.closed && row.counting, revenueCents: null, closed: row.closed, closurePending: false };
  if (row.closed) {
    if (!row.frozen) return result;
    if (row.frozen.date !== row.date || row.frozen.park !== park) throw new Error("Revisão de outra data ou parque.");
    const { forecast, revenue } = row.frozen;
    result.groupCount = count(row.frozen.groupCount);
    result.plannedPeople = forecast.ticketsForSelectedDate.status === "available" && forecast.plannedGroupPeople.status === "available" ? count(forecast.ticketsForSelectedDate.value + forecast.plannedGroupPeople.value) : null;
    result.revenueCents = revenue.totalCents.status === "available" ? count(revenue.totalCents.value) : null;
    return result;
  }
  const s = row.sales!, m = row.metadata!, f = row.financial!;
  result.groupCount = count(m.groupCount);
  result.plannedPeople = count(m.missingPlans) ? null : count(count(s.tickets) + count(m.plannedPeople));
  if (!count(s.invalidAmounts) && !count(s.unclassifiedCount) && !count(f.invalidReceipts)) result.revenueCents = count(count(s.site) + count(s.gate) + count(s.services) + count(f.revenue));
  result.closurePending = row.date <= today && (row.scheduled || result.groupCount > 0 || count(m.cashCount) > 0 || count(s.tickets) > 0 || count(s.admitted) > 0 || (result.revenueCents ?? 0) > 0);
  return result;
}
export async function getOperationalCalendar(startDate: string, endDate: string, client: Pick<PoolClient, "query"> = getOperationalCatalogPool()) {
  if (!isCivilDate(startDate) || !isCivilDate(endDate) || endDate < startDate || Date.parse(endDate) - Date.parse(startDate) > 30 * 86400000) throw new Error("Consulte até 31 datas da agenda.");
  const park = getOperationalParkId(), today = getSaoPauloToday();
  const result = await client.query<CalendarRow>(OPERATIONAL_CALENDAR_SQL, [startDate, endDate, park]);
  return result.rows.map(row => mapOperationalCalendarDay(row, park, today));
}
