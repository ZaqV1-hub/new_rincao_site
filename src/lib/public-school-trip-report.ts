import { getIngressoSistemaDbPool } from "@/lib/ingresso-db";
import {
  getOpsClientTripSchoolReport,
  type OpsClientTripSchoolReport,
} from "@/lib/ops-client-trip-school-report";
import {
  getOpsSchoolTripReport,
  type OpsSchoolTripReport,
  type OpsSchoolTripReportInput,
} from "@/lib/ops-school-trip-report";
import { readClientTripPlink } from "@/lib/plink";

type PublicSchoolTripPermalinkRow = {
  idescola: number;
  idagenda: number;
};

export type PublicSchoolTripReportResult =
  | {
      kind: "client";
      report: OpsClientTripSchoolReport;
    }
  | {
      kind: "school";
      report: OpsSchoolTripReport;
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
): Promise<PublicSchoolTripReportResult> {
  const normalizedPermalink = normalizeText(permalink);

  if (!normalizedPermalink) {
    throw new PublicSchoolTripReportError(
      "public_school_trip_report_not_found",
      "Passeio escolar público não encontrado.",
      404,
    );
  }

  const plinkPayload = readClientTripPlink(normalizedPermalink);

  if (plinkPayload?.tipo === "escola") {
    return {
      kind: "client",
      report: await getOpsClientTripSchoolReport({
        clientId: plinkPayload.idcliente,
        agendaId: plinkPayload.idagenda,
        purchaseStatus: "conc",
      }),
    };
  }

  const pool = getIngressoSistemaDbPool();
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
      "Passeio escolar público não encontrado.",
      404,
    );
  }

  return {
    kind: "school",
    report: await getOpsSchoolTripReport({
      schoolId: match.idescola,
      agendaId: match.idagenda,
      purchaseStatus: "conc",
    } satisfies OpsSchoolTripReportInput),
  };
}

export function asPublicSchoolTripReportError(error: unknown) {
  if (error instanceof PublicSchoolTripReportError) {
    return error;
  }

  return new PublicSchoolTripReportError(
    "public_school_trip_report_failed",
    "Não foi possível gerar o relatório público do passeio agora.",
    500,
  );
}
