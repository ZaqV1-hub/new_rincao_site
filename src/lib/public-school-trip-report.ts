import { getIngressoDbPool } from "@/lib/ingresso-db";
import {
  getOpsSchoolTripReport,
  type OpsSchoolTripReport,
  type OpsSchoolTripReportInput,
} from "@/lib/ops-school-trip-report";

type PublicSchoolTripPermalinkRow = {
  idescola: number;
  idagenda: number;
};

export class PublicSchoolTripReportError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "PublicSchoolTripReportError";
    this.code = code;
    this.status = status;
  }
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

export async function getPublicSchoolTripReportByPermalink(
  permalink: string,
): Promise<OpsSchoolTripReport> {
  const normalizedPermalink = normalizeText(permalink);

  if (!normalizedPermalink) {
    throw new PublicSchoolTripReportError(
      "public_school_trip_report_not_found",
      "Passeio escolar publico nao encontrado.",
      404,
    );
  }

  const pool = getIngressoDbPool();
  const permalinkResult = await pool.query<PublicSchoolTripPermalinkRow>(
    `
      SELECT idescola, idagenda
      FROM escoladata
      WHERE permalink = $1
      LIMIT 1
    `,
    [normalizedPermalink],
  );
  const match = permalinkResult.rows[0] ?? null;

  if (!match) {
    throw new PublicSchoolTripReportError(
      "public_school_trip_report_not_found",
      "Passeio escolar publico nao encontrado.",
      404,
    );
  }

  return getOpsSchoolTripReport({
    schoolId: match.idescola,
    agendaId: match.idagenda,
    purchaseStatus: "conc",
  } satisfies OpsSchoolTripReportInput);
}

export function asPublicSchoolTripReportError(error: unknown) {
  if (error instanceof PublicSchoolTripReportError) {
    return error;
  }

  return new PublicSchoolTripReportError(
    "public_school_trip_report_failed",
    "Nao foi possivel gerar o relatorio publico do passeio agora.",
    500,
  );
}
