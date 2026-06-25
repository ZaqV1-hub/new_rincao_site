import { createHash, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { getIngressoDbPool } from "@/lib/ingresso-db";
import { registerOpsAuditLog } from "@/lib/ops-audit-log";
import { buildClientTripPurchasePath } from "@/lib/plink";

type ClientTripActor = {
  name?: string | null;
  cpf?: string | null;
};

type ClientTripClientRow = {
  idcliente: number;
  nome: string;
  tipo_nome: string | null;
  idtipo: number | null;
  status?: boolean | string | null;
};

type ClientTripAgendaRow = {
  idagenda: number;
  dtagenda: string;
  dtagenda_fmt: string;
  tpagenda: string | null;
  stagenda: string | null;
};

type ClientTripExtrasRow = {
  idagenda: number;
  idcliente: number | null;
  aceita_familia: boolean | string | number | null;
  stagenda_cli: string | null;
  slug: string | null;
};

type ClientTripFaixaRow = {
  idfaixa: number;
  idade_min: number | string;
  idade_max: number | string;
  valor: string | number | null;
};

type ClientTripListRow = {
  idagenda: number;
  codigo_passeio: string | null;
  dtagenda: string;
  dtagenda_fmt: string;
  tpagenda: string | null;
  stagenda: string | null;
  aceita_familia: boolean | string | number | null;
  slug: string | null;
  idcliente: number;
  cliente_nome: string;
  idtipo: number | null;
  tipo_nome: string | null;
  qtpessoas: number | string | null;
};

export type OpsClientTripFilterInput = {
  code?: string | null;
  query?: string | null;
  typeId?: string | number | null;
  status?: string | null;
  fromDate?: string | null;
  toDate?: string | null;
  page?: string | number | null;
  pageSize?: string | number | null;
};

export type OpsClientTripTypeOption = {
  id: number;
  name: string;
};

export type OpsClientTripFaixaInput = {
  minAge?: unknown;
  maxAge?: unknown;
  value?: unknown;
};

export type OpsClientTripFaixa = {
  minAge: number;
  maxAge: number;
  value: string;
};

export type OpsClientTripListItem = {
  agendaId: number;
  code: string;
  date: string;
  dateLabel: string;
  agendaType: string | null;
  agendaTypeLabel: string;
  status: string;
  statusLabel: string;
  acceptsFamily: boolean;
  slug: string | null;
  clientId: number;
  clientName: string;
  clientTypeId: number | null;
  clientTypeName: string | null;
  peopleCount: number;
  purchaseLink: string | null;
};

export type OpsClientTripListResult = {
  filters: {
    code: string;
    query: string;
    typeId: number | null;
    status: string;
    fromDate: string;
    toDate: string;
    page: number;
    pageSize: number;
  };
  indicators: {
    performed: number;
    upcoming: number;
    total: number;
  };
  typeOptions: OpsClientTripTypeOption[];
  items: OpsClientTripListItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

export type OpsClientTripAgendaOption = {
  agendaId: number;
  date: string;
  dateLabel: string;
  agendaType: string | null;
  agendaTypeLabel: string;
  status: string;
  statusLabel: string;
};

export type OpsClientTripClientOption = {
  clientId: number;
  name: string;
  typeId: number | null;
  typeName: string | null;
};

export type OpsClientTripCreateScreenData = {
  mode: "create";
  preselectedAgendaId: number | null;
  preselectedClientId: number | null;
  agendas: OpsClientTripAgendaOption[];
  clients: OpsClientTripClientOption[];
  faixas: OpsClientTripFaixa[];
};

export type OpsClientTripEditScreenData = {
  mode: "edit";
  agenda: OpsClientTripAgendaOption;
  client: OpsClientTripClientOption;
  status: string;
  statusLabel: string;
  acceptsFamily: boolean;
  slug: string | null;
  faixas: OpsClientTripFaixa[];
};

export type OpsClientTripCreateInput = {
  agendaId?: unknown;
  clientId?: unknown;
  acceptsFamily?: unknown;
  faixas?: unknown;
  actor?: ClientTripActor | null;
};

export type OpsClientTripUpdateInput = {
  agendaId?: unknown;
  clientId?: unknown;
  acceptsFamily?: unknown;
  faixas?: unknown;
  actor?: ClientTripActor | null;
};

export type OpsClientTripDeleteInput = {
  agendaId?: unknown;
  clientId?: unknown;
  actor?: ClientTripActor | null;
};

export type OpsClientTripMoveDateInput = {
  agendaId?: unknown;
  clientId?: unknown;
  tripDate?: unknown;
  actor?: ClientTripActor | null;
};

export type OpsClientTripMutationResult = {
  agendaId: number;
  clientId: number;
  auditLogId: number | null;
  message: string;
};

const agendaTypeLabels: Record<string, string> = {
  padra: "Padrao",
  promo: "Promocional",
  escol: "Escolar",
  igrej: "Igreja",
  casam: "Casamento",
  melho: "Melhor idade",
  confr: "Confraternizacao",
  ongs: "ONG",
  grmix: "Grupo misto",
};

const agendaStatusLabels: Record<string, string> = {
  abe: "Aberta",
  enc: "Encerrada",
  can: "Cancelada",
  fec: "Fechada",
  lot: "Lotada",
};

let agendaFaixasSupportsClientId: boolean | null = null;

export class OpsClientTripError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "OpsClientTripError";
    this.code = code;
    this.status = status;
  }
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeActorName(actor: ClientTripActor | null | undefined) {
  return normalizeText(actor?.name) || normalizeText(actor?.cpf) || null;
}

function parseBooleanish(value: unknown) {
  if (value === true || value === false) {
    return value;
  }

  const normalized = normalizeText(value).toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "t";
}

function assertPositiveInteger(value: unknown, message: string) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new OpsClientTripError("client_trip_invalid_payload", message, 400);
  }

  return parsed;
}

