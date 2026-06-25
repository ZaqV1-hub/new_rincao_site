import type { PoolClient } from "pg";
import { getIngressoDbPool } from "@/lib/ingresso-db";
import { registerOpsAuditLog } from "@/lib/ops-audit-log";
import { hashPasswordForLegacyUser } from "@/lib/password-hashing";

type FieldType =
  | "text"
  | "money"
  | "integer"
  | "date"
  | "status"
  | "boolean"
  | "cpf"
  | "email"
  | "password";

type IdentifierType = "integer" | "text";

type SupportedAction = "create" | "update" | "delete";

type AdminField = {
  name: string;
  column: string;
  type: FieldType;
  required?: boolean;
  maxLength?: number;
  allowed?: string[];
  allowedIntegers?: number[];
  editable?: boolean;
  writeOnly?: boolean;
};

type AdminResourceConfig = {
  resource: OpsAdminMasterDataResource;
  label: string;
  table: string;
  primaryKey: string;
  primaryKeyType: IdentifierType;
  orderBy: string;
  fields: AdminField[];
  defaults?: Record<string, string>;
  supportedActions?: SupportedAction[];
  scopeWhere?: string;
  validatePayload?: (
    payload: Record<string, string | number | null>,
    mode: "create" | "update",
  ) => void;
};

type AdminActor = {
  name?: string | null;
  cpf?: string | null;
};

const INTERNAL_USER_ROLE_CATALOG = [
  { id: 1, name: "Gerente" },
  { id: 2, name: "Funcionario" },
  { id: 3, name: "Bilheteria" },
] as const;

export type OpsAdminMasterDataIdentifier = number | string;

export type OpsAdminMasterDataResource =
  | "agenda"
  | "price-tables"
  | "information"
  | "membership-categories"
  | "agreements"
  | "clients"
  | "schools"
  | "internal-users"
  | "site-users"
  | "members";

export type OpsAdminMasterDataInput = {
  id?: OpsAdminMasterDataIdentifier | null;
  reason?: string | null;
  actor?: AdminActor | null;
  values?: Record<string, unknown> | null;
};

export type OpsAdminMasterDataResult = {
  resource: OpsAdminMasterDataResource;
  id: OpsAdminMasterDataIdentifier;
  action: "create" | "update" | "delete";
  item: Record<string, unknown> | null;
  auditLogId: number | null;
  message: string;
};

class OpsAdminMasterDataError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "OpsAdminMasterDataError";
    this.code = code;
    this.status = status;
  }
}

