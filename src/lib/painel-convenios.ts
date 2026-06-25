export type PainelConvenioListFilters = {
  name: string | null;
  status: string | null;
  priceTableId: string | null;
  periodFrom: string | null;
  periodTo: string | null;
  page: number;
  perPage: number;
};

export type PainelConvenioPriceTableOption = {
  id: number;
  name: string;
};

export type PainelConvenioListItem = {
  id: number;
  name: string;
  priceTableId: number | null;
  priceTableName: string | null;
  startDate: string | null;
  endDate: string | null;
  statusCode: "ati" | "ina" | string | null;
  statusLabel: string;
};

export type PainelConvenioListResult = {
  items: PainelConvenioListItem[];
  filters: PainelConvenioListFilters;
  page: number;
  perPage: number;
  total: number;
  pageCount: number;
  start: number;
  end: number;
  priceTableOptions: PainelConvenioPriceTableOption[];
};

export type PainelConvenioDetail = {
  id: number;
  name: string;
  startDate: string | null;
  endDate: string | null;
  priceTableId: number | null;
  priceTableName: string | null;
  statusCode: string | null;
  statusLabel: string;
  totalMembers: number;
  activeMembers: number;
  inactiveMembers: number;
  createdAt: string | null;
};

export type PainelConvenioFormValues = {
  nmconvenio: string;
  dtini: string;
  dtfim: string;
  idtabpreco: string;
};