function formatAgendaTypeLabel(value: string | null | undefined) {
  const normalized = normalizeText(value);
  return agendaTypeLabels[normalized] ?? (normalized || "-");
}

function formatAgendaStatusLabel(value: string | null | undefined) {
  const normalized = normalizeText(value);
  return agendaStatusLabels[normalized] ?? (normalized || "-");
}

function normalizeSearch(value: unknown) {
  return normalizeText(value).replace(/\s+/g, " ");
}

function normalizeListFilters(input: OpsClientTripFilterInput) {
  const page = Math.max(1, Number(input.page) || 1);
  const pageSize = Math.min(100, Math.max(10, Number(input.pageSize) || 20));

  return {
    code: normalizeText(input.code).toUpperCase(),
    query: normalizeSearch(input.query),
    typeId: Number.isInteger(Number(input.typeId)) && Number(input.typeId) > 0
      ? Number(input.typeId)
      : null,
    status: normalizeText(input.status).toLowerCase(),
    fromDate: normalizeDateInput(input.fromDate),
    toDate: normalizeDateInput(input.toDate),
    page,
    pageSize,
  };
}

function normalizeDateInput(value: unknown) {
  const normalized = normalizeText(value);

  if (!normalized) {
    return "";
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return normalized;
  }

  const match = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (!match) {
    return "";
  }

  return `${match[3]}-${match[2]}-${match[1]}`;
}

function buildRandomSlug() {
  return createHash("md5").update(randomUUID()).digest("hex");
}

function formatMoneyValue(value: string | number | null | undefined) {
  const numeric = Number(value ?? 0);

  if (!Number.isFinite(numeric)) {
    return "0.00";
  }

  return numeric.toFixed(2);
}

async function agendaFaixasHasClientColumn(client: PoolClient) {
  if (agendaFaixasSupportsClientId !== null) {
    return agendaFaixasSupportsClientId;
  }

  const result = await client.query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'agenda_faixas'
          AND column_name = 'idcliente'
      ) AS exists
    `,
  );

  agendaFaixasSupportsClientId = Boolean(result.rows[0]?.exists);
  return agendaFaixasSupportsClientId;
}

async function hasPublicTable(client: PoolClient, tableName: string) {
  const result = await client.query<{ exists: boolean }>(
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

async function hasPublicColumn(
  client: PoolClient,
  tableName: string,
  columnName: string,
) {
  const result = await client.query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = $1
          AND column_name = $2
      ) AS exists
    `,
    [tableName, columnName],
  );

  return Boolean(result.rows[0]?.exists);
}

async function getClientById(client: PoolClient, clientId: number) {
  const result = await client.query<ClientTripClientRow>(
    `
      SELECT
        c.idcliente,
        c.nome,
        c.idtipo,
        c.status,
        t.nome AS tipo_nome
      FROM clientes c
      JOIN cliente_tipos t ON t.idtipo = c.idtipo
      WHERE c.idcliente = $1
      LIMIT 1
    `,
    [clientId],
  );

  const row = result.rows[0] ?? null;

  if (!row) {
    throw new OpsClientTripError(
      "client_trip_client_not_found",
      "Cliente inexistente.",
      404,
    );
  }

  return row;
}

