import { getIngressoDbPool } from "@/lib/ingresso-db";
import {
  assertPositiveInteger,
  formatActiveStatusLabel,
  formatAgendaStatusLabel,
  formatAgendaTypeLabel,
  formatOpsTripSchoolReportCsv,
  loadOpsTripSchoolReportSections,
  normalizePurchaseStatus,
  normalizeText,
  type OpsTripSchoolReportParticipant,
} from "@/lib/ops-trip-school-report-core";

type TripRow = {
  idagenda: number;
  dtagenda: string;
  dtagenda_fmt: string;
  tpagenda: string | null;
  stagenda: string | null;
  idescola: number;
  nmescola: string;
  stescola: string | null;
  status: string | null;
  codescoladata: string | null;
  permalink: string | null;
};

export type OpsSchoolTripReportInput = {
  agendaId?: unknown;
  schoolId?: unknown;
  purchaseStatus?: unknown;
};

export type OpsSchoolTripReportParticipant = OpsTripSchoolReportParticipant;

export type OpsSchoolTripReport = {
  trip: {
    agendaId: number;
    schoolId: number;
    schoolName: string;
    date: string;
    dateLabel: string;
    code: string;
    permalink: string | null;
    agendaType: string | null;
    agendaTypeLabel: string;
    agendaStatus: string;
    agendaStatusLabel: string;
    schoolStatus: string;
    schoolStatusLabel: string;
    tripStatus: string;
    tripStatusLabel: string;
  };
  filters: {
    purchaseStatus: string;
  };
  statusOptions: Array<{
    value: string;
    label: string;
  }>;
  indicators: {
    paidCount: number;
    unpaidCount: number;
    usedCount: number;
    unusedCount: number;
    paidValue: string;
    unpaidValue: string;
    usedValue: string;
    unusedValue: string;
    totalCount: number;
    totalValue: string;
  };
  students: OpsSchoolTripReportParticipant[];
  educators: OpsSchoolTripReportParticipant[];
};

export class OpsSchoolTripReportError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "OpsSchoolTripReportError";
    this.code = code;
    this.status = status;
  }
}

export async function getOpsSchoolTripReport(
  input: OpsSchoolTripReportInput,
): Promise<OpsSchoolTripReport> {
  const agendaId = assertPositiveInteger(
    input.agendaId,
    "Informe uma agenda valida.",
    (message) =>
      new OpsSchoolTripReportError(
        "school_trip_report_invalid_input",
        message,
        400,
      ),
  );
  const schoolId = assertPositiveInteger(
    input.schoolId,
    "Informe uma escola valida.",
    (message) =>
      new OpsSchoolTripReportError(
        "school_trip_report_invalid_input",
        message,
        400,
      ),
  );
  const purchaseStatus = normalizePurchaseStatus(input.purchaseStatus);
  const pool = getIngressoDbPool();

  const tripResult = await pool.query<TripRow>(
    `
      SELECT
        agenda.idagenda,
        to_char(agenda.dtagenda, 'YYYY-MM-DD') AS dtagenda,
        to_char(agenda.dtagenda, 'DD/MM/YYYY') AS dtagenda_fmt,
        agenda.tpagenda,
        agenda.stagenda,
        escola.idescola,
        escola.nmescola,
        escola.stescola,
        escoladata.status,
        escoladata.codescoladata,
        escoladata.permalink
      FROM escoladata
      JOIN escola ON escola.idescola = escoladata.idescola
      JOIN agenda ON agenda.idagenda = escoladata.idagenda
      WHERE escoladata.idagenda = $1
        AND escoladata.idescola = $2
      LIMIT 1
    `,
    [agendaId, schoolId],
  );

  const trip = tripResult.rows[0] ?? null;

  if (!trip) {
    throw new OpsSchoolTripReportError(
      "school_trip_report_not_found",
      "Passeio escolar nao encontrado.",
      404,
    );
  }

  const reportSections = await loadOpsTripSchoolReportSections(pool, {
    agendaId,
    schoolId,
    purchaseStatus,
  });

  return {
    trip: {
      agendaId,
      schoolId,
      schoolName: trip.nmescola,
      date: trip.dtagenda,
      dateLabel: trip.dtagenda_fmt,
      code: normalizeText(trip.codescoladata) || String(agendaId),
      permalink: trip.permalink,
      agendaType: trip.tpagenda,
      agendaTypeLabel: formatAgendaTypeLabel(trip.tpagenda),
      agendaStatus: normalizeText(trip.stagenda),
      agendaStatusLabel: formatAgendaStatusLabel(trip.stagenda),
      schoolStatus: normalizeText(trip.stescola).toLowerCase() || "ati",
      schoolStatusLabel: formatActiveStatusLabel(trip.stescola),
      tripStatus: normalizeText(trip.status).toLowerCase() || "ati",
      tripStatusLabel: formatActiveStatusLabel(trip.status),
    },
    filters: {
      purchaseStatus,
    },
    ...reportSections,
  };
}

export function formatOpsSchoolTripReportCsv(
  report: OpsSchoolTripReport,
) {
  return formatOpsTripSchoolReportCsv(report, "Escola", report.trip.schoolName);
}

export function asOpsSchoolTripReportError(error: unknown) {
  if (error instanceof OpsSchoolTripReportError) {
    return error;
  }

  return new OpsSchoolTripReportError(
    "school_trip_report_failed",
    "Nao foi possivel carregar o detalhe do passeio escolar agora.",
    500,
  );
}