export class PainelConveniosError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "PainelConveniosError";
    this.code = code;
    this.status = status;
  }
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function parsePositiveInteger(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseDate(value: unknown) {
  const raw = normalizeText(value);
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const brMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const normalized = isoMatch
    ? raw
    : brMatch
      ? `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`
      : "";

  if (!normalized) {
    return null;
  }

  const date = new Date(`${normalized}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== normalized) {
    return null;
  }

  return normalized;
}

function formatDateLabel(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = new Date(`${String(value).slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatStatusLabel(status: string | null | undefined) {
  return status === "ati" ? "Ativo" : status === "ina" ? "Inativo" : "-";
}

export function decodeLegacyAgreementId(encoded: string) {
  try {
    const decoded = Buffer.from(encoded, "base64").toString("utf8");
    const agreementId = Number(decoded);
    return Number.isInteger(agreementId) && agreementId > 0 ? agreementId : null;
  } catch {
    return null;
  }
}

export function normalizePainelConvenioListFilters(
  input: Record<string, unknown>,
): PainelConvenioListFilters {
  const rawName = normalizeText(input.nmconvenio);
  const rawStatus = normalizeText(input.stconvenio);
  const rawPriceTableId = normalizeText(input.idtabpreco);

  return {
    name: rawName ? rawName : null,
    status: rawStatus && rawStatus !== "-1" ? rawStatus : null,
    priceTableId:
      rawPriceTableId && rawPriceTableId !== "-1" ? rawPriceTableId : null,
    periodFrom: normalizeText(input["periodo[de]"]) || null,
    periodTo: normalizeText(input["periodo[ate]"]) || null,
    page: parsePositiveInteger(input.page, 1),
    perPage: parsePositiveInteger(input.pp, 30),
  };
}

function mapConvenioRow(row: {
  idconvenio: number;
  nmconvenio: string | null;
  idtabpreco: number | null;
  nmtabpreco: string | null;
  dtini: string | null;
  dtfim: string | null;
  stconvenio: string | null;
}): PainelConvenioListItem {
  return {
    id: Number(row.idconvenio),
    name: row.nmconvenio ?? "-",
    priceTableId: row.idtabpreco != null ? Number(row.idtabpreco) : null,
    priceTableName: row.nmtabpreco,
    startDate: formatDateLabel(row.dtini),
    endDate: formatDateLabel(row.dtfim),
    statusCode: row.stconvenio,
    statusLabel: formatStatusLabel(row.stconvenio),
  };
}

export function validateAgreementActivation(input: {
  status: string;
  endDate: string | null;
  today?: string;
}) {
  if (input.status !== "ati") {
    return;
  }

  const today = input.today ?? new Date().toISOString().slice(0, 10);
  if (input.endDate && input.endDate < today) {
    throw new PainelConveniosError(
      "agreement_activation_period_invalid",
      "Data de vigencia invalida. Favor, altere a data para ativar o convenio.",
      422,
    );
  }
}

export function validatePainelConvenioForm(input: PainelConvenioFormValues) {
  if (!normalizeText(input.nmconvenio)) {
    throw new PainelConveniosError(
      "invalid_agreement_form",
      "Nome obrigatorio.",
      422,
    );
  }

  const startDate = parseDate(input.dtini);
  const endDate = parseDate(input.dtfim);
  const priceTableId = Number(input.idtabpreco);

  if (!startDate) {
    throw new PainelConveniosError(
      "invalid_agreement_form",
      "Data inicio obrigatoria.",
      422,
    );
  }

  if (!endDate) {
    throw new PainelConveniosError(
      "invalid_agreement_form",
      "Data fim obrigatoria.",
      422,
    );
  }

  if (!Number.isInteger(priceTableId) || priceTableId <= 0) {
    throw new PainelConveniosError(
      "invalid_agreement_form",
      "Tabela de preco obrigatoria.",
      422,
    );
  }

  if (endDate < startDate) {
    throw new PainelConveniosError(
      "invalid_agreement_form",
      "Data fim deve ser maior ou igual a data inicio.",
      422,
    );
  }

  return {
    nmconvenio: normalizeText(input.nmconvenio),
    dtini: startDate,
    dtfim: endDate,
    idtabpreco: priceTableId,
  };
}

export async function listPainelConvenioPriceTableOptions(
  currentPriceTableId?: number | null,
) {
  const { getIngressoDbPool } = await import("@/lib/ingresso-db");
  const pool = getIngressoDbPool();
  const where =
    currentPriceTableId && Number.isInteger(currentPriceTableId)
      ? `WHERE sttabpreco != 'ina' OR idtabpreco = $1`
      : `WHERE sttabpreco != 'ina'`;
  const values =
    currentPriceTableId && Number.isInteger(currentPriceTableId)
      ? [currentPriceTableId]
      : [];

  const result = await pool.query<{ idtabpreco: number; nmtabpreco: string }>(
    `
      SELECT idtabpreco, nmtabpreco
      FROM tabpreco
      ${where}
      ORDER BY nmtabpreco ASC
    `,
    values,
  );

  return result.rows.map((row) => ({
    id: Number(row.idtabpreco),
    name: row.nmtabpreco,
  }));
}

function buildPainelConveniosWhere(filters: PainelConvenioListFilters) {
  const clauses: string[] = [];
  const values: Array<string | number> = [];

  if (filters.name) {
    values.push(`%${filters.name}%`);
    clauses.push(`convenio.nmconvenio ILIKE $${values.length}`);
  }

  if (filters.status) {
    values.push(filters.status);
    clauses.push(`convenio.stconvenio = $${values.length}`);
  }

  if (filters.priceTableId) {
    values.push(Number(filters.priceTableId));
    clauses.push(`convenio.idtabpreco = $${values.length}`);
  }

  const periodFrom = filters.periodFrom ? parseDate(filters.periodFrom) : null;
  const periodTo = filters.periodTo ? parseDate(filters.periodTo) : null;

  if (filters.periodFrom && !periodFrom) {
    throw new PainelConveniosError(
      "invalid_convenio_filter",
      "Informe uma data inicial valida para o periodo.",
      400,
    );
  }

  if (filters.periodTo && !periodTo) {
    throw new PainelConveniosError(
      "invalid_convenio_filter",
      "Informe uma data final valida para o periodo.",
      400,
    );
  }

  if (periodFrom) {
    values.push(periodFrom);
    clauses.push(`convenio.dtini >= $${values.length}::date`);
  }

  if (periodTo) {
    values.push(periodTo);
    clauses.push(`convenio.dtfim <= $${values.length}::date`);
  }

  return {
    values,
    where: clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "",
  };
}

export async function listPainelConvenios(input: {
  filters?: Record<string, unknown>;
  page?: unknown;
}) {
  const { getIngressoDbPool } = await import("@/lib/ingresso-db");
  const filters = normalizePainelConvenioListFilters({
    ...(input.filters ?? {}),
    page: input.page ?? (input.filters?.page as unknown),
  });
  const { where, values } = buildPainelConveniosWhere(filters);
  const limit = filters.perPage;
  const offset = (filters.page - 1) * filters.perPage;
  const pool = getIngressoDbPool();

  const [listResult, countResult, tablesResult] = await Promise.all([
    pool.query<{
      idconvenio: number;
      nmconvenio: string | null;
      idtabpreco: number | null;
      nmtabpreco: string | null;
      dtini: string | null;
      dtfim: string | null;
      stconvenio: string | null;
    }>(
      `
        SELECT
          convenio.idconvenio,
          convenio.nmconvenio,
          convenio.idtabpreco,
          tabpreco.nmtabpreco,
          convenio.dtini,
          convenio.dtfim,
          convenio.stconvenio
        FROM convenio
        LEFT JOIN tabpreco ON tabpreco.idtabpreco = convenio.idtabpreco
        ${where}
        ORDER BY convenio.nmconvenio ASC
        LIMIT $${values.length + 1}
        OFFSET $${values.length + 2}
      `,
      [...values, limit, offset],
    ),
    pool.query<{ total: string }>(
      `
        SELECT COUNT(*)::text AS total
        FROM convenio
        ${where}
      `,
      values,
    ),
    pool.query<{ idtabpreco: number; nmtabpreco: string }>(
      `
        SELECT idtabpreco, nmtabpreco
        FROM tabpreco
        WHERE sttabpreco != 'ina'
        ORDER BY nmtabpreco ASC
      `,
    ),
  ]);

  const total = Number(countResult.rows[0]?.total ?? 0);
  const items = listResult.rows.map(mapConvenioRow);
  const start = total === 0 ? 0 : offset + 1;
  const end = total === 0 ? 0 : offset + items.length;

  return {
    items,
    filters,
    page: filters.page,
    perPage: filters.perPage,
    total,
    pageCount: Math.max(1, Math.ceil(total / filters.perPage)),
    start,
    end,
    priceTableOptions: tablesResult.rows.map((row) => ({
      id: Number(row.idtabpreco),
      name: row.nmtabpreco,
    })),
  } satisfies PainelConvenioListResult;
}

export async function togglePainelConvenioStatus(input: {
  agreementId: unknown;
  status: unknown;
}) {
  const { getIngressoDbPool } = await import("@/lib/ingresso-db");
  const agreementId = Number(input.agreementId);
  const nextStatus = normalizeText(input.status);

  if (!Number.isInteger(agreementId) || agreementId <= 0) {
    throw new PainelConveniosError(
      "invalid_agreement_id",
      "Informe um convenio valido.",
      400,
    );
  }

  if (nextStatus !== "ati" && nextStatus !== "ina") {
    throw new PainelConveniosError(
      "invalid_agreement_status",
      "Informe um status valido para o convenio.",
      400,
    );
  }

  const pool = getIngressoDbPool();
  const currentResult = await pool.query<{
    idconvenio: number;
    nmconvenio: string | null;
    dtfim: string | null;
    stconvenio: string | null;
  }>(
    `
      SELECT idconvenio, nmconvenio, dtfim, stconvenio
      FROM convenio
      WHERE idconvenio = $1
      LIMIT 1
    `,
    [agreementId],
  );

  const current = currentResult.rows[0];
  if (!current) {
    throw new PainelConveniosError(
      "agreement_not_found",
      "Convenio nao encontrado.",
      404,
    );
  }

  validateAgreementActivation({
    status: nextStatus,
    endDate: current.dtfim ? String(current.dtfim).slice(0, 10) : null,
  });

  await pool.query(
    `
      UPDATE convenio
      SET stconvenio = $1
      WHERE idconvenio = $2
    `,
    [nextStatus, agreementId],
  );

  return {
    agreementId,
    message:
      nextStatus === "ati"
        ? "Convenio ativado com sucesso."
        : "Convenio inativado com sucesso.",
  };
}

export async function getPainelConvenioDetail(agreementIdInput: unknown) {
  const { getIngressoDbPool } = await import("@/lib/ingresso-db");
  const agreementId = Number(agreementIdInput);

  if (!Number.isInteger(agreementId) || agreementId <= 0) {
    throw new PainelConveniosError(
      "invalid_agreement_id",
      "Informe um convenio valido.",
      400,
    );
  }

  const pool = getIngressoDbPool();
  const result = await pool.query<{
    idconvenio: number;
    nmconvenio: string | null;
    dtini: string | null;
    dtfim: string | null;
    stconvenio: string | null;
    idtabpreco: number | null;
    nmtabpreco: string | null;
    qtdconveniadoati: string | number | null;
    qtdconveniadoina: string | number | null;
    dtcadastro: string | null;
  }>(
    `
      SELECT
        convenio.idconvenio,
        convenio.nmconvenio,
        convenio.dtini,
        convenio.dtfim,
        convenio.stconvenio,
        convenio.idtabpreco,
        tabpreco.nmtabpreco,
        COALESCE(SUM(CASE WHEN conveniado.stconveniado = 'ati' THEN 1 ELSE 0 END), 0) AS qtdconveniadoati,
        COALESCE(SUM(CASE WHEN conveniado.stconveniado = 'ina' THEN 1 ELSE 0 END), 0) AS qtdconveniadoina,
        convenio.dtcadastro
      FROM convenio
      LEFT JOIN tabpreco ON tabpreco.idtabpreco = convenio.idtabpreco
      LEFT JOIN conveniado ON conveniado.idconvenio = convenio.idconvenio
      WHERE convenio.idconvenio = $1
      GROUP BY
        convenio.idconvenio,
        convenio.nmconvenio,
        convenio.dtini,
        convenio.dtfim,
        convenio.stconvenio,
        convenio.idtabpreco,
        tabpreco.nmtabpreco,
        convenio.dtcadastro
      LIMIT 1
    `,
    [agreementId],
  );

  const row = result.rows[0];
  if (!row) {
    throw new PainelConveniosError(
      "agreement_not_found",
      "Convenio nao encontrado.",
      404,
    );
  }

  const activeMembers = Number(row.qtdconveniadoati ?? 0);
  const inactiveMembers = Number(row.qtdconveniadoina ?? 0);

  return {
    id: Number(row.idconvenio),
    name: row.nmconvenio ?? "-",
    startDate: formatDateLabel(row.dtini),
    endDate: formatDateLabel(row.dtfim),
    priceTableId: row.idtabpreco != null ? Number(row.idtabpreco) : null,
    priceTableName: row.nmtabpreco,
    statusCode: row.stconvenio,
    statusLabel: formatStatusLabel(row.stconvenio),
    totalMembers: activeMembers + inactiveMembers,
    activeMembers,
    inactiveMembers,
    createdAt: formatDateLabel(row.dtcadastro),
  } satisfies PainelConvenioDetail;
}

export async function createPainelConvenio(input: { values: PainelConvenioFormValues }) {
  const { getIngressoDbPool } = await import("@/lib/ingresso-db");
  const values = validatePainelConvenioForm(input.values);
  const pool = getIngressoDbPool();

  const result = await pool.query<{ idconvenio: number }>(
    `
      INSERT INTO convenio (
        nmconvenio,
        dtini,
        dtfim,
        idtabpreco,
        stconvenio
      ) VALUES ($1, $2, $3, $4, 'ati')
      RETURNING idconvenio
    `,
    [values.nmconvenio, values.dtini, values.dtfim, values.idtabpreco],
  );

  return {
    agreementId: Number(result.rows[0]?.idconvenio ?? 0),
    message: "Convenio criado com sucesso.",
  };
}

export async function updatePainelConvenio(input: {
  agreementId: unknown;
  values: PainelConvenioFormValues;
}) {
  const { getIngressoDbPool } = await import("@/lib/ingresso-db");
  const agreementId = Number(input.agreementId);
  if (!Number.isInteger(agreementId) || agreementId <= 0) {
    throw new PainelConveniosError(
      "invalid_agreement_id",
      "Informe um convenio valido.",
      400,
    );
  }

  const values = validatePainelConvenioForm(input.values);
  const pool = getIngressoDbPool();

  await pool.query(
    `
      UPDATE convenio
      SET
        nmconvenio = $1,
        dtini = $2,
        dtfim = $3,
        idtabpreco = $4
      WHERE idconvenio = $5
    `,
    [values.nmconvenio, values.dtini, values.dtfim, values.idtabpreco, agreementId],
  );

  return {
    agreementId,
    message: "Convenio atualizado com sucesso.",
  };
}

export async function removePainelConvenio(input: { agreementId: unknown }) {
  const { getIngressoDbPool } = await import("@/lib/ingresso-db");
  const agreementId = Number(input.agreementId);

  if (!Number.isInteger(agreementId) || agreementId <= 0) {
    throw new PainelConveniosError(
      "invalid_agreement_id",
      "Informe um convenio valido.",
      400,
    );
  }

  const pool = getIngressoDbPool();

  try {
    await pool.query(`DELETE FROM convenio WHERE idconvenio = $1`, [agreementId]);
  } catch {
    throw new PainelConveniosError(
      "agreement_remove_blocked",
      "Nao e possivel realizar esta operacao. O convenio possui relacionamentos no sistema.",
      409,
    );
  }

  return {
    agreementId,
    message: "Convenio removido com sucesso.",
  };
}

export function asPainelConveniosError(error: unknown) {
  if (error instanceof PainelConveniosError) {
    return error;
  }

  return new PainelConveniosError(
    "agreement_unavailable",
    "Nao foi possivel concluir a operacao de convenio agora.",
    500,
  );
}