async function getAgendaById(client: PoolClient, agendaId: number) {
  const result = await client.query<ClientTripAgendaRow>(
    `
      SELECT
        a.idagenda,
        to_char(a.dtagenda, 'YYYY-MM-DD') AS dtagenda,
        to_char(a.dtagenda, 'DD/MM/YYYY') AS dtagenda_fmt,
        a.tpagenda,
        COALESCE(ae.stagenda_cli, a.stagenda, 'abe') AS stagenda
      FROM agenda a
      LEFT JOIN agenda_extras ae ON ae.idagenda = a.idagenda
      WHERE a.idagenda = $1
      LIMIT 1
    `,
    [agendaId],
  );

  const row = result.rows[0] ?? null;

  if (!row) {
    throw new OpsClientTripError(
      "client_trip_agenda_not_found",
      "Agenda inexistente.",
      404,
    );
  }

  return row;
}

async function getAgendaExtras(
  client: PoolClient,
  agendaId: number,
  clientId?: number | null,
  lock = false,
) {
  const clauses = ["idagenda = $1"];
  const values: Array<number> = [agendaId];

  if (clientId == null) {
    clauses.push("TRUE");
  } else {
    clauses.push(`idcliente = $${values.length + 1}`);
    values.push(clientId);
  }

  const result = await client.query<ClientTripExtrasRow>(
    `
      SELECT idagenda, idcliente, aceita_familia, stagenda_cli, slug
      FROM agenda_extras
      WHERE ${clauses.join(" AND ")}
      ORDER BY idcliente NULLS LAST
      LIMIT 1
      ${lock ? "FOR UPDATE" : ""}
    `,
    values,
  );

  return result.rows[0] ?? null;
}

function normalizeFaixas(raw: unknown) {
  const values = Array.isArray(raw) ? raw : [];
  const faixas: OpsClientTripFaixa[] = [];

  for (const value of values) {
    if (!value || typeof value !== "object") {
      continue;
    }

    const faixa = value as OpsClientTripFaixaInput;
    const minAge = Number(faixa.minAge);
    const maxAge = Number(faixa.maxAge);
    const numericValue = Number(
      normalizeText(faixa.value).replace(/[R$\s]/g, "").replace(",", "."),
    );

    if (
      !Number.isInteger(minAge) ||
      !Number.isInteger(maxAge) ||
      minAge < 0 ||
      maxAge < minAge ||
      !Number.isFinite(numericValue) ||
      numericValue < 0
    ) {
      throw new OpsClientTripError(
        "client_trip_invalid_faixas",
        "Revise as faixas etarias informadas.",
        400,
      );
    }

    faixas.push({
      minAge,
      maxAge,
      value: numericValue.toFixed(2),
    });
  }

  if (faixas.length === 0) {
    throw new OpsClientTripError(
      "client_trip_invalid_faixas",
      "Informe pelo menos uma faixa etaria para o passeio.",
      400,
    );
  }

  return faixas.sort((left, right) => left.minAge - right.minAge);
}

async function listFaixasForAgenda(
  client: PoolClient,
  agendaId: number,
  clientId: number | null,
) {
  const supportsClientId = await agendaFaixasHasClientColumn(client);
  const values: Array<number> = [agendaId];
  let where = "idagenda = $1";

  if (supportsClientId) {
    if (clientId == null) {
      where += " AND idcliente IS NULL";
    } else {
      where += ` AND idcliente = $${values.length + 1}`;
      values.push(clientId);
    }
  }

  const result = await client.query<ClientTripFaixaRow>(
    `
      SELECT idfaixa, idade_min, idade_max, valor
      FROM agenda_faixas
      WHERE ${where}
      ORDER BY idade_min ASC, idade_max ASC, idfaixa ASC
    `,
    values,
  );

  return result.rows.map((row) => ({
    minAge: Number(row.idade_min),
    maxAge: Number(row.idade_max),
    value: formatMoneyValue(row.valor),
  }));
}

async function replaceFaixasForAgenda(
  client: PoolClient,
  agendaId: number,
  clientId: number | null,
  faixas: OpsClientTripFaixa[],
) {
  const supportsClientId = await agendaFaixasHasClientColumn(client);
  const values: Array<number> = [agendaId];
  let where = "idagenda = $1";

  if (supportsClientId) {
    if (clientId == null) {
      where += " AND idcliente IS NULL";
    } else {
      where += ` AND idcliente = $${values.length + 1}`;
      values.push(clientId);
    }
  }

  await client.query(`DELETE FROM agenda_faixas WHERE ${where}`, values);

  for (const faixa of faixas) {
    if (supportsClientId) {
      await client.query(
        `
          INSERT INTO agenda_faixas (
            idagenda,
            idcliente,
            idade_min,
            idade_max,
            valor
          ) VALUES ($1, $2, $3, $4, $5)
        `,
        [agendaId, clientId, faixa.minAge, faixa.maxAge, faixa.value],
      );
    } else {
      await client.query(
        `
          INSERT INTO agenda_faixas (
            idagenda,
            idade_min,
            idade_max,
            valor
          ) VALUES ($1, $2, $3, $4)
        `,
        [agendaId, faixa.minAge, faixa.maxAge, faixa.value],
      );
    }
  }
}

