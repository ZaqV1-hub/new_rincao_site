import type { PoolClient } from "pg";
import { getIngressoDbPool } from "@/lib/ingresso-db";
import { registerOpsAuditLog } from "@/lib/ops-audit-log";

type ClientEducationActor = {
  name?: string | null;
  cpf?: string | null;
};

export type ClientTypeOption = {
  id: number;
  name: string;
};

export type ClientAutocompleteItem = {
  id: number;
  text: string;
  name: string;
  typeId: number | null;
  typeName: string | null;
};

export type ClientPeriodItem = {
  id: number;
  classId: number;
  name: string;
  order: number;
  status: "ati" | "ina";
};

export type ClientClassItem = {
  id: number;
  clientId: number;
  name: string;
  order: number;
  status: "ati" | "ina";
  periods: ClientPeriodItem[];
};

export type ClientEducationSummary = {
  client: {
    id: number;
    name: string;
    typeId: number;
    typeName: string | null;
    isSchool: boolean;
    active: boolean;
  };
  standardPeriodOptions: Array<{
    slug: string;
    name: string;
    order: number;
  }>;
  classes: ClientClassItem[];
};

export type ClientStatusToggleInput = {
  clientId?: unknown;
  reason?: string | null;
  actor?: ClientEducationActor | null;
};

export type ClientStatusToggleResult = {
  clientId: number;
  active: boolean;
  auditLogId: number | null;
  message: string;
};

export type ClientClassMutationInput = {
  clientId?: unknown;
  id?: unknown;
  reason?: string | null;
  actor?: ClientEducationActor | null;
  values?: {
    name?: unknown;
    order?: unknown;
    status?: unknown;
    defaultPeriods?: unknown;
  } | null;
};

export type ClientPeriodMutationInput = {
  clientId?: unknown;
  classId?: unknown;
  id?: unknown;
  reason?: string | null;
  actor?: ClientEducationActor | null;
  values?: {
    name?: unknown;
    order?: unknown;
    status?: unknown;
  } | null;
};

export type ClientClassMutationResult = {
  clientId: number;
  id: number;
  action: "create" | "update" | "delete";
  item: ClientClassItem | null;
  auditLogId: number | null;
  message: string;
};

export type ClientPeriodMutationResult = {
  clientId: number;
  classId: number;
  id: number;
  action: "create" | "update" | "delete";
  item: ClientPeriodItem | null;
  auditLogId: number | null;
  message: string;
};

type ClientRow = {
  idcliente: number;
  nome: string;
  status: boolean | string | null;
  idtipo: number;
  tipo_nome: string | null;
};

type ClientClassRow = {
  idturma: number;
  idcliente: number;
  nome: string;
  ordem: number | string | null;
  status: string | null;
};

type ClientPeriodRow = {
  idperiodo: number;
  idturma: number;
  nome: string;
  ordem: number | string | null;
  status: string | null;
};

type StandardPeriodDefinition = {
  slug: string;
  name: string;
  order: number;
};

const standardPeriodDefinitions: StandardPeriodDefinition[] = [
  { slug: "manha", name: "Manha", order: 1 },
  { slug: "tarde", name: "Tarde", order: 2 },
  { slug: "noite", name: "Noite", order: 3 },
  { slug: "integral", name: "Integral", order: 4 },
];

export class OpsClientEducationError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "OpsClientEducationError";
    this.code = code;
    this.status = status;
  }
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeActorName(actor: ClientEducationActor | null | undefined) {
  return normalizeText(actor?.name) || normalizeText(actor?.cpf) || null;
}

function assertPositiveInteger(value: unknown, message: string) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new OpsClientEducationError("invalid_client_education_payload", message, 400);
  }

  return parsed;
}

function normalizeStatus(value: unknown) {
  const normalized = normalizeText(value).toLowerCase();

  if (normalized === "ati" || normalized === "ativo") {
    return "ati" as const;
  }

  if (normalized === "ina" || normalized === "inativo") {
    return "ina" as const;
  }

  return null;
}

function normalizeSearch(value: unknown) {
  return normalizeText(value).replace(/\s+/g, " ");
}

function parseBooleanish(value: boolean | string | null | undefined) {
  if (value === true || value === false) {
    return value;
  }

  const normalized = normalizeText(value).toLowerCase();
  return normalized === "true" || normalized === "t" || normalized === "1";
}

