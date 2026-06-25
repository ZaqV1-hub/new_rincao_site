import { getIngressoDbPool } from "@/lib/ingresso-db";
import {
  assertPositiveInteger,
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
  slug: string | null;
  idcliente: number;
  cliente_nome: string;
  idtipo: number | null;
  tipo_nome: string | null;
};

export type OpsClientTripSchoolReportInput = {
  agendaId?: unknown;
  clientId?: unknown;
  purchaseStatus?: unknown;
};

export type OpsClientTripSchoolReportParticipant = OpsTripSchoolReportParticipant;

export type OpsClientTripSchoolReport = {
  trip: {
    agendaId: number;
    clientId: number;
    clientName: string;
    clientTypeName: string | null;
    date: string;
    dateLabel: string;
    code: string;
    slug: string | null;
    agendaType: string | null;
    agendaTypeLabel: string;
    agendaStatus: string;
    agendaStatusLabel: string;
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
  students: OpsClientTripSchoolReportParticipant[];
  educators: OpsClientTripSchoolReportParticipant[];
};

export class OpsClientTripSchoolReportError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "OpsClientTripSchoolReportError";
    this.code = code;
    this.status = status;
  }
}

export async function getOpsClientTripSchoolReport(
  input: OpsClientTripSchoolReportInput,
): Promise<OpsClientTripSchoolReport> {
  const agendaId = assertPositiveInteger(
    input.agendaId,
    "Informe uma agenda valida.",
    (message) =>
      new OpsClientTripSchoolReportError(
        "client_trip_school_report_invalid_input",
        message,
        400,
      ),
  );
  const clientId = assertPositiveInteger(
    input.clientId,
    "Informe um cliente valido.",
    (message) =>
      new OpsClientTripSchoolReportError(
        "client_trip_school_report_invalid_input",
        message,
        400,
      ),
  );
  const purchaseStatus = normalizePurchaseStatus(input.purchaseStatus);
  const pool = getIngressoDbPool();

  const tripResult = await pool.query<TripRow>(
    `
      SELECT
        a.idagenda,
        to_char(a.dtagenda, 'YYYY-MM-DD') AS dtagenda,
        to_char(a.dtagenda, 'DD/MM/YYYY') AS dtagenda_fmt,
        a.tpagenda,
        COALESCE(ae.stagenda_cli, a.stagenda, 'abe') AS stagenda,
        ae.slug,
        c.idcliente,
        c.nome AS cliente_nome,
        c.idtipo,
        t.nome AS tipo_nome
      FROM agenda a
      JOIN agenda_extras ae ON ae.idagenda = a.idagenda
      JOIN clientes c ON c.idcliente = ae.idcliente
      JOIN cliente_tipos t ON t.idtipo = c.idtipo
      WHERE a.idagenda = $1
        AND c.idcliente = $2
      LIMIT 1
    `,
    [agendaId, clientId],
  );

  const trip = tripResult.rows[0] ?? null;

  if (!trip) {
    throw new OpsClientTripSchoolReportError(
      "client_trip_school_report_not_found",
      "Passeio escolar nao encontrado.",
      404,
    );
  }

  if (Number(trip.idtipo ?? 0) !== 4) {
    throw new OpsClientTripSchoolReportError(
      "client_trip_school_report_not_available",
      "Este detalhamento esta disponivel apenas para passeios escolares.",
      404,
    );
  }

  const reportSections = await loadOpsTripSchoolReportSections(pool, {
    agendaId,
    schoolId: clientId,
    purchaseStatus,
  });

  return {
    trip: {
      agendaId,
      clientId,
      clientName: trip.cliente_nome,
      clientTypeName: trip.tipo_nome,
      date: trip.dtagenda,
      dateLabel: trip.dtagenda_fmt,
      code: normalizeText(trip.slug).slice(0, 6).toUpperCase() || String(agendaId),
      slug: trip.slug,
      agendaType: trip.tpagenda,
      agendaTypeLabel: formatAgendaTypeLabel(trip.tpagenda),
      agendaStatus: normalizeText(trip.stagenda),
      agendaStatusLabel: formatAgendaStatusLabel(trip.stagenda),
    },
    filters: {
      purchaseStatus,
    },
    ...reportSections,
  };
}

export function formatOpsClientTripSchoolReportCsv(
  report: OpsClientTripSchoolReport,
) {
  return formatOpsTripSchoolReportCsv(report, "Cliente", report.trip.clientName);
}

export function asOpsClientTripSchoolReportError(error: unknown) {
  if (error instanceof OpsClientTripSchoolReportError) {
    return error;
  }

  return new OpsClientTripSchoolReportError(
    "client_trip_school_report_failed",
    "Nao foi possivel carregar o detalhe do passeio escolar agora.",
    500,
  );
}