function buildListWhere(filters: ReturnType<typeof normalizeListFilters>) {
  const clauses: string[] = [];
  const values: Array<string | number> = [];

  if (filters.code) {
    values.push(filters.code);
    clauses.push(
      `upper(substr(coalesce(ae.slug, md5(a.idagenda::text)), 1, 6)) = $${values.length}`,
    );
  }

  if (filters.query) {
    values.push(`%${filters.query.toLowerCase()}%`);
    clauses.push(
      `lower(regexp_replace(translate(btrim(c.nome), E'\\u00A0', ' '), '\\s+', ' ', 'g')) LIKE $${values.length}`,
    );
  }

  if (filters.typeId) {
    values.push(filters.typeId);
    clauses.push(`c.idtipo = $${values.length}`);
  }

  if (filters.status) {
    values.push(filters.status);
    clauses.push(`ae.stagenda_cli = $${values.length}`);
  }

  if (filters.fromDate) {
    values.push(filters.fromDate);
    clauses.push(`a.dtagenda >= $${values.length}`);
  }

  if (filters.toDate) {
    values.push(filters.toDate);
    clauses.push(`a.dtagenda <= $${values.length}`);
  }

  return {
    where: clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "",
    values,
  };
}

async function listClientTripTypeOptions(client: PoolClient) {
  const result = await client.query<{
    idtipo: number;
    nome: string;
  }>(
    `
      SELECT idtipo, nome
      FROM cliente_tipos
      ORDER BY nome ASC
    `,
  );

  return result.rows.map((row) => ({
    id: Number(row.idtipo),
    name: row.nome,
  }));
}

export async function listOpsClientTrips(input: OpsClientTripFilterInput) {
  const filters = normalizeListFilters(input);
  const { where, values } = buildListWhere(filters);
  const pool = getIngressoDbPool();
  const client = await pool.connect();

  try {
    const year = new Date().getFullYear();
    const [types, indicatorsResult, countResult, itemsResult] = await Promise.all([
      listClientTripTypeOptions(client),
      client.query<{
        realizados: string | number | null;
        futuros: string | number | null;
        total: string | number | null;
      }>(
        `
          SELECT
            SUM(CASE WHEN EXTRACT(YEAR FROM a.dtagenda) = ${year} AND a.dtagenda < now() THEN 1 ELSE 0 END) AS realizados,
            SUM(CASE WHEN EXTRACT(YEAR FROM a.dtagenda) = ${year} AND a.dtagenda >= now() THEN 1 ELSE 0 END) AS futuros,
            SUM(CASE WHEN EXTRACT(YEAR FROM a.dtagenda) = ${year} THEN 1 ELSE 0 END) AS total
          FROM agenda a
          JOIN agenda_extras ae ON ae.idagenda = a.idagenda
          JOIN clientes c ON c.idcliente = ae.idcliente
          ${where}
        `,
        values,
      ),
      client.query<{ total: string | number }>(
        `
          SELECT COUNT(*) AS total
          FROM agenda a
          JOIN agenda_extras ae ON ae.idagenda = a.idagenda
          JOIN clientes c ON c.idcliente = ae.idcliente
          JOIN cliente_tipos t ON t.idtipo = c.idtipo
          ${where}
        `,
        values,
      ),
      client.query<ClientTripListRow>(
        `
          SELECT
            a.idagenda,
            upper(substr(coalesce(ae.slug, md5(a.idagenda::text)), 1, 6)) AS codigo_passeio,
            to_char(a.dtagenda, 'YYYY-MM-DD') AS dtagenda,
            to_char(a.dtagenda, 'DD/MM/YYYY') AS dtagenda_fmt,
            a.tpagenda,
            COALESCE(ae.stagenda_cli, 'abe') AS stagenda,
            ae.aceita_familia,
            ae.slug,
            c.idcliente,
            c.nome AS cliente_nome,
            c.idtipo,
            t.nome AS tipo_nome,
            (
              SELECT COUNT(*)
              FROM voucher v
              JOIN compra cp ON cp.idcompra = v.idcompra
              WHERE v.idagenda = a.idagenda
                AND v.idescola = c.idcliente
                AND cp.stcompra IN ('conc')
            ) AS qtpessoas
          FROM agenda a
          JOIN agenda_extras ae ON ae.idagenda = a.idagenda
          JOIN clientes c ON c.idcliente = ae.idcliente
          JOIN cliente_tipos t ON t.idtipo = c.idtipo
          ${where}
          ORDER BY a.dtagenda DESC, a.idagenda DESC
          LIMIT $${values.length + 1}
          OFFSET $${values.length + 2}
        `,
        [...values, filters.pageSize, (filters.page - 1) * filters.pageSize],
      ),
    ]);

    const total = Number(countResult.rows[0]?.total ?? 0);
    const pageCount = Math.max(1, Math.ceil(total / filters.pageSize));
    const indicators = indicatorsResult.rows[0];

    return {
      filters,
      indicators: {
        performed: Number(indicators?.realizados ?? 0),
        upcoming: Number(indicators?.futuros ?? 0),
        total: Number(indicators?.total ?? 0),
      },
      typeOptions: types,
      items: itemsResult.rows.map((row) => ({
        agendaId: Number(row.idagenda),
        code: row.codigo_passeio ?? String(row.idagenda),
        date: row.dtagenda,
        dateLabel: row.dtagenda_fmt,
        agendaType: row.tpagenda,
        agendaTypeLabel: formatAgendaTypeLabel(row.tpagenda),
        status: normalizeText(row.stagenda),
        statusLabel: formatAgendaStatusLabel(row.stagenda),
        acceptsFamily: parseBooleanish(row.aceita_familia),
        slug: row.slug,
        clientId: Number(row.idcliente),
        clientName: row.cliente_nome,
        clientTypeId: row.idtipo == null ? null : Number(row.idtipo),
        clientTypeName: row.tipo_nome,
        peopleCount: Number(row.qtpessoas ?? 0),
        purchaseLink: buildClientTripPurchasePath({
          idagenda: Number(row.idagenda),
          idcliente: Number(row.idcliente),
          tipo: row.tipo_nome ?? "",
        }),
      })),
      total,
      page: filters.page,
      pageSize: filters.pageSize,
      pageCount,
    } satisfies OpsClientTripListResult;
  } finally {
    client.release();
  }
}

