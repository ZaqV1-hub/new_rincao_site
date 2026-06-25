import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { getIngressoDbPool } from "@/lib/ingresso-db";
import {
  asOpsClientEducationError,
  getClientEducationSummary,
  listClientTypes,
  toggleClientStatus,
  type ClientStatusToggleInput,
} from "@/lib/ops-client-education";
import {
  buildSchoolClassDisplay,
  normalizeSchoolClassLetter,
  normalizeSchoolEducationType,
  normalizeSchoolEducationYear,
} from "@/lib/school-education";

type ClientListRow = {
  idcliente: number;
  idtipo: number | null;
  nome: string;
  status: boolean | string | null;
  tipo_nome: string | null;
};

type ClientCountRow = {
  total: string | number;
};

type ClientDetailRow = {
  idcliente: number;
  idtipo: number;
  nome: string;
  status: boolean | string | null;
  criado_em: string | null;
  atualizado_em: string | null;
  tipo_nome: string | null;
};

type ClientTripDateRow = {
  idagenda: number;
  dtagenda: string | null;
  status: string | null;
};

export type PainelClientesListFilters = {
  q?: string | string[] | undefined;
  idtipo?: string | string[] | undefined;
  status?: string | string[] | undefined;
  page?: string | string[] | undefined;
  per?: string | string[] | undefined;
};

export type PainelClientesListResult = {
  items: Array<{
    id: number;
    typeId: number | null;
    name: string;
    typeName: string | null;
    active: boolean;
  }>;
  page: number;
  per: number;
  total: number;
  start: number;
  end: number;
  pageCount: number;
  filters: {
    q: string;
    idtipo: string;
    status: string;
  };
  typeOptions: Awaited<ReturnType<typeof listClientTypes>>;
};

export type PainelClienteDetailResult = {
  client: {
    id: number;
    typeId: number;
    name: string;
    typeName: string | null;
    active: boolean;
    createdAt: string | null;
    updatedAt: string | null;
  };
  tripDates: Array<{
    agendaId: number;
    date: string | null;
    statusCode: string;
    statusLabel: string;
  }>;
  education: Awaited<ReturnType<typeof getClientEducationSummary>> | null;
};

export type PainelClienteMutationInput = {
  clientId?: unknown;
  values?: {
    idtipo?: unknown;
    nome?: unknown;
    status?: unknown;
  } | null;
};

type PainelClientTripDateMutationInput = {
  clientId?: unknown;
  agendaId?: unknown;
  actor?: {
    name?: string | null;
    cpf?: string | null;
  } | null;
  values?: {
    datapasseio?: unknown;
    status?: unknown;
  } | null;
};

type PainelTripSchoolLookupInput = {
  agendaId?: unknown;
};

type PainelTripSchoolDatesInput = {
  clientId?: unknown;
};

type PainelTripVoucherMutationInput = {
  voucherId?: unknown;
  actor?: {
    name?: string | null;
    cpf?: string | null;
  } | null;
  values?: {
    purchaseId?: unknown;
    studentName?: unknown;
    educationType?: unknown;
    educationYear?: unknown;
    classLetter?: unknown;
    schoolId?: unknown;
    agendaId?: unknown;
    value?: unknown;
    purchaseStatus?: unknown;
  } | null;
};

export class PainelClientesError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "PainelClientesError";
    this.code = code;
    this.status = status;
  }
}

function readSingleSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function normalizeSearchText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeClientName(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function parseBooleanish(value: boolean | string | null | undefined) {
  if (value === true || value === false) {
    return value;
  }

  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "true" || normalized === "t" || normalized === "1";
}

function normalizePositiveInteger(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function assertPositiveInteger(value: unknown, message: string) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new PainelClientesError("invalid_client_payload", message, 400);
  }

  return parsed;
}

function normalizeClientActive(value: unknown) {
  const normalized = String(value ?? "").trim().toLowerCase();

  if (normalized === "1" || normalized === "true" || normalized === "t" || normalized === "ativo") {
    return true;
  }

  if (normalized === "0" || normalized === "false" || normalized === "f" || normalized === "inativo") {
    return false;
  }

  return true;
}

function normalizeTripStatusLabel(status: string | null | undefined) {
  switch (String(status ?? "").trim().toLowerCase()) {
    case "ati":
      return "Ativo";
    case "ina":
      return "Inativo";
    case "enc":
      return "Encerrado";
    case "can":
      return "Cancelado";
    case "abe":
      return "Aberto";
    default:
      return String(status ?? "").trim() || "-";
  }
}