const resourceConfigs: Record<OpsAdminMasterDataResource, AdminResourceConfig> = {
  agenda: {
    resource: "agenda",
    label: "agenda",
    table: "agenda",
    primaryKey: "idagenda",
    primaryKeyType: "integer",
    orderBy: "dtagenda",
    fields: [
      { name: "date", column: "dtagenda", type: "date", required: true },
      { name: "priceTableId", column: "idtabpreco", type: "integer", required: true },
      { name: "informationId", column: "idinformacao", type: "integer", required: true },
      {
        name: "type",
        column: "tpagenda",
        type: "status",
        required: true,
        allowed: [
          "padra",
          "promo",
          "escol",
          "igrej",
          "casam",
          "melho",
          "confr",
          "ongs",
          "grmix",
        ],
      },
      {
        name: "status",
        column: "stagenda",
        type: "status",
        required: true,
        allowed: ["abe", "fec", "lot"],
      },
      { name: "promotionName", column: "nmpromocional", type: "text" },
      { name: "promotionDescription", column: "dspromocional", type: "text", maxLength: 300 },
    ],
  },
  "price-tables": {
    resource: "price-tables",
    label: "tabela de preco",
    table: "tabpreco",
    primaryKey: "idtabpreco",
    primaryKeyType: "integer",
    orderBy: "nmtabpreco",
    defaults: {
      sttabpreco: "ati",
    },
    fields: [
      { name: "name", column: "nmtabpreco", type: "text", required: true, maxLength: 50 },
      { name: "normalValue", column: "vlnormal", type: "money", required: true },
      { name: "childValue", column: "vlinfant", type: "money", required: true },
      { name: "gateNormalValue", column: "vlnormalbil", type: "money" },
      { name: "gateChildValue", column: "vlinfantbil", type: "money" },
      { name: "status", column: "sttabpreco", type: "status", allowed: ["ati", "ina"] },
    ],
  },
  information: {
    resource: "information",
    label: "informacao",
    table: "informacao",
    primaryKey: "idinformacao",
    primaryKeyType: "integer",
    orderBy: "nome",
    defaults: {
      status: "ati",
    },
    fields: [
      { name: "name", column: "nome", type: "text", required: true },
      { name: "text", column: "texto", type: "text", required: true },
      { name: "status", column: "status", type: "status", allowed: ["ati", "ina"] },
    ],
  },
  "membership-categories": {
    resource: "membership-categories",
    label: "categoria de socio",
    table: "sociocateg",
    primaryKey: "idsociocateg",
    primaryKeyType: "integer",
    orderBy: "nmcategoria",
    fields: [
      { name: "name", column: "nmcategoria", type: "text", required: true, maxLength: 50 },
      { name: "priceTableId", column: "idtabpreco", type: "integer", required: true },
    ],
  },
  agreements: {
    resource: "agreements",
    label: "convenio",
    table: "convenio",
    primaryKey: "idconvenio",
    primaryKeyType: "integer",
    orderBy: "nmconvenio",
    defaults: {
      stconvenio: "ati",
    },
    fields: [
      { name: "name", column: "nmconvenio", type: "text", required: true, maxLength: 120 },
      { name: "startDate", column: "dtini", type: "date", required: true },
      { name: "endDate", column: "dtfim", type: "date", required: true },
      { name: "priceTableId", column: "idtabpreco", type: "integer", required: true },
      { name: "status", column: "stconvenio", type: "status", allowed: ["ati", "ina"] },
    ],
  },
  clients: {
    resource: "clients",
    label: "cliente",
    table: "clientes",
    primaryKey: "idcliente",
    primaryKeyType: "integer",
    orderBy: "nome",
    defaults: {
      status: "true",
    },
    fields: [
      { name: "typeId", column: "idtipo", type: "integer", required: true },
      { name: "name", column: "nome", type: "text", required: true },
      { name: "active", column: "status", type: "boolean" },
    ],
  },
  schools: {
    resource: "schools",
    label: "escola",
    table: "escola",
    primaryKey: "idescola",
    primaryKeyType: "integer",
    orderBy: "nmescola",
    defaults: {
      stescola: "ati",
    },
    fields: [
      { name: "name", column: "nmescola", type: "text", required: true, maxLength: 50 },
      { name: "informationId", column: "idinformacao", type: "integer", required: true },
      { name: "informationText", column: "textoinfo", type: "text" },
      { name: "status", column: "stescola", type: "status", allowed: ["ati", "ina"] },
    ],
  },
  "internal-users": {
    resource: "internal-users",
    label: "usuario interno",
    table: "usuario",
    primaryKey: "cpf",
    primaryKeyType: "text",
    orderBy: "nmusuario",
    supportedActions: ["create", "update", "delete"],
    scopeWhere: "idpapel IS NOT NULL",
    defaults: {
      stusuario: "ati",
    },
    fields: [
      { name: "cpf", column: "cpf", type: "cpf", required: true },
      {
        name: "password",
        column: "senha",
        type: "password",
        required: true,
        maxLength: 20,
        writeOnly: true,
      },
      { name: "name", column: "nmusuario", type: "text", required: true, maxLength: 120 },
      { name: "email", column: "email", type: "email", maxLength: 120 },
      {
        name: "roleId",
        column: "idpapel",
        type: "integer",
        required: true,
        allowedIntegers: [1, 2, 3],
      },
      { name: "status", column: "stusuario", type: "status", allowed: ["ati", "ina"] },
    ],
  },
  "site-users": {
    resource: "site-users",
    label: "usuario do site",
    table: "usuario",
    primaryKey: "cpf",
    primaryKeyType: "text",
    orderBy: "nmusuario",
    supportedActions: ["update"],
    scopeWhere: "idpapel IS NULL",
    fields: [
      { name: "cpf", column: "cpf", type: "cpf", required: true, editable: false },
      { name: "name", column: "nmusuario", type: "text", editable: false },
      { name: "email", column: "email", type: "email", maxLength: 120 },
      { name: "status", column: "stusuario", type: "status", allowed: ["ati", "ina"] },
    ],
  },
  members: {
    resource: "members",
    label: "socio",
    table: "socio",
    primaryKey: "cpf",
    primaryKeyType: "text",
    orderBy: "nmsocio",
    supportedActions: ["create", "update", "delete"],
    defaults: {
      stsocio: "ati",
    },
    fields: [
      { name: "cpf", column: "cpf", type: "cpf", required: true },
      { name: "startDate", column: "dtinisoc", type: "date", required: true },
      { name: "endDate", column: "dtfimsoc", type: "date", required: true },
      { name: "name", column: "nmsocio", type: "text", required: true, maxLength: 120 },
      {
        name: "dailyPurchaseLimit",
        column: "qtcompradia",
        type: "integer",
        required: true,
      },
      { name: "categoryId", column: "idsociocateg", type: "integer", required: true },
      { name: "status", column: "stsocio", type: "status", allowed: ["ati", "ina"] },
    ],
    validatePayload(payload) {
      const startDate =
        typeof payload.dtinisoc === "string" ? payload.dtinisoc : null;
      const endDate = typeof payload.dtfimsoc === "string" ? payload.dtfimsoc : null;

      if (startDate && endDate && endDate < startDate) {
        throw new OpsAdminMasterDataError(
          "invalid_admin_master_data_payload",
          "A data final deve ser igual ou posterior a data inicial.",
          400,
        );
      }
    },
  },
};