export async function getOpsClientTripCreateScreenData(input?: {
  agendaId?: number | null;
  clientId?: number | null;
}) {
  const pool = getIngressoDbPool();
  const client = await pool.connect();

  try {
    const [agendasResult, clientsResult] = await Promise.all([
      client.query<ClientTripAgendaRow>(
        `
          SELECT
            a.idagenda,
            to_char(a.dtagenda, 'YYYY-MM-DD') AS dtagenda,
            to_char(a.dtagenda, 'DD/MM/YYYY') AS dtagenda_fmt,
            a.tpagenda,
            COALESCE(ae.stagenda_cli, a.stagenda, 'abe') AS stagenda
          FROM agenda a
          LEFT JOIN agenda_extras ae ON ae.idagenda = a.idagenda
          WHERE ae.idcliente IS NULL
          ORDER BY a.dtagenda DESC, a.idagenda DESC
          LIMIT 300
        `,
      ),
      client.query<ClientTripClientRow>(
        `
          SELECT
            c.idcliente,
            c.nome,
            c.idtipo,
            t.nome AS tipo_nome
          FROM clientes c
          JOIN cliente_tipos t ON t.idtipo = c.idtipo
          WHERE c.status = TRUE
          ORDER BY t.nome ASC, c.nome ASC
        `,
      ),
    ]);

    return {
      mode: "create",
      preselectedAgendaId:
        Number.isInteger(Number(input?.agendaId)) && Number(input?.agendaId) > 0
          ? Number(input?.agendaId)
          : null,
      preselectedClientId:
        Number.isInteger(Number(input?.clientId)) && Number(input?.clientId) > 0
          ? Number(input?.clientId)
          : null,
      agendas: agendasResult.rows.map((row) => ({
        agendaId: Number(row.idagenda),
        date: row.dtagenda,
        dateLabel: row.dtagenda_fmt,
        agendaType: row.tpagenda,
        agendaTypeLabel: formatAgendaTypeLabel(row.tpagenda),
        status: normalizeText(row.stagenda),
        statusLabel: formatAgendaStatusLabel(row.stagenda),
      })),
      clients: clientsResult.rows.map((row) => ({
        clientId: Number(row.idcliente),
        name: row.nome,
        typeId: row.idtipo == null ? null : Number(row.idtipo),
        typeName: row.tipo_nome,
      })),
      faixas: [
        {
          minAge: 0,
          maxAge: 0,
          value: "0.00",
        },
      ],
    } satisfies OpsClientTripCreateScreenData;
  } finally {
    client.release();
  }
}