function slugifyLower(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function normalizeDefaultPeriods(value: unknown) {
  const rawValues = Array.isArray(value)
    ? value
    : value == null || value === ""
      ? []
      : [value];

  const allowed = new Map(
    standardPeriodDefinitions.map((period) => [period.slug, period]),
  );
  const result = new Map<string, StandardPeriodDefinition>();

  for (const rawValue of rawValues) {
    if (typeof rawValue !== "string") {
      continue;
    }

    const slug = slugifyLower(rawValue);
    const definition = allowed.get(slug);

    if (definition) {
      result.set(slug, definition);
    }
  }

  return Array.from(result.values());
}

async function getClientById(client: PoolClient, clientId: number) {
  const result = await client.query<ClientRow>(
    `
      SELECT
        c.idcliente,
        c.nome,
        c.status,
        c.idtipo,
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
    throw new OpsClientEducationError(
      "client_not_found",
      "Cliente nao encontrado.",
      404,
    );
  }

  return row;
}

function isSchoolClient(client: ClientRow) {
  return (
    Number(client.idtipo) === 4 ||
    slugifyLower(client.tipo_nome ?? "") === "escola"
  );
}

async function getClientClassById(
  client: PoolClient,
  clientId: number,
  classId: number,
  lock = false,
) {
  const result = await client.query<ClientClassRow>(
    `
      SELECT idturma, idcliente, nome, ordem, status
      FROM cliente_turmas
      WHERE idcliente = $1
        AND idturma = $2
      LIMIT 1
      ${lock ? "FOR UPDATE" : ""}
    `,
    [clientId, classId],
  );

  return result.rows[0] ?? null;
}

async function getClientPeriodById(
  client: PoolClient,
  classId: number,
  periodId: number,
  lock = false,
) {
  const result = await client.query<ClientPeriodRow>(
    `
      SELECT idperiodo, idturma, nome, ordem, status
      FROM cliente_turma_periodos
      WHERE idturma = $1
        AND idperiodo = $2
      LIMIT 1
      ${lock ? "FOR UPDATE" : ""}
    `,
    [classId, periodId],
  );

  return result.rows[0] ?? null;
}

function toClientPeriodItem(row: ClientPeriodRow): ClientPeriodItem {
  return {
    id: Number(row.idperiodo),
    classId: Number(row.idturma),
    name: row.nome,
    order: Number(row.ordem ?? 0),
    status: normalizeStatus(row.status) ?? "ati",
  };
}

function toClientClassItem(
  row: ClientClassRow,
  periods: ClientPeriodItem[],
): ClientClassItem {
  return {
    id: Number(row.idturma),
    clientId: Number(row.idcliente),
    name: row.nome,
    order: Number(row.ordem ?? 0),
    status: normalizeStatus(row.status) ?? "ati",
    periods,
  };
}

async function getClientClassesWithPeriods(client: PoolClient, clientId: number) {
  const classesResult = await client.query<ClientClassRow>(
    `
      SELECT idturma, idcliente, nome, ordem, status
      FROM cliente_turmas
      WHERE idcliente = $1
      ORDER BY ordem ASC, nome ASC, idturma ASC
    `,
    [clientId],
  );
  const classes = classesResult.rows;
  const classIds = classes.map((row) => Number(row.idturma));

  const periodsResult =
    classIds.length > 0
      ? await client.query<ClientPeriodRow>(
          `
            SELECT idperiodo, idturma, nome, ordem, status
            FROM cliente_turma_periodos
            WHERE idturma = ANY($1::int[])
            ORDER BY ordem ASC, nome ASC, idperiodo ASC
          `,
          [classIds],
        )
      : { rows: [] as ClientPeriodRow[] };

  const periodsByClassId = new Map<number, ClientPeriodItem[]>();

  for (const periodRow of periodsResult.rows) {
    const classId = Number(periodRow.idturma);
    const items = periodsByClassId.get(classId) ?? [];
    items.push(toClientPeriodItem(periodRow));
    periodsByClassId.set(classId, items);
  }

  return classes.map((classRow) =>
    toClientClassItem(
      classRow,
      periodsByClassId.get(Number(classRow.idturma)) ?? [],
    ),
  );
}

function validateClassPayload(input: ClientClassMutationInput["values"]) {
  const name = normalizeText(input?.name);
  const order = input?.order == null || input.order === "" ? 0 : Number(input.order);
  const status = normalizeStatus(input?.status) ?? "ati";
  const defaultPeriods = normalizeDefaultPeriods(input?.defaultPeriods);

  if (!name) {
    throw new OpsClientEducationError(
      "invalid_client_education_payload",
      "Informe o nome da turma.",
      400,
    );
  }

  if (!Number.isInteger(order) || order < 0) {
    throw new OpsClientEducationError(
      "invalid_client_education_payload",
      "Informe uma ordem valida para a turma.",
      400,
    );
  }

  return {
    name,
    order,
    status,
    defaultPeriods,
  };
}

function validatePeriodPayload(input: ClientPeriodMutationInput["values"]) {
  const name = normalizeText(input?.name);
  const order = input?.order == null || input.order === "" ? 0 : Number(input.order);
  const status = normalizeStatus(input?.status) ?? "ati";

  if (!name) {
    throw new OpsClientEducationError(
      "invalid_client_education_payload",
      "Informe o nome do periodo.",
      400,
    );
  }

  if (!Number.isInteger(order) || order < 0) {
    throw new OpsClientEducationError(
      "invalid_client_education_payload",
      "Informe uma ordem valida para o periodo.",
      400,
    );
  }

  return {
    name,
    order,
    status,
  };
}

async function syncDefaultPeriods(
  client: PoolClient,
  classId: number,
  selectedPeriods: StandardPeriodDefinition[],
) {
  const existingResult = await client.query<ClientPeriodRow>(
    `
      SELECT idperiodo, idturma, nome, ordem, status
      FROM cliente_turma_periodos
      WHERE idturma = $1
      ORDER BY ordem ASC, nome ASC
    `,
    [classId],
  );
  const standardMap = new Map(
    standardPeriodDefinitions.map((period) => [period.slug, period]),
  );
  const existingMap = new Map<string, ClientPeriodRow>();

  for (const row of existingResult.rows) {
    const slug = slugifyLower(row.nome);
    if (standardMap.has(slug)) {
      existingMap.set(slug, row);
    }
  }

  const selectedSlugs = new Set(selectedPeriods.map((period) => period.slug));

  for (const period of selectedPeriods) {
    const existing = existingMap.get(period.slug);

    if (existing) {
      await client.query(
        `
          UPDATE cliente_turma_periodos
          SET nome = $2, ordem = $3, status = 'ati', atualizado_em = NOW()
          WHERE idperiodo = $1
        `,
        [existing.idperiodo, period.name, period.order],
      );
    } else {
      await client.query(
        `
          INSERT INTO cliente_turma_periodos (
            idturma,
            nome,
            ordem,
            status,
            criado_em,
            atualizado_em
          ) VALUES ($1, $2, $3, 'ati', NOW(), NOW())
        `,
        [classId, period.name, period.order],
      );
    }
  }

  for (const [slug, row] of existingMap.entries()) {
    if (!selectedSlugs.has(slug)) {
      await client.query(
        `
          UPDATE cliente_turma_periodos
          SET status = 'ina', atualizado_em = NOW()
          WHERE idperiodo = $1
        `,
        [row.idperiodo],
      );
    }
  }
}

export async function listClientTypes() {
  const pool = getIngressoDbPool();
  const result = await pool.query<{ idtipo: number; nome: string }>(
    `
      SELECT idtipo, nome
      FROM cliente_tipos
      ORDER BY nome ASC
    `,
  );

  return result.rows.map((row) => ({
    id: Number(row.idtipo),
    name: row.nome,
  })) satisfies ClientTypeOption[];
}

export async function autocompleteClients(query: unknown, limitInput: unknown) {
  const term = normalizeSearch(query);
  const limit = Math.min(50, Math.max(5, Number(limitInput) || 10));

  if (term.length < 2) {
    return [] as ClientAutocompleteItem[];
  }

  const pool = getIngressoDbPool();
  const result = await pool.query<{
    idcliente: number;
    nome: string;
    idtipo: number | null;
    tipo_nome: string | null;
  }>(
    `
      SELECT
        c.idcliente,
        c.nome,
        c.idtipo,
        t.nome AS tipo_nome
      FROM clientes c
      LEFT JOIN cliente_tipos t ON t.idtipo = c.idtipo
      WHERE lower(regexp_replace(trim(c.nome), '\\s+', ' ', 'g')) LIKE lower($1)
      ORDER BY c.nome ASC
      LIMIT $2
    `,
    [`%${term}%`, limit],
  );

  return result.rows.map((row) => ({
    id: Number(row.idcliente),
    text: `${row.nome} (${row.tipo_nome ?? "sem tipo"})`,
    name: row.nome,
    typeId: row.idtipo == null ? null : Number(row.idtipo),
    typeName: row.tipo_nome,
  })) satisfies ClientAutocompleteItem[];
}

export async function getClientEducationSummary(clientIdInput: unknown) {
  const clientId = assertPositiveInteger(clientIdInput, "Informe um cliente valido.");
  const pool = getIngressoDbPool();
  const client = await pool.connect();

  try {
    const clientRow = await getClientById(client, clientId);
    const classes = await getClientClassesWithPeriods(client, clientId);

    return {
      client: {
        id: Number(clientRow.idcliente),
        name: clientRow.nome,
        typeId: Number(clientRow.idtipo),
        typeName: clientRow.tipo_nome,
        isSchool: isSchoolClient(clientRow),
        active: parseBooleanish(clientRow.status),
      },
      standardPeriodOptions: standardPeriodDefinitions,
      classes,
    } satisfies ClientEducationSummary;
  } finally {
    client.release();
  }
}

export async function toggleClientStatus(input: ClientStatusToggleInput) {
  const clientId = assertPositiveInteger(input.clientId, "Informe um cliente valido.");
  const pool = getIngressoDbPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const clientRow = await getClientById(client, clientId);
    const currentActive = parseBooleanish(clientRow.status);
    const nextActive = !currentActive;

    await client.query(
      `
        UPDATE clientes
        SET status = $2, atualizado_em = NOW()
        WHERE idcliente = $1
      `,
      [clientId, nextActive ? "true" : "false"],
    );

    const auditLogId = await registerOpsAuditLog(client, {
      origem: "ops-admin",
      acao: "client_status_toggle",
      descricao: `Status do cliente ${clientRow.nome} alterado para ${
        nextActive ? "ativo" : "inativo"
      }.`,
      motivo: normalizeText(input.reason) || "Alternancia de status no painel interno",
      usuarioNome: normalizeActorName(input.actor),
      detalhes: {
        clientId,
        before: {
          active: currentActive,
        },
        after: {
          active: nextActive,
        },
      },
    });

    await client.query("COMMIT");

    return {
      clientId,
      active: nextActive,
      auditLogId,
      message: nextActive
        ? "Cliente ativado com sucesso."
        : "Cliente inativado com sucesso.",
    } satisfies ClientStatusToggleResult;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function createClientClass(input: ClientClassMutationInput) {
  const clientId = assertPositiveInteger(input.clientId, "Informe um cliente valido.");
  const payload = validateClassPayload(input.values);
  const pool = getIngressoDbPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const clientRow = await getClientById(client, clientId);

    if (isSchoolClient(clientRow)) {
      throw new OpsClientEducationError(
        "client_class_school_locked",
        "Turmas sao padronizadas para clientes do tipo escola.",
        400,
      );
    }

    const insertResult = await client.query<{ idturma: number }>(
      `
        INSERT INTO cliente_turmas (
          idcliente,
          nome,
          ordem,
          status,
          criado_em,
          atualizado_em
        ) VALUES ($1, $2, $3, $4, NOW(), NOW())
        RETURNING idturma
      `,
      [clientId, payload.name, payload.order, payload.status],
    );
    const classId = Number(insertResult.rows[0]?.idturma ?? 0);

    if (!classId) {
      throw new OpsClientEducationError(
        "client_class_create_failed",
        "Nao foi possivel criar a turma.",
        502,
      );
    }

    await syncDefaultPeriods(client, classId, payload.defaultPeriods);
    const item = (await getClientClassesWithPeriods(client, clientId)).find(
      (classItem) => classItem.id === classId,
    ) ?? null;
    const auditLogId = await registerOpsAuditLog(client, {
      origem: "ops-admin",
      acao: "client_class_create",
      descricao: `Turma ${payload.name} criada para o cliente ${clientRow.nome}.`,
      motivo: normalizeText(input.reason) || "Cadastro de turma no painel interno",
      usuarioNome: normalizeActorName(input.actor),
      detalhes: {
        clientId,
        classId,
        after: item,
      },
    });

    await client.query("COMMIT");

    return {
      clientId,
      id: classId,
      action: "create",
      item,
      auditLogId,
      message: "Turma cadastrada com sucesso.",
    } satisfies ClientClassMutationResult;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function updateClientClass(input: ClientClassMutationInput) {
  const clientId = assertPositiveInteger(input.clientId, "Informe um cliente valido.");
  const classId = assertPositiveInteger(input.id, "Informe uma turma valida.");
  const payload = validateClassPayload(input.values);
  const pool = getIngressoDbPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const clientRow = await getClientById(client, clientId);

    if (isSchoolClient(clientRow)) {
      throw new OpsClientEducationError(
        "client_class_school_locked",
        "Turmas sao padronizadas para clientes do tipo escola.",
        400,
      );
    }

    const currentClass = await getClientClassById(client, clientId, classId, true);

    if (!currentClass) {
      throw new OpsClientEducationError(
        "client_class_not_found",
        "Turma nao encontrada.",
        404,
      );
    }

    await client.query(
      `
        UPDATE cliente_turmas
        SET nome = $3, ordem = $4, status = $5, atualizado_em = NOW()
        WHERE idcliente = $1
          AND idturma = $2
      `,
      [clientId, classId, payload.name, payload.order, payload.status],
    );
    await syncDefaultPeriods(client, classId, payload.defaultPeriods);
    const item = (await getClientClassesWithPeriods(client, clientId)).find(
      (classItem) => classItem.id === classId,
    ) ?? null;
    const auditLogId = await registerOpsAuditLog(client, {
      origem: "ops-admin",
      acao: "client_class_update",
      descricao: `Turma ${currentClass.nome} alterada para o cliente ${clientRow.nome}.`,
      motivo: normalizeText(input.reason) || "Edicao de turma no painel interno",
      usuarioNome: normalizeActorName(input.actor),
      detalhes: {
        clientId,
        classId,
        after: item,
      },
    });

    await client.query("COMMIT");

    return {
      clientId,
      id: classId,
      action: "update",
      item,
      auditLogId,
      message: "Turma alterada com sucesso.",
    } satisfies ClientClassMutationResult;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteClientClass(input: ClientClassMutationInput) {
  const clientId = assertPositiveInteger(input.clientId, "Informe um cliente valido.");
  const classId = assertPositiveInteger(input.id, "Informe uma turma valida.");
  const pool = getIngressoDbPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const currentClass = await getClientClassById(client, clientId, classId, true);

    if (!currentClass) {
      throw new OpsClientEducationError(
        "client_class_not_found",
        "Turma nao encontrada.",
        404,
      );
    }

    await client.query(
      `
        DELETE FROM cliente_turmas
        WHERE idcliente = $1
          AND idturma = $2
      `,
      [clientId, classId],
    );

    const auditLogId = await registerOpsAuditLog(client, {
      origem: "ops-admin",
      acao: "client_class_delete",
      descricao: `Turma ${currentClass.nome} removida do cliente ${clientId}.`,
      motivo: normalizeText(input.reason) || "Exclusao de turma no painel interno",
      usuarioNome: normalizeActorName(input.actor),
      detalhes: {
        clientId,
        classId,
        before: toClientClassItem(currentClass, []),
      },
    });

    await client.query("COMMIT");

    return {
      clientId,
      id: classId,
      action: "delete",
      item: null,
      auditLogId,
      message: "Turma excluida com sucesso.",
    } satisfies ClientClassMutationResult;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function createClientPeriod(input: ClientPeriodMutationInput) {
  const clientId = assertPositiveInteger(input.clientId, "Informe um cliente valido.");
  const classId = assertPositiveInteger(input.classId, "Informe uma turma valida.");
  const payload = validatePeriodPayload(input.values);
  const pool = getIngressoDbPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await getClientById(client, clientId);
    const currentClass = await getClientClassById(client, clientId, classId, true);

    if (!currentClass) {
      throw new OpsClientEducationError(
        "client_class_not_found",
        "Turma nao encontrada.",
        404,
      );
    }

    const insertResult = await client.query<{ idperiodo: number }>(
      `
        INSERT INTO cliente_turma_periodos (
          idturma,
          nome,
          ordem,
          status,
          criado_em,
          atualizado_em
        ) VALUES ($1, $2, $3, $4, NOW(), NOW())
        RETURNING idperiodo
      `,
      [classId, payload.name, payload.order, payload.status],
    );
    const periodId = Number(insertResult.rows[0]?.idperiodo ?? 0);

    if (!periodId) {
      throw new OpsClientEducationError(
        "client_period_create_failed",
        "Nao foi possivel criar o periodo.",
        502,
      );
    }

    const item = await getClientPeriodById(client, classId, periodId);
    const auditLogId = await registerOpsAuditLog(client, {
      origem: "ops-admin",
      acao: "client_period_create",
      descricao: `Periodo ${payload.name} criado na turma ${currentClass.nome}.`,
      motivo: normalizeText(input.reason) || "Cadastro de periodo no painel interno",
      usuarioNome: normalizeActorName(input.actor),
      detalhes: {
        clientId,
        classId,
        periodId,
        after: item ? toClientPeriodItem(item) : null,
      },
    });

    await client.query("COMMIT");

    return {
      clientId,
      classId,
      id: periodId,
      action: "create",
      item: item ? toClientPeriodItem(item) : null,
      auditLogId,
      message: "Periodo cadastrado com sucesso.",
    } satisfies ClientPeriodMutationResult;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function updateClientPeriod(input: ClientPeriodMutationInput) {
  const clientId = assertPositiveInteger(input.clientId, "Informe um cliente valido.");
  const classId = assertPositiveInteger(input.classId, "Informe uma turma valida.");
  const periodId = assertPositiveInteger(input.id, "Informe um periodo valido.");
  const payload = validatePeriodPayload(input.values);
  const pool = getIngressoDbPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await getClientById(client, clientId);
    const currentClass = await getClientClassById(client, clientId, classId, true);

    if (!currentClass) {
      throw new OpsClientEducationError(
        "client_class_not_found",
        "Turma nao encontrada.",
        404,
      );
    }

    const currentPeriod = await getClientPeriodById(client, classId, periodId, true);

    if (!currentPeriod) {
      throw new OpsClientEducationError(
        "client_period_not_found",
        "Periodo nao encontrado.",
        404,
      );
    }

    await client.query(
      `
        UPDATE cliente_turma_periodos
        SET nome = $3, ordem = $4, status = $5, atualizado_em = NOW()
        WHERE idturma = $1
          AND idperiodo = $2
      `,
      [classId, periodId, payload.name, payload.order, payload.status],
    );
    const item = await getClientPeriodById(client, classId, periodId);
    const auditLogId = await registerOpsAuditLog(client, {
      origem: "ops-admin",
      acao: "client_period_update",
      descricao: `Periodo ${currentPeriod.nome} alterado na turma ${currentClass.nome}.`,
      motivo: normalizeText(input.reason) || "Edicao de periodo no painel interno",
      usuarioNome: normalizeActorName(input.actor),
      detalhes: {
        clientId,
        classId,
        periodId,
        after: item ? toClientPeriodItem(item) : null,
      },
    });

    await client.query("COMMIT");

    return {
      clientId,
      classId,
      id: periodId,
      action: "update",
      item: item ? toClientPeriodItem(item) : null,
      auditLogId,
      message: "Periodo alterado com sucesso.",
    } satisfies ClientPeriodMutationResult;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteClientPeriod(input: ClientPeriodMutationInput) {
  const clientId = assertPositiveInteger(input.clientId, "Informe um cliente valido.");
  const classId = assertPositiveInteger(input.classId, "Informe uma turma valida.");
  const periodId = assertPositiveInteger(input.id, "Informe um periodo valido.");
  const pool = getIngressoDbPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await getClientById(client, clientId);
    const currentPeriod = await getClientPeriodById(client, classId, periodId, true);

    if (!currentPeriod) {
      throw new OpsClientEducationError(
        "client_period_not_found",
        "Periodo nao encontrado.",
        404,
      );
    }

    await client.query(
      `
        DELETE FROM cliente_turma_periodos
        WHERE idturma = $1
          AND idperiodo = $2
      `,
      [classId, periodId],
    );

    const auditLogId = await registerOpsAuditLog(client, {
      origem: "ops-admin",
      acao: "client_period_delete",
      descricao: `Periodo ${currentPeriod.nome} removido da turma ${classId}.`,
      motivo: normalizeText(input.reason) || "Exclusao de periodo no painel interno",
      usuarioNome: normalizeActorName(input.actor),
      detalhes: {
        clientId,
        classId,
        periodId,
        before: toClientPeriodItem(currentPeriod),
      },
    });

    await client.query("COMMIT");

    return {
      clientId,
      classId,
      id: periodId,
      action: "delete",
      item: null,
      auditLogId,
      message: "Periodo excluido com sucesso.",
    } satisfies ClientPeriodMutationResult;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export function asOpsClientEducationError(error: unknown) {
  if (error instanceof OpsClientEducationError) {
    return error;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23503"
  ) {
    return new OpsClientEducationError(
      "client_education_in_use",
      "Nao e possivel excluir: ha relacionamentos no sistema.",
      409,
    );
  }

  return new OpsClientEducationError(
    "client_education_unavailable",
    "Nao foi possivel concluir a operacao de clientes agora.",
    502,
  );
}