export function getOpsAdminMasterDataResources() {
  return Object.values(resourceConfigs).map((config) => ({
    resource: config.resource,
    label: config.label,
    primaryKey: config.primaryKey,
    primaryKeyType: config.primaryKeyType,
    supportedActions: config.supportedActions ?? ["create", "update", "delete"],
    fields: config.fields.map((field) => ({
      name: field.name,
      column: field.column,
      type: field.type,
      required: field.required === true,
      maxLength: field.maxLength ?? null,
      allowed: field.allowed ?? null,
      allowedIntegers: field.allowedIntegers ?? null,
      editable: field.editable !== false,
      writeOnly: field.writeOnly === true,
    })),
  }));
}

export function asOpsAdminMasterDataError(error: unknown) {
  if (error instanceof OpsAdminMasterDataError) {
    return error;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23503"
  ) {
    return new OpsAdminMasterDataError(
      "admin_master_data_in_use",
      "Nao e possivel excluir: ha relacionamentos no sistema.",
      409,
    );
  }

  return new OpsAdminMasterDataError(
    "admin_master_data_unavailable",
    "Nao foi possivel atualizar o cadastro administrativo agora.",
    502,
  );
}

function getConfig(resource: string | null | undefined) {
  const normalized = String(resource ?? "").trim() as OpsAdminMasterDataResource;
  const config = resourceConfigs[normalized];

  if (!config) {
    throw new OpsAdminMasterDataError(
      "invalid_admin_master_data_resource",
      "Informe um cadastro administrativo valido.",
      400,
    );
  }

  return config;
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeCpf(value: unknown) {
  const digits = normalizeText(value).replace(/\D+/g, "");
  return digits.length === 11 ? digits : null;
}

function normalizeActorName(actor: AdminActor | null | undefined) {
  return normalizeText(actor?.name) || normalizeText(actor?.cpf) || null;
}

function parseMoney(value: unknown) {
  const raw = normalizeText(value).replace(/^R\$\s*/i, "");
  const normalized =
    raw.includes(",") && raw.includes(".")
      ? raw.replace(/\./g, "").replace(",", ".")
      : raw.includes(",")
        ? raw.replace(",", ".")
        : raw;
  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed.toFixed(2) : null;
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

function normalizeFieldValue(field: AdminField, value: unknown) {
  if (field.type === "cpf") {
    const cpf = normalizeCpf(value);

    if (field.required && !cpf) {
      throw new OpsAdminMasterDataError(
        "invalid_admin_master_data_payload",
        `Informe ${field.name} valido.`,
        400,
      );
    }

    return cpf;
  }

  if (field.type === "email") {
    const email = normalizeText(value);

    if (!email) {
      if (field.required) {
        throw new OpsAdminMasterDataError(
          "invalid_admin_master_data_payload",
          `Informe ${field.name}.`,
          400,
        );
      }

      return null;
    }

    if (field.maxLength && email.length > field.maxLength) {
      throw new OpsAdminMasterDataError(
        "invalid_admin_master_data_payload",
        `${field.name} deve ter no maximo ${field.maxLength} caracteres.`,
        400,
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) {
      throw new OpsAdminMasterDataError(
        "invalid_admin_master_data_payload",
        `Informe ${field.name} valido.`,
        400,
      );
    }

    return email.toLowerCase();
  }

  if (field.type === "password") {
    const password = normalizeText(value);

    if (field.required && !password) {
      throw new OpsAdminMasterDataError(
        "invalid_admin_master_data_payload",
        `Informe ${field.name}.`,
        400,
      );
    }

    if (field.maxLength && password.length > field.maxLength) {
      throw new OpsAdminMasterDataError(
        "invalid_admin_master_data_payload",
        `${field.name} deve ter no maximo ${field.maxLength} caracteres.`,
        400,
      );
    }

    return password ? hashPasswordForLegacyUser(password) : null;
  }

  if (field.type === "text") {
    const text = normalizeText(value);

    if (field.required && !text) {
      throw new OpsAdminMasterDataError(
        "invalid_admin_master_data_payload",
        `Informe ${field.name}.`,
        400,
      );
    }

    if (field.maxLength && text.length > field.maxLength) {
      throw new OpsAdminMasterDataError(
        "invalid_admin_master_data_payload",
        `${field.name} deve ter no maximo ${field.maxLength} caracteres.`,
        400,
      );
    }

    return text || null;
  }

  if (field.type === "money") {
    const valueAsMoney = parseMoney(value);

    if (field.required && valueAsMoney === null) {
      throw new OpsAdminMasterDataError(
        "invalid_admin_master_data_payload",
        `Informe valor numerico para ${field.name}.`,
        400,
      );
    }

    return valueAsMoney;
  }

  if (field.type === "integer") {
    const numeric = Number(value);

    if (!Number.isInteger(numeric) || numeric <= 0) {
      throw new OpsAdminMasterDataError(
        "invalid_admin_master_data_payload",
        `Informe ${field.name} valido.`,
        400,
      );
    }

    if (field.allowedIntegers && !field.allowedIntegers.includes(numeric)) {
      throw new OpsAdminMasterDataError(
        "invalid_admin_master_data_payload",
        `Informe ${field.name} valido.`,
        400,
      );
    }

    return numeric;
  }

  if (field.type === "date") {
    const date = parseDate(value);

    if (field.required && !date) {
      throw new OpsAdminMasterDataError(
        "invalid_admin_master_data_payload",
        `Informe data valida para ${field.name}.`,
        400,
      );
    }

    return date;
  }

  if (field.type === "boolean") {
    const normalized = normalizeText(value).toLowerCase();

    if (
      normalized === "true" ||
      normalized === "1" ||
      normalized === "s" ||
      normalized === "sim"
    ) {
      return "true";
    }

    if (
      normalized === "false" ||
      normalized === "0" ||
      normalized === "n" ||
      normalized === "nao" ||
      normalized === "não"
    ) {
      return "false";
    }

    if (field.required) {
      throw new OpsAdminMasterDataError(
        "invalid_admin_master_data_payload",
        `Informe ${field.name} valido.`,
        400,
      );
    }

    return null;
  }

  const status = normalizeText(value);

  if (field.allowed?.includes(status)) {
    return status;
  }

  if (field.required) {
    throw new OpsAdminMasterDataError(
      "invalid_admin_master_data_payload",
      `Informe status valido para ${field.name}.`,
      400,
    );
  }

  return null;
}

function normalizePayload(
  config: AdminResourceConfig,
  values: Record<string, unknown>,
  mode: "create" | "update",
) {
  const payload: Record<string, string | number | null> = {};

  for (const field of config.fields) {
    const hasValue = Object.prototype.hasOwnProperty.call(values, field.name);

    if (!hasValue && field.required && mode === "create") {
      throw new OpsAdminMasterDataError(
        "invalid_admin_master_data_payload",
        `Informe ${field.name}.`,
        400,
      );
    }

    if (hasValue) {
      payload[field.column] = normalizeFieldValue(field, values[field.name]);
    }
  }

  if (mode === "create") {
    Object.assign(payload, config.defaults ?? {});
  }

  if (Object.keys(payload).length === 0) {
    throw new OpsAdminMasterDataError(
      "invalid_admin_master_data_payload",
      "Informe ao menos um campo para atualizar.",
      400,
    );
  }

  config.validatePayload?.(payload, mode);

  return payload;
}

function assertIdentifier(config: AdminResourceConfig, id: unknown) {
  if (config.primaryKeyType === "integer") {
    const normalized = Number(id);

    if (!Number.isInteger(normalized) || normalized <= 0) {
      throw new OpsAdminMasterDataError(
        "invalid_admin_master_data_payload",
        "Informe um id valido.",
        400,
      );
    }

    return normalized;
  }

  const normalized = normalizeText(id);

  if (!normalized) {
    throw new OpsAdminMasterDataError(
      "invalid_admin_master_data_payload",
      "Informe uma chave primaria valida.",
      400,
    );
  }

  return normalized;
}

function getScopeClause(config: AdminResourceConfig) {
  return config.scopeWhere ? ` AND (${config.scopeWhere})` : "";
}

function sanitizeItem(
  config: AdminResourceConfig,
  item: Record<string, unknown> | null,
) {
  if (!item) {
    return null;
  }

  const sanitized = { ...item };

  for (const field of config.fields) {
    if (field.writeOnly) {
      delete sanitized[field.column];
    }
  }

  return sanitized;
}

async function getItem(
  client: PoolClient,
  config: AdminResourceConfig,
  id: OpsAdminMasterDataIdentifier,
) {
  const result = await client.query<Record<string, unknown>>(
    `
      SELECT *
      FROM ${config.table}
      WHERE ${config.primaryKey} = $1${getScopeClause(config)}
      LIMIT 1
    `,
    [id],
  );

  return sanitizeItem(config, result.rows[0] ?? null);
}

async function assertItemExists(
  client: PoolClient,
  config: AdminResourceConfig,
  id: OpsAdminMasterDataIdentifier,
) {
  const result = await client.query(
    `
      SELECT ${config.primaryKey}
      FROM ${config.table}
      WHERE ${config.primaryKey} = $1${getScopeClause(config)}
      LIMIT 1
      FOR UPDATE
    `,
    [id],
  );

  if (!result.rows[0]) {
    throw new OpsAdminMasterDataError(
      "admin_master_data_not_found",
      "Cadastro administrativo nao encontrado.",
      404,
    );
  }
}

function assertActionSupported(
  config: AdminResourceConfig,
  action: SupportedAction,
) {
  const supportedActions = config.supportedActions ?? ["create", "update", "delete"];

  if (!supportedActions.includes(action)) {
    throw new OpsAdminMasterDataError(
      "admin_master_data_action_not_supported",
      "Este cadastro nao permite esta operacao.",
      400,
    );
  }
}

async function createInternalUser(
  client: PoolClient,
  config: AdminResourceConfig,
  payload: Record<string, string | number | null>,
) {
  await ensureInternalUserRoles(client);
  const cpf = String(payload.cpf ?? "");
  const existingResult = await client.query<Record<string, unknown>>(
    `
      SELECT *
      FROM usuario
      WHERE cpf = $1
      LIMIT 1
      FOR UPDATE
    `,
    [cpf],
  );
  const existing = existingResult.rows[0] ?? null;

  if (existing && existing.idpapel !== null) {
    throw new OpsAdminMasterDataError(
      "admin_master_data_already_exists",
      "Ja existe um usuario interno cadastrado com esta chave primaria.",
      409,
    );
  }

  if (existing) {
    const columns = Object.keys(payload).filter((column) => {
      if (column !== "email") {
        return true;
      }

      return payload[column] !== null;
    });
    const assignments = columns
      .map((column, index) => `${column} = $${index + 2}`)
      .join(", ");

    await client.query(
      `
        UPDATE usuario
        SET ${assignments}
        WHERE cpf = $1
      `,
      [cpf, ...columns.map((column) => payload[column])],
    );

    return cpf;
  }

  const columns = Object.keys(payload);
  const params = columns.map((_, index) => `$${index + 1}`).join(", ");
  const result = await client.query<{ id: string }>(
    `
      INSERT INTO usuario (${columns.join(", ")})
      VALUES (${params})
      RETURNING cpf AS id
    `,
    columns.map((column) => payload[column]),
  );

  return result.rows[0]?.id ?? null;
}

async function ensureInternalUserRoles(client: PoolClient) {
  for (const role of INTERNAL_USER_ROLE_CATALOG) {
    await client.query(
      `
        INSERT INTO papel (idpapel, nmpapel)
        VALUES ($1, $2)
        ON CONFLICT (idpapel)
        DO UPDATE SET nmpapel = EXCLUDED.nmpapel
      `,
      [role.id, role.name],
    );
  }
}

export async function listOpsAdminMasterData(resource: string) {
  const config = getConfig(resource);
  const pool = getIngressoDbPool();
  const result = await pool.query<Record<string, unknown>>(
    `
      SELECT *
      FROM ${config.table}
      ${config.scopeWhere ? `WHERE ${config.scopeWhere}` : ""}
      ORDER BY ${config.orderBy} ASC, ${config.primaryKey} ASC
      LIMIT 200
    `,
  );

  return {
    resource: config.resource,
    label: config.label,
    primaryKey: config.primaryKey,
    items: result.rows.map((item) => sanitizeItem(config, item)),
  };
}

export async function createOpsAdminMasterData(
  resource: string,
  input: OpsAdminMasterDataInput,
): Promise<OpsAdminMasterDataResult> {
  const config = getConfig(resource);
  assertActionSupported(config, "create");
  const values = input.values ?? {};
  const payload = normalizePayload(config, values, "create");
  const pool = getIngressoDbPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    let id: OpsAdminMasterDataIdentifier | null = null;

    if (config.resource === "internal-users") {
      id = await createInternalUser(client, config, payload);
    } else {
      const columns = Object.keys(payload);
      const params = columns.map((_, index) => `$${index + 1}`).join(", ");
      const result = await client.query<{ id: OpsAdminMasterDataIdentifier }>(
        `
          INSERT INTO ${config.table} (${columns.join(", ")})
          VALUES (${params})
          RETURNING ${config.primaryKey} AS id
        `,
        columns.map((column) => payload[column]),
      );
      id = result.rows[0]?.id ?? null;
    }

    if (id === null || id === undefined || id === "") {
      throw new OpsAdminMasterDataError(
        "admin_master_data_create_failed",
        "Nao foi possivel criar o cadastro administrativo.",
        502,
      );
    }

    const item = await getItem(client, config, id);
    const auditLogId = await registerOpsAuditLog(client, {
      origem: "ops-admin",
      acao: "master_create",
      descricao: `${config.label} #${id} criado no BFF.`,
      motivo: normalizeText(input.reason) || `Cadastro de ${config.label} no BFF`,
      usuarioNome: normalizeActorName(input.actor),
      detalhes: {
        resource: config.resource,
        id,
        after: item,
      },
    });

    await client.query("COMMIT");

    return {
      resource: config.resource,
      id,
      action: "create",
      item,
      auditLogId,
      message: "Cadastro criado com sucesso.",
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function updateOpsAdminMasterData(
  resource: string,
  input: OpsAdminMasterDataInput,
): Promise<OpsAdminMasterDataResult> {
  const config = getConfig(resource);
  assertActionSupported(config, "update");
  const id = assertIdentifier(config, input.id);
  const payload = normalizePayload(config, input.values ?? {}, "update");
  const columns = Object.keys(payload);
  const assignments = columns
    .map((column, index) => `${column} = $${index + 2}`)
    .join(", ");
  const pool = getIngressoDbPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    if (config.resource === "internal-users") {
      await ensureInternalUserRoles(client);
    }

    await assertItemExists(client, config, id);

    await client.query(
      `
        UPDATE ${config.table}
        SET ${assignments}
        WHERE ${config.primaryKey} = $1
      `,
      [id, ...columns.map((column) => payload[column])],
    );

    const currentId =
      payload[config.primaryKey] ?? id;

    const item = await getItem(client, config, currentId);
    const auditLogId = await registerOpsAuditLog(client, {
      origem: "ops-admin",
      acao: "master_update",
      descricao:
        currentId === id
          ? `${config.label} #${id} alterado no BFF.`
          : `${config.label} #${id} alterado para #${currentId} no BFF.`,
      motivo: normalizeText(input.reason) || `Edicao de ${config.label} no BFF`,
      usuarioNome: normalizeActorName(input.actor),
      detalhes: {
        resource: config.resource,
        id: currentId,
        previousId: currentId === id ? null : id,
        after: item,
      },
    });

    await client.query("COMMIT");

    return {
      resource: config.resource,
      id: currentId,
      action: "update",
      item,
      auditLogId,
      message: "Cadastro alterado com sucesso.",
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteOpsAdminMasterData(
  resource: string,
  input: OpsAdminMasterDataInput,
): Promise<OpsAdminMasterDataResult> {
  const config = getConfig(resource);
  assertActionSupported(config, "delete");
  const id = assertIdentifier(config, input.id);
  const pool = getIngressoDbPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await assertItemExists(client, config, id);

    const before = await getItem(client, config, id);

    await client.query(
      `
        DELETE FROM ${config.table}
        WHERE ${config.primaryKey} = $1
      `,
      [id],
    );

    const auditLogId = await registerOpsAuditLog(client, {
      origem: "ops-admin",
      acao: "master_delete",
      descricao: `${config.label} #${id} excluido no BFF.`,
      motivo: normalizeText(input.reason) || `Exclusao de ${config.label} no BFF`,
      usuarioNome: normalizeActorName(input.actor),
      detalhes: {
        resource: config.resource,
        id,
        before,
      },
    });

    await client.query("COMMIT");

    return {
      resource: config.resource,
      id,
      action: "delete",
      item: null,
      auditLogId,
      message: "Cadastro excluido com sucesso.",
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
