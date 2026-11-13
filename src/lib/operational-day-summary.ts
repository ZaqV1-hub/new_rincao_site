import type { PoolClient } from "pg";
import { getOperationalDay, OperationalDayError, type OperationalDay } from "@/lib/operational-day";
import { getOperationalParkId, type OperationalParkId } from "@/lib/operational-day-contract";
import { isCivilDate } from "@/lib/operational-date";
import { getOperationalCatalogPool } from "@/lib/painel-operational-catalog";

type QueryClient = Pick<PoolClient, "query">;
export type UnavailableSummarySource = { status: "unavailable"; value: null; source: string; reason: string };
export type SummarySourceValue<T> = { status: "available"; value: T; source: string } | UnavailableSummarySource;
export type OperationalDaySummary = {
  park: OperationalParkId;
  date: string;
  generatedAt: string;
  configuration: OperationalDay | null;
  configurationRevision: number | null;
  navigation: { previousDate: string | null; nextDate: string | null };
  revenue: {
    basis: "selected_visit_date";
    siteNetCents: SummarySourceValue<number>;
    gateNetCents: SummarySourceValue<number>;
    servicesNetCents: SummarySourceValue<number>;
    unclassifiedNetCents: SummarySourceValue<number>;
    knownSubtotalCents: number;
    totalCents: SummarySourceValue<number>;
    finalizedTripsNetCents: SummarySourceValue<number>;
  };
  attendance: {
    basis: "actual_use_date";
    dayUseAdmitted: SummarySourceValue<number>;
    completedVehiclePeople: SummarySourceValue<number>;
    totalAdmitted: SummarySourceValue<number>;
  };
  forecast: { ticketsForSelectedDate: SummarySourceValue<number>; plannedGroupPeople: SummarySourceValue<number> };
  groupCount: number;
  receipts: UnavailableSummarySource;
  cash: SummarySourceValue<number>;
  expenses: UnavailableSummarySource;
  closure: UnavailableSummarySource;
  warnings: { code: string; message: string }[];
};

export class OperationalDaySummaryError extends Error {
  constructor(readonly code: "invalid_input" | "park_forbidden" | "summary_invalid_data", message: string) { super(message); }
}
function validateDate(date: string) {
  if (!isCivilDate(date)) throw new OperationalDaySummaryError("invalid_input", "Informe uma data válida no formato AAAA-MM-DD.");
}
function safeInteger(value: string | number): number {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) throw new OperationalDaySummaryError("summary_invalid_data", "Os valores da data precisam de conferência antes da apuração.");
  return number;
}
function available(value: number, source: string): SummarySourceValue<number> { return { status: "available", value, source }; }
function unavailable(source: string, reason: string): UnavailableSummarySource { return { status: "unavailable", value: null, source, reason }; }

type TotalsRow = {
  site: string; gate: string; services: string; unclassified: string; admitted: string; tickets: string;
  invalidAmounts: string; unclassifiedCount: string; invalidatedPaid: string; legacyDates: string;
};