function normalizeActorName(actor: PainelClientTripDateMutationInput["actor"]) {
  return String(actor?.name ?? actor?.cpf ?? "").trim() || "system";
}

function parseDateToYmd(value: unknown) {
  const raw = String(value ?? "").trim();
  const match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (!match) {
    return null;
  }

  const [, dayRaw, monthRaw, yearRaw] = match;
  const day = Number(dayRaw);
  const month = Number(monthRaw);
  const year = Number(yearRaw);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return `${yearRaw}-${monthRaw}-${dayRaw}`;
}

function currentDateYmd() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeMoneyInput(value: unknown) {
  const raw = String(value ?? "").trim();

  if (!raw) {
    return Number.NaN;
  }

  const normalized = raw.replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

async function hasTable(client: PoolClient, tableName: string) {
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

async function hasColumn(client: PoolClient, tableName: string, columnName: string) {
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

async function buildAgendaCreatePayload(client: PoolClient, clientId: number) {
  const [latestClientAgenda, latestSystemAgenda] = await Promise.all([
    client.query<{
      tpagenda: string | null;
      idtabpreco: number | null;
    }>(
      `
        SELECT a.tpagenda, a.idtabpreco
        FROM agenda a
        JOIN agenda_extras ae ON ae.idagenda = a.idagenda
        WHERE ae.idcliente = $1
        ORDER BY a.idagenda DESC
        LIMIT 1
      `,
      [clientId],
    ),
    client.query<{
      tpagenda: string | null;
      idtabpreco: number | null;
      idinformacao: number | null;
    }>(
      `
        SELECT tpagenda, idtabpreco, idinformacao
        FROM agenda
        ORDER BY idagenda DESC
        LIMIT 1
      `,
    ),
  ]);

  const latestClient = latestClientAgenda.rows[0];
  const latestSystem = latestSystemAgenda.rows[0];
  const firstPriceTable = latestClient?.idtabpreco
    ? null
    : latestSystem?.idtabpreco
      ? null
      : await client.query<{ idtabpreco: number }>(
          `
            SELECT idtabpreco
            FROM tabpreco
            ORDER BY idtabpreco ASC
            LIMIT 1
          `,
        );

  const fallbackPriceTableId = Number(firstPriceTable?.rows[0]?.idtabpreco ?? 0);
  const resolvedPriceTableId =
    latestClient?.idtabpreco ??
    latestSystem?.idtabpreco ??
    (fallbackPriceTableId > 0 ? fallbackPriceTableId : null);

  return {
    tpagenda:
      String(latestClient?.tpagenda ?? latestSystem?.tpagenda ?? "").trim() || "padra",
    idtabpreco: resolvedPriceTableId,
    idinformacao: latestSystem?.idinformacao ?? 2,
  };
}

async function ensureAgendaForTripDate(
  client: PoolClient,
  clientId: number,
  tripDateYmd: string,
) {
  const existingAgenda = await client.query<{ idagenda: number }>(
    `
      SELECT idagenda
      FROM agenda
      WHERE dtagenda = $1
      LIMIT 1
    `,
    [tripDateYmd],
  );

  if (existingAgenda.rows[0]?.idagenda) {
    return Number(existingAgenda.rows[0].idagenda);
  }

  const payload = await buildAgendaCreatePayload(client, clientId);
  const insertResult = await client.query<{ idagenda: number }>(
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
      ) VALUES ($1, $2, 'abe', $3, $4, 0, CURRENT_DATE, CURRENT_TIME)
      RETURNING idagenda
    `,
    [tripDateYmd, payload.tpagenda, payload.idtabpreco, payload.idinformacao],
  );

  return Number(insertResult.rows[0]?.idagenda ?? 0);
}

async function ensureAgendaExtrasBinding(
  client: PoolClient,
  agendaId: number,
  clientId: number,
) {
  const binding = await client.query<{ idagenda: number }>(
    `
      SELECT idagenda
      FROM agenda_extras
      WHERE idagenda = $1
        AND idcliente = $2
      LIMIT 1
    `,
    [agendaId, clientId],
  );

  if (binding.rows[0]?.idagenda) {
    await client.query(
      `
        UPDATE agenda_extras
        SET atualizado_em = NOW()
        WHERE idagenda = $1
          AND idcliente = $2
      `,
      [agendaId, clientId],
    );
    return;
  }

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
    [agendaId, clientId, false, randomUUID().replaceAll("-", "")],
  );
}

async function seedAgendaFaixasForClient(
  client: PoolClient,
  agendaId: number,
  clientId: number,
) {
  if (!(await hasTable(client, "agenda_faixas"))) {
    return;
  }

  const hasClientColumn = await hasColumn(client, "agenda_faixas", "idcliente");
  const currentCount = await client.query<{ total: string | number }>(
    hasClientColumn
      ? `
          SELECT COUNT(*) AS total
          FROM agenda_faixas
          WHERE idagenda = $1
            AND idcliente = $2
        `
      : `
          SELECT COUNT(*) AS total
          FROM agenda_faixas
          WHERE idagenda = $1
        `,
    hasClientColumn ? [agendaId, clientId] : [agendaId],
  );

  if (Number(currentCount.rows[0]?.total ?? 0) > 0) {
    return;
  }

  const previousAgenda = await client.query<{ idagenda: number }>(
    `
      SELECT ae.idagenda
      FROM agenda_extras ae
      WHERE ae.idcliente = $1
        AND ae.idagenda <> $2
      ORDER BY ae.idagenda DESC
      LIMIT 1
    `,
    [clientId, agendaId],
  );
  const previousAgendaId = Number(previousAgenda.rows[0]?.idagenda ?? 0);

  if (previousAgendaId > 0) {
    if (hasClientColumn) {
      await client.query(
        `
          INSERT INTO agenda_faixas (idagenda, idade_min, idade_max, valor, idcliente)
          SELECT $1, idade_min, idade_max, valor, $2
          FROM agenda_faixas
          WHERE idagenda = $3
            AND (idcliente = $2 OR idcliente IS NULL)
        `,
        [agendaId, clientId, previousAgendaId],
      );
    } else {
      await client.query(
        `
          INSERT INTO agenda_faixas (idagenda, idade_min, idade_max, valor)
          SELECT $1, idade_min, idade_max, valor
          FROM agenda_faixas
          WHERE idagenda = $2
        `,
        [agendaId, previousAgendaId],
      );
    }
  }

  const seededCount = await client.query<{ total: string | number }>(
    hasClientColumn
      ? `
          SELECT COUNT(*) AS total
          FROM agenda_faixas
          WHERE idagenda = $1
            AND idcliente = $2
        `
      : `
          SELECT COUNT(*) AS total
          FROM agenda_faixas
          WHERE idagenda = $1
        `,
    hasClientColumn ? [agendaId, clientId] : [agendaId],
  );

  if (Number(seededCount.rows[0]?.total ?? 0) > 0) {
    return;
  }

  if (hasClientColumn) {
    await client.query(
      `
        INSERT INTO agenda_faixas (idagenda, idade_min, idade_max, valor, idcliente)
        VALUES
          ($1, 0, 5, 0.00, $2),
          ($1, 6, 12, 25.00, $2),
          ($1, 13, 17, 35.00, $2),
          ($1, 18, 59, 50.00, $2),
          ($1, 60, 120, 30.00, $2)
      `,
      [agendaId, clientId],
    );
  } else {
    await client.query(
      `
        INSERT INTO agenda_faixas (idagenda, idade_min, idade_max, valor)
        VALUES
          ($1, 0, 5, 0.00),
          ($1, 6, 12, 25.00),
          ($1, 13, 17, 35.00),
          ($1, 18, 59, 50.00),
          ($1, 60, 120, 30.00)
      `,
      [agendaId],
    );
  }
}

async function touchAgenda(client: PoolClient, agendaId: number) {
  const hasDtualt = await hasColumn(client, "agenda", "dtualt");
  const hasHrualt = await hasColumn(client, "agenda", "hrualt");

  if (!hasDtualt && !hasHrualt) {
    return;
  }

  const fields: string[] = [];

  if (hasDtualt) {
    fields.push("dtualt = CURRENT_DATE");
  }

  if (hasHrualt) {
    fields.push("hrualt = CURRENT_TIME");
  }

  await client.query(
    `
      UPDATE agenda
      SET ${fields.join(", ")}
      WHERE idagenda = $1
    `,
    [agendaId],
  );
}

function validateClientPayload(values: PainelClienteMutationInput["values"]) {
  const typeId = assertPositiveInteger(values?.idtipo, "Selecione o tipo do cliente.");
  const name = normalizeClientName(values?.nome);

  if (name.length === 0) {
    throw new PainelClientesError(
      "invalid_client_payload",
      "Informe o nome do cliente.",
      400,
    );
  }

  return {
    typeId,
    name,
    active: normalizeClientActive(values?.status),
  };
}

export function asPainelClientesError(error: unknown) {
  if (error instanceof PainelClientesError) {
    return {
      code: error.code,
      message: error.message,
      status: error.status,
    };
  }

  const fallback = asOpsClientEducationError(error);

  return {
    code: fallback.code,
    message: fallback.message,
    status: fallback.status,
  };
}

export async function listPainelClientes(
  filters: PainelClientesListFilters,
): Promise<PainelClientesListResult> {
  const q = normalizeSearchText(readSingleSearchValue(filters.q));
  const idtipo = readSingleSearchValue(filters.idtipo).trim();
  const status = readSingleSearchValue(filters.status).trim();
  const page = normalizePositiveInteger(readSingleSearchValue(filters.page), 1);
  const per = Math.min(
    100,
    Math.max(5, normalizePositiveInteger(readSingleSearchValue(filters.per), 20)),
  );
  const offset = (page - 1) * per;

  const where: string[] = [];
  const values: Array<string | number> = [];

  if (q !== "") {
    values.push(`%${q.toLowerCase()}%`);
    where.push(
      `lower(regexp_replace(translate(btrim(c.nome), E'\\u00A0', ' '), '\\s+', ' ', 'g')) LIKE $${values.length}`,
    );
  }

  if (idtipo !== "") {
    values.push(Number(idtipo));
    where.push(`c.idtipo = $${values.length}`);
  }

  if (status !== "") {
    values.push(status === "1" ? "true" : "false");
    where.push(`c.status = $${values.length}`);
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const pool = getIngressoDbPool();

  const [typeOptions, countResult, rowsResult] = await Promise.all([
    listClientTypes(),
    pool.query<ClientCountRow>(
      `
        SELECT COUNT(*) AS total
        FROM clientes c
        LEFT JOIN cliente_tipos t ON t.idtipo = c.idtipo
        ${whereSql}
      `,
      values,
    ),
    pool.query<ClientListRow>(
      `
        SELECT
          c.idcliente,
          c.idtipo,
          c.nome,
          c.status,
          t.nome AS tipo_nome
        FROM clientes c
        LEFT JOIN cliente_tipos t ON t.idtipo = c.idtipo
        ${whereSql}
        ORDER BY t.nome ASC NULLS LAST, c.nome ASC
        LIMIT $${values.length + 1}
        OFFSET $${values.length + 2}
      `,
      [...values, per, offset],
    ),
  ]);

  const total = Number(countResult.rows[0]?.total ?? 0);
  const start = total > 0 ? offset + 1 : 0;
  const end = total > 0 ? Math.min(total, offset + rowsResult.rows.length) : 0;

  return {
    items: rowsResult.rows.map((row) => ({
      id: Number(row.idcliente),
      typeId: row.idtipo == null ? null : Number(row.idtipo),
      name: row.nome,
      typeName: row.tipo_nome,
      active: parseBooleanish(row.status),
    })),
    page,
    per,
    total,
    start,
    end,
    pageCount: Math.max(1, Math.ceil(total / per)),
    filters: {
      q,
      idtipo,
      status,
    },
    typeOptions,
  };
}

export async function getPainelClientDetail(clientIdInput: unknown) {
  const clientId = assertPositiveInteger(clientIdInput, "Informe um cliente valido.");
  const pool = getIngressoDbPool();
  const client = await pool.connect();

  try {
    const detailResult = await client.query<ClientDetailRow>(
      `
        SELECT
          c.idcliente,
          c.idtipo,
          c.nome,
          c.status,
          c.criado_em,
          c.atualizado_em,
          t.nome AS tipo_nome
        FROM clientes c
        LEFT JOIN cliente_tipos t ON t.idtipo = c.idtipo
        WHERE c.idcliente = $1
        LIMIT 1
      `,
      [clientId],
    );

    const detail = detailResult.rows[0];

    if (!detail) {
      throw new PainelClientesError(
        "client_not_found",
        "Cliente nao encontrado.",
        404,
      );
    }

    const tripDatesResult = await client.query<ClientTripDateRow>(
      `
        SELECT
          a.idagenda,
          a.dtagenda::text AS dtagenda,
          COALESCE(ae.stagenda_cli, 'abe') AS status
        FROM agenda a
        JOIN agenda_extras ae ON ae.idagenda = a.idagenda
        WHERE ae.idcliente = $1
        ORDER BY a.dtagenda DESC, a.idagenda DESC
      `,
      [clientId],
    );

    let education: Awaited<ReturnType<typeof getClientEducationSummary>> | null = null;

    try {
      education = await getClientEducationSummary(clientId);
    } catch {
      education = null;
    }

    return {
      client: {
        id: Number(detail.idcliente),
        typeId: Number(detail.idtipo),
        name: detail.nome,
        typeName: detail.tipo_nome,
        active: parseBooleanish(detail.status),
        createdAt: detail.criado_em,
        updatedAt: detail.atualizado_em,
      },
      tripDates: tripDatesResult.rows.map((row) => ({
        agendaId: Number(row.idagenda),
        date: row.dtagenda,
        statusCode: String(row.status ?? "").trim(),
        statusLabel: normalizeTripStatusLabel(row.status),
      })),
      education:
        education && education.client.isSchool
          ? education
          : null,
    } satisfies PainelClienteDetailResult;
  } finally {
    client.release();
  }
}

export async function createPainelClient(input: PainelClienteMutationInput) {
  const payload = validateClientPayload(input.values);
  const pool = getIngressoDbPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const insertResult = await client.query<{ idcliente: number }>(
      `
        INSERT INTO clientes (
          idtipo,
          nome,
          status,
          criado_em
        ) VALUES ($1, $2, $3, NOW())
        RETURNING idcliente
      `,
      [payload.typeId, payload.name, payload.active ? "true" : "false"],
    );
    await client.query("COMMIT");

    return {
      clientId: Number(insertResult.rows[0]?.idcliente),
      message: "Cliente criado com sucesso.",
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    const code =
      typeof error === "object" && error && "code" in error
        ? String((error as { code?: unknown }).code ?? "")
        : "";

    if (code === "23505") {
      throw new PainelClientesError(
        "client_duplicate",
        "Ja existe um cliente com este nome para o tipo selecionado.",
        409,
      );
    }

    throw error;
  } finally {
    client.release();
  }
}

export async function updatePainelClient(input: PainelClienteMutationInput) {
  const clientId = assertPositiveInteger(input.clientId, "Informe um cliente valido.");
  const payload = validateClientPayload(input.values);
  const pool = getIngressoDbPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const updateResult = await client.query<{ idcliente: number }>(
      `
        UPDATE clientes
        SET
          idtipo = $2,
          nome = $3,
          status = $4,
          atualizado_em = NOW()
        WHERE idcliente = $1
        RETURNING idcliente
      `,
      [clientId, payload.typeId, payload.name, payload.active ? "true" : "false"],
    );

    if (!updateResult.rows[0]) {
      throw new PainelClientesError(
        "client_not_found",
        "Cliente nao encontrado.",
        404,
      );
    }

    await client.query("COMMIT");

    return {
      clientId,
      message: "Cliente atualizado com sucesso.",
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    const code =
      typeof error === "object" && error && "code" in error
        ? String((error as { code?: unknown }).code ?? "")
        : "";

    if (code === "23505") {
      throw new PainelClientesError(
        "client_duplicate",
        "Ja existe um cliente com este nome para o tipo selecionado.",
        409,
      );
    }

    throw error;
  } finally {
    client.release();
  }
}

export async function togglePainelClientStatus(input: ClientStatusToggleInput) {
  return toggleClientStatus(input);
}

export async function removePainelClient(input: {
  clientId?: unknown;
}) {
  const clientId = Number(input.clientId);

  if (!Number.isInteger(clientId) || clientId <= 0) {
    throw new PainelClientesError(
      "invalid_client_payload",
      "Informe um cliente valido.",
      400,
    );
  }

  const pool = getIngressoDbPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM clientes WHERE idcliente = $1", [clientId]);
    await client.query("COMMIT");

    return {
      clientId,
      message: "Cliente excluido com sucesso.",
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    const code =
      typeof error === "object" && error && "code" in error
        ? String((error as { code?: unknown }).code ?? "")
        : "";

    if (code === "23503") {
      throw new PainelClientesError(
        "client_delete_conflict",
        "Nao e possivel excluir: existem registros relacionados.",
        409,
      );
    }

    throw error;
  } finally {
    client.release();
  }
}

export async function addPainelClientTripDate(input: PainelClientTripDateMutationInput) {
  const clientId = assertPositiveInteger(input.clientId, "Cliente invalido.");
  const tripDateYmd = parseDateToYmd(input.values?.datapasseio);

  if (!tripDateYmd) {
    throw new PainelClientesError(
      "invalid_trip_date_payload",
      "Data invalida (use dd/mm/aaaa).",
      400,
    );
  }

  if (tripDateYmd < currentDateYmd()) {
    throw new PainelClientesError(
      "invalid_trip_date_payload",
      "Nao e permitido cadastrar data no passado.",
      400,
    );
  }

  const pool = getIngressoDbPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const agendaId = await ensureAgendaForTripDate(client, clientId, tripDateYmd);

    if (!agendaId) {
      throw new PainelClientesError(
        "trip_date_create_failed",
        "Nao foi possivel preparar a data do passeio.",
        502,
      );
    }

    await ensureAgendaExtrasBinding(client, agendaId, clientId);
    await seedAgendaFaixasForClient(client, agendaId, clientId);
    await touchAgenda(client, agendaId);
    await client.query("COMMIT");

    return {
      clientId,
      agendaId,
      message: "Data do passeio adicionada com sucesso.",
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function togglePainelClientTripDateStatus(
  input: PainelClientTripDateMutationInput,
) {
  const clientId = assertPositiveInteger(input.clientId, "Cliente invalido.");
  const agendaId = assertPositiveInteger(input.agendaId, "Agenda invalida.");
  const nextUiStatus = String(input.values?.status ?? "").trim().toLowerCase() === "ati"
    ? "ati"
    : "ina";
  const nextAgendaStatus = nextUiStatus === "ati" ? "abe" : "fec";
  const actorName = normalizeActorName(input.actor);
  const pool = getIngressoDbPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const binding = await client.query<{ idagenda: number }>(
      `
        SELECT idagenda
        FROM agenda_extras
        WHERE idagenda = $1
          AND idcliente = $2
        LIMIT 1
      `,
      [agendaId, clientId],
    );

    if (!binding.rows[0]?.idagenda) {
      throw new PainelClientesError(
        "trip_date_binding_not_found",
        "Vinculo cliente-data nao encontrado.",
        404,
      );
    }

    const hasDtualtCli = await hasColumn(client, "agenda_extras", "dtualt_cli");
    const hasHrualtCli = await hasColumn(client, "agenda_extras", "hrualt_cli");
    const hasUsualtCli = await hasColumn(client, "agenda_extras", "usualt_cli");
    const hasUpdatedAt = await hasColumn(client, "agenda_extras", "atualizado_em");
    const fields = [`stagenda_cli = $3`];

    if (hasDtualtCli) {
      fields.push("dtualt_cli = CURRENT_DATE");
    }

    if (hasHrualtCli) {
      fields.push("hrualt_cli = CURRENT_TIME");
    }

    if (hasUsualtCli) {
      fields.push("usualt_cli = $4");
    }

    if (hasUpdatedAt) {
      fields.push("atualizado_em = NOW()");
    }

    await client.query(
      `
        UPDATE agenda_extras
        SET ${fields.join(", ")}
        WHERE idagenda = $1
          AND idcliente = $2
      `,
      hasUsualtCli
        ? [agendaId, clientId, nextAgendaStatus, actorName]
        : [agendaId, clientId, nextAgendaStatus],
    );

    await client.query("COMMIT");

    return {
      clientId,
      agendaId,
      status: nextUiStatus,
      message:
        nextUiStatus === "ati"
          ? "Data do passeio ativada com sucesso."
          : "Data do passeio inativada com sucesso.",
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function removePainelClientTripDate(input: PainelClientTripDateMutationInput) {
  const clientId = assertPositiveInteger(input.clientId, "Cliente invalido.");
  const agendaId = assertPositiveInteger(input.agendaId, "Agenda invalida.");
  const pool = getIngressoDbPool();
  const client = await pool.connect();

  try {
    const [voucherExists, escolaDataExists, agendaFaixasExists] = await Promise.all([
      hasTable(client, "voucher"),
      hasTable(client, "escoladata"),
      hasTable(client, "agenda_faixas"),
    ]);

    const [voucherHasAgendaId, voucherHasSchoolId, agendaFaixasHasClientId] = await Promise.all([
      voucherExists ? hasColumn(client, "voucher", "idagenda") : Promise.resolve(false),
      voucherExists ? hasColumn(client, "voucher", "idescola") : Promise.resolve(false),
      agendaFaixasExists ? hasColumn(client, "agenda_faixas", "idcliente") : Promise.resolve(false),
    ]);

    await client.query("BEGIN");
    const binding = await client.query<{ exists: number }>(
      `
        SELECT 1 AS exists
        FROM agenda_extras
        WHERE idagenda = $1
          AND idcliente = $2
        LIMIT 1
      `,
      [agendaId, clientId],
    );

    if (!binding.rows[0]?.exists) {
      throw new PainelClientesError(
        "trip_date_binding_not_found",
        "Vinculo cliente-agenda nao encontrado.",
        404,
      );
    }

    let totalVouchers = 0;
    let clientVouchers = 0;

    if (voucherExists && voucherHasAgendaId) {
      const totalVoucherResult = await client.query<{ total: string | number }>(
        `
          SELECT COUNT(*) AS total
          FROM voucher
          WHERE idagenda = $1
        `,
        [agendaId],
      );
      totalVouchers = Number(totalVoucherResult.rows[0]?.total ?? 0);

      if (voucherHasSchoolId) {
        const clientVoucherResult = await client.query<{ total: string | number }>(
          `
            SELECT COUNT(*) AS total
            FROM voucher
            WHERE idagenda = $1
              AND idescola = $2
          `,
          [agendaId, clientId],
        );
        clientVouchers = Number(clientVoucherResult.rows[0]?.total ?? 0);
      }
    }

    if (clientVouchers > 0) {
      throw new PainelClientesError(
        "trip_date_delete_conflict",
        "Nao e possivel remover: existem ingressos para este cliente nesta data.",
        409,
      );
    }

    await client.query(
      `
        DELETE FROM agenda_extras
        WHERE idagenda = $1
          AND idcliente = $2
      `,
      [agendaId, clientId],
    );

    if (agendaFaixasExists) {
      await client.query(
        agendaFaixasHasClientId
          ? `
              DELETE FROM agenda_faixas
              WHERE idagenda = $1
                AND idcliente = $2
            `
          : `
              DELETE FROM agenda_faixas
              WHERE idagenda = $1
            `,
        agendaFaixasHasClientId ? [agendaId, clientId] : [agendaId],
      );
    }

    if (totalVouchers > 0) {
      await client.query("COMMIT");
      return {
        clientId,
        agendaId,
        message: "Vinculo removido. Agenda mantida porque ha ingressos nesta data.",
      };
    }

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
      if (agendaFaixasExists && !agendaFaixasHasClientId) {
        await client.query("DELETE FROM agenda_faixas WHERE idagenda = $1", [agendaId]);
      }

      await client.query("DELETE FROM agenda WHERE idagenda = $1", [agendaId]);
    }

    await client.query("COMMIT");

    return {
      clientId,
      agendaId,
      message: "Data do passeio removida com sucesso.",
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function listPainelTripSchools(input: PainelTripSchoolLookupInput) {
  const agendaId = assertPositiveInteger(input.agendaId, "Agenda invalida.");
  const pool = getIngressoDbPool();
  const result = await pool.query<{ idcliente: number; nome: string }>(
    `
      SELECT c.idcliente, c.nome
      FROM agenda_extras ae
      JOIN clientes c ON c.idcliente = ae.idcliente
      WHERE ae.idagenda = $1
      ORDER BY c.nome ASC
    `,
    [agendaId],
  );

  return {
    schools: result.rows.map((row) => ({
      clientId: Number(row.idcliente),
      name: row.nome,
    })),
  };
}

export async function listPainelTripSchoolDates(input: PainelTripSchoolDatesInput) {
  const clientId = assertPositiveInteger(input.clientId, "Cliente invalido.");
  const pool = getIngressoDbPool();
  const result = await pool.query<{ idagenda: number; dtagenda_fmt: string }>(
    `
      SELECT a.idagenda, to_char(a.dtagenda, 'DD/MM/YYYY') AS dtagenda_fmt
      FROM agenda_extras ae
      JOIN agenda a ON a.idagenda = ae.idagenda
      WHERE ae.idcliente = $1
      ORDER BY a.dtagenda DESC
    `,
    [clientId],
  );

  return {
    dates: result.rows.map((row) => ({
      agendaId: Number(row.idagenda),
      dateLabel: row.dtagenda_fmt,
    })),
  };
}

export async function updatePainelTripVoucherStudent(
  input: PainelTripVoucherMutationInput,
) {
  const voucherId = assertPositiveInteger(input.voucherId, "Voucher invalido.");
  const purchaseId = assertPositiveInteger(
    input.values?.purchaseId,
    "Compra invalida.",
  );
  const studentName = normalizeClientName(input.values?.studentName);
  const schoolId = assertPositiveInteger(input.values?.schoolId, "Escola invalida.");
  const agendaId = assertPositiveInteger(input.values?.agendaId, "Agenda invalida.");
  const educationType = normalizeSchoolEducationType(
    String(input.values?.educationType ?? ""),
  );
  const educationYear = normalizeSchoolEducationYear(
    String(input.values?.educationType ?? ""),
    String(input.values?.educationYear ?? ""),
  );
  const classLetter = normalizeSchoolClassLetter(
    String(input.values?.classLetter ?? ""),
  );
  const purchaseStatus = String(input.values?.purchaseStatus ?? "")
    .trim()
    .toLowerCase();
  const value = normalizeMoneyInput(input.values?.value);

  if (!studentName) {
    throw new PainelClientesError(
      "invalid_trip_voucher_payload",
      "Informe o nome do aluno.",
      400,
    );
  }

  if (!educationType) {
    throw new PainelClientesError(
      "invalid_trip_voucher_payload",
      "Tipo de ensino invalido.",
      400,
    );
  }

  if (!educationYear) {
    throw new PainelClientesError(
      "invalid_trip_voucher_payload",
      "Ano invalido para o tipo de ensino.",
      400,
    );
  }

  if (!classLetter) {
    throw new PainelClientesError(
      "invalid_trip_voucher_payload",
      "Turma invalida.",
      400,
    );
  }

  if (!Number.isFinite(value) || value < 0) {
    throw new PainelClientesError(
      "invalid_trip_voucher_payload",
      "Valor invalido.",
      400,
    );
  }

  if (!["conc", "pago", "paid", "pend", "canc"].includes(purchaseStatus)) {
    throw new PainelClientesError(
      "invalid_trip_voucher_payload",
      "Status da compra invalido.",
      400,
    );
  }

  const pool = getIngressoDbPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const voucherResult = await client.query<{
      idcompra: number;
      tpparticipante: string | null;
      tpvoucher: string | null;
    }>(
      `
        SELECT idcompra, tpparticipante, tpvoucher
        FROM voucher
        WHERE idvoucher = $1
        LIMIT 1
      `,
      [voucherId],
    );
    const voucher = voucherResult.rows[0] ?? null;

    if (!voucher) {
      throw new PainelClientesError(
        "trip_voucher_not_found",
        "Voucher nao encontrado.",
        404,
      );
    }

    if (Number(voucher.idcompra) !== purchaseId) {
      throw new PainelClientesError(
        "invalid_trip_voucher_payload",
        "Compra nao confere com o voucher.",
        400,
      );
    }

    if (String(voucher.tpparticipante ?? "").trim().toLowerCase() === "educador") {
      throw new PainelClientesError(
        "invalid_trip_voucher_payload",
        "Este voucher nao e de aluno.",
        400,
      );
    }

    if (String(voucher.tpvoucher ?? "").trim().toLowerCase() !== "escol") {
      throw new PainelClientesError(
        "invalid_trip_voucher_payload",
        "Voucher nao e escolar.",
        400,
      );
    }

    const bindingResult = await client.query<{ exists: number }>(
      `
        SELECT 1 AS exists
        FROM agenda_extras
        WHERE idcliente = $1
          AND idagenda = $2
        LIMIT 1
      `,
      [schoolId, agendaId],
    );

    if (!bindingResult.rows[0]?.exists) {
      throw new PainelClientesError(
        "trip_voucher_binding_not_found",
        "Passeio nao encontrado para a escola/data informada.",
        404,
      );
    }

    await client.query(
      `
        UPDATE voucher
        SET
          nomealuno = $2,
          ensino_tipo = $3,
          ensino_ano = $4,
          turma_letra = $5,
          turma = $6,
          periodo = '',
          idescola = $7,
          idagenda = $8,
          vlunicompra = $9
        WHERE idvoucher = $1
      `,
      [
        voucherId,
        studentName,
        educationType,
        educationYear,
        classLetter,
        buildSchoolClassDisplay(educationType, educationYear, classLetter),
        schoolId,
        agendaId,
        value,
      ],
    );

    await client.query(
      `
        UPDATE compra
        SET stcompra = $2
        WHERE idcompra = $1
      `,
      [purchaseId, purchaseStatus],
    );

    await client.query(
      `
        UPDATE compra
        SET vltotcompra = (
          SELECT COALESCE(SUM(vlunicompra), 0)
          FROM voucher
          WHERE idcompra = $1
        )
        WHERE idcompra = $1
      `,
      [purchaseId],
    );

    await client.query("COMMIT");

    return {
      voucherId,
      purchaseId,
      message: "Aluno atualizado com sucesso.",
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