export async function getOpsClientTripEditScreenData(
  agendaId: number,
  clientId: number,
) {
  const normalizedAgendaId = assertPositiveInteger(
    agendaId,
    "Informe uma agenda valida.",
  );
  const normalizedClientId = assertPositiveInteger(
    clientId,
    "Informe um cliente valido.",
  );
  const pool = getIngressoDbPool();
  const client = await pool.connect();

  try {
    const [agenda, clientRow, extras] = await Promise.all([
      getAgendaById(client, normalizedAgendaId),
      getClientById(client, normalizedClientId),
      getAgendaExtras(client, normalizedAgendaId, normalizedClientId),
    ]);

    if (!extras) {
      throw new OpsClientTripError(
        "client_trip_binding_not_found",
        "Vinculo cliente-agenda nao encontrado.",
        404,
      );
    }

    let faixas = await listFaixasForAgenda(
      client,
      normalizedAgendaId,
      normalizedClientId,
    );

    if (faixas.length === 0) {
      faixas = await listFaixasForAgenda(client, normalizedAgendaId, null);
    }

    if (faixas.length === 0) {
      faixas = [{ minAge: 0, maxAge: 0, value: "0.00" }];
    }

    return {
      mode: "edit",
      agenda: {
        agendaId: Number(agenda.idagenda),
        date: agenda.dtagenda,
        dateLabel: agenda.dtagenda_fmt,
        agendaType: agenda.tpagenda,
        agendaTypeLabel: formatAgendaTypeLabel(agenda.tpagenda),
        status: normalizeText(agenda.stagenda),
        statusLabel: formatAgendaStatusLabel(agenda.stagenda),
      },
      client: {
        clientId: Number(clientRow.idcliente),
        name: clientRow.nome,
        typeId: clientRow.idtipo == null ? null : Number(clientRow.idtipo),
        typeName: clientRow.tipo_nome,
      },
      status: normalizeText(extras.stagenda_cli || agenda.stagenda),
      statusLabel: formatAgendaStatusLabel(extras.stagenda_cli || agenda.stagenda),
      acceptsFamily: parseBooleanish(extras.aceita_familia),
      slug: extras.slug,
      faixas,
    } satisfies OpsClientTripEditScreenData;
  } finally {
    client.release();
  }
}

