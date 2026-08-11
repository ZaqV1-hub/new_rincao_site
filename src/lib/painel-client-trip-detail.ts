import { getSchoolEducationStructure } from "@/lib/school-education";
import { getIngressoSistemaDbPool } from "@/lib/ingresso-db";
import {
  formatAgendaStatusLabel,
  formatAgendaTypeLabel,
  loadOpsTripSchoolReportSections,
  normalizePurchaseStatus,
  normalizeText,
  type OpsTripSchoolReportParticipant,
  type OpsTripSchoolReportSections,
} from "@/lib/ops-trip-school-report-core";
import { buildClientTripTrackingPath } from "@/lib/plink";

type TripRow = {
  idagenda: number;
  dtagenda: string;
  dtagenda_fmt: string;
  tpagenda: string | null;
  stagenda: string | null;
  slug: string | null;
  aceita_familia: boolean | string | number | null;
  idcliente: number;
  cliente_nome: string;
  endereco: string | null;
  idtipo: number | null;
  tipo_nome: string | null;
};

type SchoolRow = {
  idcliente: number;
  nome: string;
};

type ContractMetaRow = {
  escola_endereco: string | null;
  valor_negociado: string | number | null;
};

export type PainelClientTripDetailInput = {
  agendaId?: unknown;
  clientId?: unknown;
  purchaseStatus?: unknown;
};

export type PainelClientTripDetailParticipant = OpsTripSchoolReportParticipant & {
  schoolId: number;
  agendaId: number;
};

export type PainelClientTripDetailData = {
  trip: {
    agendaId: number;
    clientId: number;
    clientName: string;
    clientAddress: string;
    clientTypeId: number | null;
    clientTypeName: string | null;
    date: string;
    dateLabel: string;
    code: string;
    slug: string | null;
    agendaType: string | null;
    agendaTypeLabel: string;
    agendaStatus: string;
    agendaStatusLabel: string;
    acceptsFamily: boolean;
    uiStatus: "ati" | "ina";
    uiStatusLabel: "Ativo" | "Inativo";
    nextUiStatus: "ati" | "ina";
    nextUiStatusLabel: "Ativo" | "Inativo";
    purchaseLink: string | null;
    negotiatedValue: string | null;
    negotiatedValueLabel: string | null;
  };
  filters: {
    purchaseStatus: string;
  };
  statusOptions: OpsTripSchoolReportSections["statusOptions"];
  indicators: OpsTripSchoolReportSections["indicators"];
  schools: Array<{
    clientId: number;
    name: string;
  }>;
  students: PainelClientTripDetailParticipant[];
  educators: PainelClientTripDetailParticipant[];
  genericParticipants: PainelClientTripDetailParticipant[];
  isSchool: boolean;
  educationStructure: ReturnType<typeof getSchoolEducationStructure>;
};

export class PainelClientTripDetailError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "PainelClientTripDetailError";
    this.code = code;
    this.status = status;
  }
}

function assertPositiveInteger(value: unknown, message: string) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new PainelClientTripDetailError(
      "painel_client_trip_detail_invalid_input",
      message,
      400,
    );
  }

  return parsed;
}

function parseBooleanish(value: boolean | string | number | null | undefined) {
  if (value === true || value === false) {
    return value;
  }

  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "t";
}

function normalizeAddress(value: string | null | undefined) {
  return String(value ?? "").trim();
}

function getDefaultClientAddress(name: string) {
  return normalizeText(name).toUpperCase() === "TESTE CONTRATO"
    ? "Av. Adolfo Pinheiro, 2056"
    : "";
}

function resolveClientAddress(name: string, address: string | null | undefined) {
  return normalizeAddress(address) || getDefaultClientAddress(name);
}

function formatCurrencyLabel(value: string | number | null | undefined) {
  if (value == null || value === "") {
    return null;
  }

  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return null;
  }

  return numeric.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

async function hasTable(pool: ReturnType<typeof getIngressoSistemaDbPool>, tableName: string) {
  const result = await pool.query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = $1
      ) AS exists
    `,
    [tableName],
  );

  return Boolean(result.rows[0]?.exists);
}

async function ensureClientsAddressColumn(pool: ReturnType<typeof getIngressoSistemaDbPool>) {
  const result = await pool.query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'clientes'
          AND column_name = 'endereco'
      ) AS exists
    `,
  );

  if (result.rows[0]?.exists) {
    return;
  }

  await pool.query(`
    ALTER TABLE clientes
    ADD COLUMN endereco varchar(255)
  `);
}

async function loadContractMeta(
  pool: ReturnType<typeof getIngressoSistemaDbPool>,
  agendaId: number,
  clientId: number,
) {
  if (!(await hasTable(pool, "contrato_escolar_agendamento"))) {
    return null;
  }

  const result = await pool.query<ContractMetaRow>(
    `
      SELECT escola_endereco, valor_negociado
      FROM contrato_escolar_agendamento
      WHERE agenda_id = $1
        AND cliente_id = $2
        AND status = 'agendado'
      ORDER BY confirmado_em DESC NULLS LAST, idcontrato DESC
      LIMIT 1
    `,
    [agendaId, clientId],
  );

  return result.rows[0] ?? null;
}

function isSchoolClient(row: TripRow) {
  return Number(row.idtipo ?? 0) === 4 || normalizeText(row.tipo_nome).toLowerCase() === "escola";
}