export async function readOperationalDaySummary(client: QueryClient, date: string, park: OperationalParkId): Promise<OperationalDaySummary> {
  validateDate(date);
  if (park !== getOperationalParkId()) throw new OperationalDaySummaryError("park_forbidden", "O parque solicitado não pertence a esta origem de dados.");
  let configuration: OperationalDay | null = null;
  try {
    configuration = await getOperationalDay(date, client);
  } catch (error) {
    if (!(error instanceof OperationalDayError) || error.code !== "ambiguous_agenda") throw error;
  }
  // Classify each sold item once, before any aggregation; payments never fan out voucher rows.
  const result = await client.query<TotalsRow>(`
    WITH facts AS (
      SELECT v.vlunicompra * 100 AS cents, v.stusado, v.dtuso,
        COALESCE(v.dtinicio_validade, a.dtagenda) AS chosen_date, v.dtinicio_validade,
        c.stcompra='conc' AS paid, c.tpcompra AS channel,
        CASE
          WHEN v.idescola IS NOT NULL OR v.tpvoucher='escol'
            OR a.tpagenda IN ('escol','igrej','casam','melho','confr','ongs','grmix') THEN 'school'
          WHEN v.servico_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM servicos_adicionais s WHERE s.id=v.servico_id AND s.parque=$2
          ) THEN 'service'
          WHEN v.tpvoucher='espec' AND v.item_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM servicos_adicionais s WHERE s.legacy_ticket_id=v.item_id AND s.parque=$2
          ) THEN 'service'
          WHEN v.tpvoucher IN ('norma','infan','isent','corte') AND a.tpagenda IN ('padra','promo')
            AND NOT EXISTS (SELECT 1 FROM agenda_extras ae WHERE ae.idagenda=a.idagenda) THEN 'admission'
          ELSE 'unknown'
        END AS kind,
        c.tpcompra IN ('ponli','bilhe') OR (c.tpcompra='reser' AND COALESCE(UPPER(TRIM(c.formapag)), '') NOT IN ('','N/A')) AS known_channel
      FROM voucher v JOIN compra c ON c.idcompra=v.idcompra JOIN agenda a ON a.idagenda=v.idagenda
      WHERE (COALESCE(v.dtinicio_validade,a.dtagenda)=$1::date OR v.dtuso=$1::date)
        AND (v.parque_operacional IS NULL OR v.parque_operacional=$2)
    )
    SELECT
      COALESCE(SUM(cents) FILTER (WHERE paid AND chosen_date=$1::date AND kind='admission' AND channel='ponli'),0)::text AS site,
      COALESCE(SUM(cents) FILTER (WHERE paid AND chosen_date=$1::date AND kind='admission' AND channel IN ('bilhe','reser') AND known_channel),0)::text AS gate,
      COALESCE(SUM(cents) FILTER (WHERE paid AND chosen_date=$1::date AND kind='service' AND known_channel),0)::text AS services,
      COALESCE(SUM(cents) FILTER (WHERE paid AND chosen_date=$1::date AND kind<>'school' AND (kind='unknown' OR NOT known_channel OR known_channel IS NULL)),0)::text AS unclassified,
      COUNT(*) FILTER (WHERE kind='admission' AND stusado='s' AND dtuso=$1::date)::text AS admitted,
      COUNT(*) FILTER (WHERE paid AND chosen_date=$1::date AND kind='admission' AND known_channel AND stusado IS DISTINCT FROM 'inv')::text AS tickets,
      COUNT(*) FILTER (WHERE paid AND chosen_date=$1::date AND kind<>'school' AND (cents IS NULL OR cents<0 OR cents<>TRUNC(cents)))::text AS "invalidAmounts",
      COUNT(*) FILTER (WHERE paid AND chosen_date=$1::date AND kind<>'school' AND (kind='unknown' OR NOT known_channel OR known_channel IS NULL))::text AS "unclassifiedCount",
      COUNT(*) FILTER (WHERE paid AND chosen_date=$1::date AND stusado='inv')::text AS "invalidatedPaid",
      COUNT(*) FILTER (WHERE paid AND chosen_date=$1::date AND dtinicio_validade IS NULL)::text AS "legacyDates"
    FROM facts`, [date, park]);
  const row = result.rows[0];
  if (safeInteger(row.invalidAmounts) > 0) throw new OperationalDaySummaryError("summary_invalid_data", "Há valores de venda ausentes ou inválidos nesta data.");
  const site = safeInteger(row.site);
  const gate = safeInteger(row.gate);
  const services = safeInteger(row.services);
  const metadata = await client.query<{ generatedAt: Date; previousDate: string | null; nextDate: string | null; groupCount: string; cashCount: string; countedPeople: string; incompleteGroups: string; plannedPeople: string; missingPlans: string }>(`
    WITH movement AS (
      SELECT DISTINCT a.dtagenda AS date FROM agenda a
      WHERE (a.tpagenda IN ('padra','promo') AND a.stagenda IN ('abe','lot') AND NOT EXISTS (
        SELECT 1 FROM operacao_dias d WHERE d.parque=$2 AND d.data=a.dtagenda AND d.estado='closed'
      )) OR EXISTS (SELECT 1 FROM agenda_extras ae WHERE ae.idagenda=a.idagenda)
      UNION
      SELECT data_operacional AS date FROM caixa_periodos
      WHERE parque=$2 AND data_operacional IS NOT NULL AND local_id IS NOT NULL
    )
    SELECT CURRENT_TIMESTAMP AS "generatedAt",
      (SELECT MAX(date)::text FROM movement WHERE date<$1::date) AS "previousDate",
      (SELECT MIN(date)::text FROM movement WHERE date>$1::date) AS "nextDate",
      (SELECT COUNT(*)::text FROM agenda_extras ae JOIN agenda a ON a.idagenda=ae.idagenda WHERE a.dtagenda=$1::date) AS "groupCount",
      (SELECT COUNT(*)::text FROM caixa_periodos WHERE parque=$2 AND data_operacional=$1::date AND local_id IS NOT NULL) AS "cashCount",
      (SELECT COALESCE(SUM((SELECT SUM(value::bigint) FROM jsonb_each_text(n.counts))),0)::text
        FROM passeio_veiculos v JOIN agenda a ON a.idagenda=v.agenda_id JOIN passeio_contagens n ON n.id=v.current_count_id AND n.parque=v.parque
        WHERE v.parque=$2 AND a.dtagenda=$1::date AND v.estado='completed' AND n.status='completed') AS "countedPeople",
      (SELECT COUNT(*)::text FROM agenda_extras ae JOIN agenda a ON a.idagenda=ae.idagenda WHERE a.dtagenda=$1::date AND
        (NOT EXISTS(SELECT 1 FROM passeio_veiculos v WHERE v.parque=$2 AND v.agenda_id=ae.idagenda AND v.cliente_id=ae.idcliente) OR
         EXISTS(SELECT 1 FROM passeio_veiculos v LEFT JOIN passeio_contagens n ON n.id=v.current_count_id AND n.parque=v.parque
           WHERE v.parque=$2 AND v.agenda_id=ae.idagenda AND v.cliente_id=ae.idcliente AND (v.estado<>'completed' OR n.status IS DISTINCT FROM 'completed')))) AS "incompleteGroups",
      (SELECT COALESCE(SUM(o.planned_people),0)::text FROM agenda_extras ae JOIN agenda a ON a.idagenda=ae.idagenda
        LEFT JOIN passeio_operacao o ON o.parque=$2 AND o.agenda_id=ae.idagenda AND o.cliente_id=ae.idcliente WHERE a.dtagenda=$1::date) AS "plannedPeople",
      (SELECT COUNT(*)::text FROM agenda_extras ae JOIN agenda a ON a.idagenda=ae.idagenda
        LEFT JOIN passeio_operacao o ON o.parque=$2 AND o.agenda_id=ae.idagenda AND o.cliente_id=ae.idcliente WHERE a.dtagenda=$1::date AND o.planned_people IS NULL) AS "missingPlans"`, [date, park]);
  const meta = metadata.rows[0];
  const warnings = [
    { code: "revenue_incomplete", message: "Subtotal das fontes disponíveis. Finalização de passeios e total diário ainda indisponíveis." },
  ];
  if (safeInteger(meta.incompleteGroups) > 0) warnings.push({ code: "attendance_incomplete", message: "Há grupos sem contagem concluída. O subtotal considera apenas as entradas de day use e os veículos concluídos." });
  if (configuration === null) warnings.push({ code: "configuration_ambiguous", message: "A data possui agendas de day use sem vínculo único. O resumo financeiro permanece disponível; revise a configuração antes de editar." });
  if (safeInteger(row.unclassifiedCount) > 0) warnings.push({ code: "unclassified_sales", message: "Há itens vendidos sem classificação comprovada. Esses valores ficam fora do subtotal conhecido." });
  if (safeInteger(row.invalidatedPaid) > 0) warnings.push({ code: "paid_invalidated_vouchers", message: "Há vouchers invalidados de compras confirmadas. Invalidação não comprova devolução; confira os ajustes financeiros." });
  if (safeInteger(row.legacyDates) > 0) warnings.push({ code: "legacy_date_basis", message: "Vouchers legados sem snapshot usam a data atual da agenda; a data original anterior a reagendamentos não está disponível." });
  return {
    park, date, generatedAt: meta.generatedAt.toISOString(), configuration, configurationRevision: configuration?.version ?? null,
    navigation: { previousDate: meta.previousDate, nextDate: meta.nextDate },
    revenue: {
      basis: "selected_visit_date",
      siteNetCents: available(site, "voucher:paid_online_selected_date"),
      gateNetCents: available(gate, "voucher:paid_gate_and_reservation_selected_date"),
      servicesNetCents: available(services, "voucher:identified_service_selected_date"),
      unclassifiedNetCents: available(safeInteger(row.unclassified), "voucher:unclassified_selected_date"),
      knownSubtotalCents: safeInteger(site + gate + services),
      totalCents: unavailable("daily_revenue", "O total depende das fontes completas e da finalização dos passeios."),
      finalizedTripsNetCents: unavailable("trip_settlement", "Recebimentos e finalização de passeios ainda não integrados."),
    },
    attendance: {
      basis: "actual_use_date", dayUseAdmitted: available(safeInteger(row.admitted), "voucher:actual_admission_date"),
      completedVehiclePeople: available(safeInteger(meta.countedPeople), "vehicle_counting:current_completed_revision"),
      totalAdmitted: safeInteger(meta.incompleteGroups) > 0 ? unavailable("daily_attendance", "Há grupos sem contagem concluída.") : available(safeInteger(safeInteger(row.admitted)+safeInteger(meta.countedPeople)), "day_use_admissions_and_completed_vehicles"),
    },
    forecast: {
      ticketsForSelectedDate: available(safeInteger(row.tickets), "voucher:paid_admission_selected_date"),
      plannedGroupPeople: safeInteger(meta.missingPlans) > 0 ? unavailable("trip_planning", "Há grupos sem previsão cadastrada.") : available(safeInteger(meta.plannedPeople), "trip_planning:canonical_groups"),
    },
    groupCount: safeInteger(meta.groupCount),
    receipts: unavailable("payment_receipts", "Recebimentos por data e passeio ainda não integrados ao resumo."),
    cash: available(safeInteger(meta.cashCount), "operational_cash_sessions:park_operational_date"),
    expenses: unavailable("operational_expenses", "Despesas por data e passeio ainda não integradas."),
    closure: unavailable("daily_closure", "Fechamento diário revisionado ainda não integrado."),
    warnings,
  };
}

export async function getOperationalDaySummary(date: string): Promise<OperationalDaySummary> {
  validateDate(date);
  const park = getOperationalParkId();
  const client = await getOperationalCatalogPool().connect();
  let discard = false;
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    try {
      const summary = await readOperationalDaySummary(client, date, park);
      await client.query("COMMIT");
      return summary;
    } catch (error) {
      try { await client.query("ROLLBACK"); } catch { discard = true; }
      throw error;
    }
  } finally { client.release(discard); }
}