export async function createOpsClientTrip(input: OpsClientTripCreateInput) {
  const agendaId = assertPositiveInteger(input.agendaId, "Selecione a agenda.");
  const clientId = assertPositiveInteger(input.clientId, "Selecione o cliente.");
  const acceptsFamily = parseBooleanish(input.acceptsFamily);
  const faixas = normalizeFaixas(input.faixas);
  const pool = getIngressoDbPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const [agenda, clientRow] = await Promise.all([
      getAgendaById(client, agendaId),
      getClientById(client, clientId),
    ]);
    const currentExtras = await getAgendaExtras(client, agendaId, null, true);

    if (currentExtras?.idcliente && Number(currentExtras.idcliente) !== clientId) {
      throw new OpsClientTripError(
        "client_trip_agenda_taken",
        "Esta agenda ja esta vinculada a outro cliente.",
        409,
      );
    }

    const slug = currentExtras?.slug || buildRandomSlug();

    if (!currentExtras) {
      await client.query(
        `
          INSERT INTO agenda_extras (
            idagenda,
            idcliente,
            aceita_familia,
            slug,
            criado_em,
            atualizado_em
          ) VALUES ($1, $2, $3, $4, NOW(), NOW())
        `,
        [agendaId, clientId, acceptsFamily, slug],
      );
    } else {
      await client.query(
        `
          UPDATE agenda_extras
          SET idcliente = $2,
              aceita_familia = $3,
              slug = $4,
              atualizado_em = NOW()
          WHERE idagenda = $1
        `,
        [agendaId, clientId, acceptsFamily, slug],
      );
    }

    await replaceFaixasForAgenda(client, agendaId, clientId, faixas);

    const auditLogId = await registerOpsAuditLog(client, {
      origem: "ops-admin",
      acao: "client_trip_create",
      descricao: `Passeio ${agenda.dtagenda_fmt} vinculado ao cliente ${clientRow.nome}.`,
      motivo: "Vinculo de passeio no painel interno",
      usuarioNome: normalizeActorName(input.actor),
      detalhes: {
        agendaId,
        clientId,
        acceptsFamily,
        slug,
        faixas,
      },
    });

    await client.query("COMMIT");

    return {
      agendaId,
      clientId,
      auditLogId,
      message: "Passeio vinculado e faixas salvas com sucesso.",
    } satisfies OpsClientTripMutationResult;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function updateOpsClientTrip(input: OpsClientTripUpdateInput) {
  const agendaId = assertPositiveInteger(input.agendaId, "Informe uma agenda valida.");
  const clientId = assertPositiveInteger(input.clientId, "Informe um cliente valido.");
  const acceptsFamily = parseBooleanish(input.acceptsFamily);
  const faixas = normalizeFaixas(input.faixas);
  const pool = getIngressoDbPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const [agenda, extras] = await Promise.all([
      getAgendaById(client, agendaId),
      getAgendaExtras(client, agendaId, clientId, true),
    ]);

    if (!extras) {
      throw new OpsClientTripError(
        "client_trip_binding_not_found",
        "Vinculo cliente-agenda nao encontrado.",
        404,
      );
    }

    await client.query(
      `
        UPDATE agenda_extras
        SET aceita_familia = $3,
            atualizado_em = NOW()
        WHERE idagenda = $1
          AND idcliente = $2
      `,
      [agendaId, clientId, acceptsFamily],
    );

    await replaceFaixasForAgenda(client, agendaId, clientId, faixas);

    const auditLogId = await registerOpsAuditLog(client, {
      origem: "ops-admin",
      acao: "client_trip_update",
      descricao: `Passeio ${agenda.dtagenda_fmt} atualizado para o cliente ${clientId}.`,
      motivo: "Edicao de passeio no painel interno",
      usuarioNome: normalizeActorName(input.actor),
      detalhes: {
        agendaId,
        clientId,
        acceptsFamily,
        faixas,
      },
    });

    await client.query("COMMIT");

    return {
      agendaId,
      clientId,
      auditLogId,
      message: "Passeio atualizado com sucesso.",
    } satisfies OpsClientTripMutationResult;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function unlinkOpsClientTrip(input: OpsClientTripDeleteInput) {
  const agendaId = assertPositiveInteger(input.agendaId, "Informe uma agenda valida.");
  const clientId = assertPositiveInteger(input.clientId, "Informe um cliente valido.");
  const pool = getIngressoDbPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const extras = await getAgendaExtras(client, agendaId, clientId, true);

    if (!extras) {
      throw new OpsClientTripError(
        "client_trip_binding_not_found",
        "Vinculo nao encontrado.",
        404,
      );
    }

    await client.query(
      `
        UPDATE agenda_extras
        SET idcliente = NULL,
            atualizado_em = NOW()
        WHERE idagenda = $1
      `,
      [agendaId],
    );

    const auditLogId = await registerOpsAuditLog(client, {
      origem: "ops-admin",
      acao: "client_trip_unlink",
      descricao: `Passeio ${agendaId} desvinculado do cliente ${clientId}.`,
      motivo: "Desvinculo de passeio no painel interno",
      usuarioNome: normalizeActorName(input.actor),
      detalhes: {
        agendaId,
        clientId,
        slug: extras.slug,
      },
    });

    await client.query("COMMIT");

    return {
      agendaId,
      clientId,
      auditLogId,
      message: "Passeio desvinculado com sucesso.",
    } satisfies OpsClientTripMutationResult;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function moveOpsClientTripDate(input: OpsClientTripMoveDateInput) {
  const agendaId = assertPositiveInteger(input.agendaId, "Informe uma agenda valida.");
  const clientId = assertPositiveInteger(input.clientId, "Informe um cliente valido.");
  const nextDate = normalizeDateInput(input.tripDate);

  if (!nextDate) {
    throw new OpsClientTripError(
      "client_trip_invalid_date",
      "Data invalida (use dd/mm/aaaa).",
      400,
    );
  }

  const pool = getIngressoDbPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const currentAgenda = await getAgendaById(client, agendaId);
    const currentExtras = await getAgendaExtras(client, agendaId, clientId, true);

    if (!currentExtras) {
      throw new OpsClientTripError(
        "client_trip_binding_not_found",
        "Vinculo cliente-agenda nao encontrado.",
        404,
      );
    }

    if (currentAgenda.dtagenda === nextDate) {
      throw new OpsClientTripError(
        "client_trip_same_date",
        "A nova data e igual a data atual.",
        400,
      );
    }

    const [voucherExists, voucherHasAgendaId, voucherHasSchoolId, escolaDataExists] =
      await Promise.all([
        hasPublicTable(client, "voucher"),
        hasPublicColumn(client, "voucher", "idagenda"),
        hasPublicColumn(client, "voucher", "idescola"),
        hasPublicTable(client, "escoladata"),
      ]);

    let nextAgendaId = Number(
      (
        await client.query<{ idagenda: number }>(
          `
            SELECT idagenda
            FROM agenda
            WHERE dtagenda = $1
            LIMIT 1
          `,
          [nextDate],
        )
      ).rows[0]?.idagenda ?? 0,
    );

    if (nextAgendaId <= 0) {
      const insertAgenda = await client.query<{ idagenda: number }>(
        `
          INSERT INTO agenda (
            dtagenda,
            tpagenda,
            stagenda,
            idtabpreco,
            idinformacao,
            usucadastro,
            dtcadastro,
            hrcadastro
          )
          SELECT
            $2,
            a.tpagenda,
            a.stagenda,
            a.idtabpreco,
            a.idinformacao,
            0,
            CURRENT_DATE,
            CURRENT_TIME
          FROM agenda a
          WHERE a.idagenda = $1
          RETURNING idagenda
        `,
        [agendaId, nextDate],
      );

      nextAgendaId = Number(insertAgenda.rows[0]?.idagenda ?? 0);
    }

    if (nextAgendaId <= 0) {
      throw new OpsClientTripError(
        "client_trip_move_failed",
        "Nao foi possivel preparar a agenda da nova data.",
        502,
      );
    }

    const nextBinding = await getAgendaExtras(client, nextAgendaId, clientId, true);

    if (voucherExists && voucherHasAgendaId && voucherHasSchoolId) {
      await client.query(
        `
          UPDATE voucher
          SET idagenda = $3
          WHERE idagenda = $1
            AND idescola = $2
        `,
        [agendaId, clientId, nextAgendaId],
      );
    }

    if (!nextBinding) {
      await client.query(
        `
          INSERT INTO agenda_extras (
            idagenda,
            idcliente,
            aceita_familia,
            slug,
            foto,
            criado_em,
            atualizado_em
          ) VALUES ($1, $2, $3, $4, NULL, NOW(), NOW())
        `,
        [
          nextAgendaId,
          clientId,
          currentExtras.aceita_familia ? true : false,
          currentExtras.slug || buildRandomSlug(),
        ],
      );
    }

    const currentFaixas = await listFaixasForAgenda(client, agendaId, clientId);
    const nextFaixas = await listFaixasForAgenda(client, nextAgendaId, clientId);

    if (currentFaixas.length > 0 && nextFaixas.length === 0) {
      await replaceFaixasForAgenda(client, nextAgendaId, clientId, currentFaixas);
    }

    await client.query(
      `
        DELETE FROM agenda_extras
        WHERE idagenda = $1
          AND idcliente = $2
      `,
      [agendaId, clientId],
    );

    const [remainingBindings, remainingSchoolDates, remainingVouchers] = await Promise.all([
      client.query<{ total: string | number }>(
        `
          SELECT COUNT(*) AS total
          FROM agenda_extras
          WHERE idagenda = $1
        `,
        [agendaId],
      ),
      escolaDataExists
        ? client.query<{ total: string | number }>(
            `
              SELECT COUNT(*) AS total
              FROM escoladata
              WHERE idagenda = $1
            `,
            [agendaId],
          )
        : Promise.resolve({ rows: [{ total: 0 }] }),
      voucherExists && voucherHasAgendaId
        ? client.query<{ total: string | number }>(
            `
              SELECT COUNT(*) AS total
              FROM voucher
              WHERE idagenda = $1
            `,
            [agendaId],
          )
        : Promise.resolve({ rows: [{ total: 0 }] }),
    ]);

    if (
      Number(remainingBindings.rows[0]?.total ?? 0) === 0 &&
      Number(remainingSchoolDates.rows[0]?.total ?? 0) === 0 &&
      Number(remainingVouchers.rows[0]?.total ?? 0) === 0
    ) {
      const supportsClientId = await agendaFaixasHasClientColumn(client);

      if (!supportsClientId) {
        await client.query("DELETE FROM agenda_faixas WHERE idagenda = $1", [agendaId]);
      }

      await client.query("DELETE FROM agenda WHERE idagenda = $1", [agendaId]);
    }

    const auditLogId = await registerOpsAuditLog(client, {
      origem: "ops-admin",
      acao: "client_trip_move_date",
      descricao: `Passeio ${agendaId} movido para ${nextDate} para o cliente ${clientId}.`,
      motivo: "Alteracao de data do passeio no painel",
      usuarioNome: normalizeActorName(input.actor),
      detalhes: {
        previousAgendaId: agendaId,
        nextAgendaId,
        clientId,
        nextDate,
      },
    });

    await client.query("COMMIT");

    return {
      agendaId: nextAgendaId,
      clientId,
      auditLogId,
      message: "Data do passeio atualizada com sucesso.",
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export function asOpsClientTripError(error: unknown) {
  if (error instanceof OpsClientTripError) {
    return error;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23503"
  ) {
    return new OpsClientTripError(
      "client_trip_in_use",
      "Nao foi possivel concluir a operacao do passeio por causa de relacionamentos ativos.",
      409,
    );
  }

  return new OpsClientTripError(
    "client_trip_unavailable",
    "Nao foi possivel concluir a operacao de passeios agora.",
    502,
  );
}