function enrichParticipants(
  rows: OpsTripSchoolReportParticipant[],
  clientId: number,
  agendaId: number,
): PainelClientTripDetailParticipant[] {
  return rows.map((row) => ({
    ...row,
    schoolId: clientId,
    agendaId,
  }));
}

function buildUiStatus(stagenda: string | null | undefined) {
  const normalized = normalizeText(stagenda).toLowerCase();
  const uiStatus: "ati" | "ina" =
    normalized === "fec" || normalized === "ina" ? "ina" : "ati";

  return {
    uiStatus,
    uiStatusLabel: uiStatus === "ati" ? ("Ativo" as const) : ("Inativo" as const),
    nextUiStatus: uiStatus === "ati" ? ("ina" as const) : ("ati" as const),
    nextUiStatusLabel: uiStatus === "ati" ? ("Inativo" as const) : ("Ativo" as const),
  };
}

export async function getPainelClientTripDetail(
  input: PainelClientTripDetailInput,
): Promise<PainelClientTripDetailData> {
  const agendaId = assertPositiveInteger(input.agendaId, "Informe uma agenda valida.");
  const clientId = assertPositiveInteger(input.clientId, "Informe um cliente valido.");
  const purchaseStatus = normalizePurchaseStatus(input.purchaseStatus);
  const pool = getIngressoSistemaDbPool();

  await ensureClientsAddressColumn(pool);

  const tripResult = await pool.query<TripRow>(
    `
      SELECT
        a.idagenda,
        to_char(a.dtagenda, 'YYYY-MM-DD') AS dtagenda,
        to_char(a.dtagenda, 'DD/MM/YYYY') AS dtagenda_fmt,
        a.tpagenda,
        COALESCE(ae.stagenda_cli, a.stagenda, 'abe') AS stagenda,
        ae.slug,
        ae.aceita_familia,
        c.idcliente,
        c.nome AS cliente_nome,
        c.endereco,
        c.idtipo,
        t.nome AS tipo_nome
      FROM agenda a
      JOIN agenda_extras ae ON ae.idagenda = a.idagenda
      JOIN clientes c ON c.idcliente = ae.idcliente
      LEFT JOIN cliente_tipos t ON t.idtipo = c.idtipo
      WHERE a.idagenda = $1
        AND c.idcliente = $2
      LIMIT 1
    `,
    [agendaId, clientId],
  );

  const trip = tripResult.rows[0] ?? null;

  if (!trip) {
    throw new PainelClientTripDetailError(
      "painel_client_trip_detail_not_found",
      "Passeio nao encontrado.",
      404,
    );
  }

  const contractMeta = await loadContractMeta(pool, agendaId, clientId).catch(() => null);

  const sections = await loadOpsTripSchoolReportSections(pool, {
    agendaId,
    schoolId: clientId,
    purchaseStatus,
  });
  const schools = isSchoolClient(trip)
    ? (
        await pool.query<SchoolRow>(
          `
            SELECT c.idcliente, c.nome
            FROM agenda_extras ae
            JOIN clientes c ON c.idcliente = ae.idcliente
            WHERE ae.idagenda = $1
            ORDER BY c.nome ASC
          `,
          [agendaId],
        )
      ).rows.map((row) => ({
        clientId: Number(row.idcliente),
        name: row.nome,
      }))
    : [];
  const statusData = buildUiStatus(trip.stagenda);
  const students = enrichParticipants(sections.students, clientId, agendaId);
  const educators = enrichParticipants(sections.educators, clientId, agendaId);
  const genericParticipants = [...students, ...educators].sort((left, right) => {
    if (left.purchaseId !== right.purchaseId) {
      return left.purchaseId - right.purchaseId;
    }

    return left.voucherId - right.voucherId;
  });

  return {
    trip: {
      agendaId,
      clientId,
      clientName: trip.cliente_nome,
      clientAddress: resolveClientAddress(
        trip.cliente_nome,
        contractMeta?.escola_endereco ?? trip.endereco,
      ),
      clientTypeId: trip.idtipo,
      clientTypeName: trip.tipo_nome,
      date: trip.dtagenda,
      dateLabel: trip.dtagenda_fmt,
      code: normalizeText(trip.slug).slice(0, 6).toUpperCase() || String(agendaId),
      slug: trip.slug,
      agendaType: trip.tpagenda,
      agendaTypeLabel: formatAgendaTypeLabel(trip.tpagenda),
      agendaStatus: normalizeText(trip.stagenda),
      agendaStatusLabel: formatAgendaStatusLabel(trip.stagenda),
      acceptsFamily: parseBooleanish(trip.aceita_familia),
      ...statusData,
      purchaseLink: buildClientTripTrackingPath({
        idagenda: agendaId,
        idcliente: clientId,
        tipo: normalizeText(trip.tipo_nome),
      }),
      negotiatedValue:
        contractMeta?.valor_negociado == null ? null : String(contractMeta.valor_negociado),
      negotiatedValueLabel: formatCurrencyLabel(contractMeta?.valor_negociado),
    },
    filters: {
      purchaseStatus,
    },
    statusOptions: sections.statusOptions,
    indicators: sections.indicators,
    schools,
    students,
    educators,
    genericParticipants,
    isSchool: isSchoolClient(trip),
    educationStructure: getSchoolEducationStructure(),
  };
}

export function asPainelClientTripDetailError(error: unknown) {
  if (error instanceof PainelClientTripDetailError) {
    return error;
  }

  return new PainelClientTripDetailError(
    "painel_client_trip_detail_failed",
    "Nao foi possivel carregar o detalhe do passeio agora.",
    500,
  );
}
