import { getIngressoDbPool } from "@/lib/ingresso-db";
import { registerOpsAuditLog } from "@/lib/ops-audit-log";
import type { PoolClient } from "pg";

type DiscountTypeRow = {
  id: number;
  descricao: string | null;
};

type DiscountRow = {
  id: number;
  tipo_id: number | null;
  nome: string | null;
  tipo_aplicacao: string | null;
  valor: string | null;
  tipo_desc: string | null;
};

type CourtesyRow = {
  id: number;
  nome: string | null;
};

type ReferenceActor = {
  name?: string | null;
  cpf?: string | null;
};

type DiscountTypeInput = {
  id?: number | null;
  description?: string | null;
  reason?: string | null;
  actor?: ReferenceActor | null;
};

type DiscountInput = {
  id?: number | null;
  typeId?: number | null;
  name?: string | null;
  applicationType?: string | null;
  value?: string | number | null;
  reason?: string | null;
  actor?: ReferenceActor | null;
};

type CourtesyInput = {
  id?: number | null;
  name?: string | null;
  reason?: string | null;
  actor?: ReferenceActor | null;
};

export type OpsDiscountType = {
  id: number;
  description: string;
};

export type OpsDiscount = {
  id: number;
  typeId: number | null;
  typeDescription: string | null;
  name: string;
  applicationType: string | null;
  value: string;
};

export type OpsCourtesyAuthor = {
  id: number;
  name: string;
};

export type OpsReferenceData = {
  discountTypes: OpsDiscountType[];
  discounts: OpsDiscount[];
  courtesyAuthors: OpsCourtesyAuthor[];
};

export type OpsReferenceResource =
  | "discount_type"
  | "discount"
  | "courtesy_author";

export type OpsReferenceMutationSuccess = {
  action: "create" | "update" | "delete";
  resource: OpsReferenceResource;
  id: number;
  referenceData: OpsReferenceData;
  auditLogId: number | null;
  message: string;
};

class OpsReferenceDataError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "OpsReferenceDataError";
    this.code = code;
    this.status = status;
  }
}

export function asOpsReferenceDataError(error: unknown) {
  if (error instanceof OpsReferenceDataError) {
    return error;
  }

  return new OpsReferenceDataError(
    "ops_reference_data_unavailable",
    "Nao foi possivel atualizar as referencias operacionais agora.",
    502,
  );
}

function normalizeText(value: string | null | undefined) {
  return String(value ?? "").trim();
}

function normalizeActorName(actor: ReferenceActor | null | undefined) {
  return normalizeText(actor?.name) || normalizeText(actor?.cpf) || null;
}

function parseMoneyValue(value: string | number | null | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const raw = String(value ?? "").trim().replace(/^R\$\s*/i, "");
  const normalized =
    raw.includes(",") && raw.includes(".")
      ? raw.replace(/\./g, "").replace(",", ".")
      : raw.includes(",")
        ? raw.replace(",", ".")
        : raw;
  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeApplicationType(value: string | null | undefined) {
  const normalized = normalizeText(value);

  if (normalized === "percentual" || normalized === "valor_fixo") {
    return normalized;
  }

  return null;
}

function normalizeReason(value: string | null | undefined, fallback: string) {
  return normalizeText(value) || fallback;
}

function normalizeDiscountTypeInput(
  input: DiscountTypeInput,
  mode: "create" | "update",
) {
  const id = Number(input.id);
  const description = normalizeText(input.description);

  if (mode === "update" && (!Number.isInteger(id) || id <= 0)) {
    throw new OpsReferenceDataError(
      "invalid_reference_payload",
      "Informe um tipo de desconto valido para editar.",
      400,
    );
  }

  if (!description) {
    throw new OpsReferenceDataError(
      "invalid_reference_payload",
      "Informe a descricao do tipo de desconto.",
      400,
    );
  }

  return {
    id: mode === "update" ? id : null,
    description,
    reason: normalizeReason(
      input.reason,
      mode === "create"
        ? "Cadastro operacional de tipo de desconto no BFF"
        : "Edicao operacional de tipo de desconto no BFF",
    ),
    actor: input.actor ?? null,
  };
}

function normalizeDiscountInput(input: DiscountInput, mode: "create" | "update") {
  const id = Number(input.id);
  const typeId = Number(input.typeId);
  const name = normalizeText(input.name);
  const applicationType = normalizeApplicationType(input.applicationType);
  const value = parseMoneyValue(input.value);

  if (mode === "update" && (!Number.isInteger(id) || id <= 0)) {
    throw new OpsReferenceDataError(
      "invalid_reference_payload",
      "Informe um desconto valido para editar.",
      400,
    );
  }

  if (!Number.isInteger(typeId) || typeId <= 0) {
    throw new OpsReferenceDataError(
      "invalid_reference_payload",
      "Selecione o tipo de desconto.",
      400,
    );
  }

  if (!name) {
    throw new OpsReferenceDataError(
      "invalid_reference_payload",
      "Informe o nome do desconto.",
      400,
    );
  }

  if (!applicationType) {
    throw new OpsReferenceDataError(
      "invalid_reference_payload",
      "Informe uma aplicacao de desconto valida.",
      400,
    );
  }

  if (value === null) {
    throw new OpsReferenceDataError(
      "invalid_reference_payload",
      "Informe um valor numerico para o desconto.",
      400,
    );
  }

  if (applicationType === "percentual" && (value < 0 || value > 100)) {
    throw new OpsReferenceDataError(
      "invalid_reference_payload",
      "Percentual deve estar entre 0 e 100.",
      400,
    );
  }

  if (applicationType === "valor_fixo" && value < 0) {
    throw new OpsReferenceDataError(
      "invalid_reference_payload",
      "Valor fixo deve ser positivo.",
      400,
    );
  }

  return {
    id: mode === "update" ? id : null,
    typeId,
    name,
    applicationType,
    value: value.toFixed(2),
    reason: normalizeReason(
      input.reason,
      mode === "create"
        ? "Cadastro operacional de desconto no BFF"
        : "Edicao operacional de desconto no BFF",
    ),
    actor: input.actor ?? null,
  };
}

function normalizeCourtesyInput(input: CourtesyInput, mode: "create" | "update") {
  const id = Number(input.id);
  const name = normalizeText(input.name);

  if (mode === "update" && (!Number.isInteger(id) || id <= 0)) {
    throw new OpsReferenceDataError(
      "invalid_reference_payload",
      "Informe um autorizador de cortesia valido para editar.",
      400,
    );
  }

  if (!name) {
    throw new OpsReferenceDataError(
      "invalid_reference_payload",
      "Informe o nome do autorizador de cortesia.",
      400,
    );
  }

  return {
    id: mode === "update" ? id : null,
    name,
    reason: normalizeReason(
      input.reason,
      mode === "create"
        ? "Cadastro operacional de autorizador de cortesia no BFF"
        : "Edicao operacional de autorizador de cortesia no BFF",
    ),
    actor: input.actor ?? null,
  };
}

async function listDiscountTypes() {
  const pool = getIngressoDbPool();
  const result = await pool.query<DiscountTypeRow>(
    `
      SELECT
        descontos_tipos.id,
        descontos_tipos.descricao
      FROM descontos_tipos
      ORDER BY descontos_tipos.descricao ASC, descontos_tipos.id ASC
    `,
  );

  return result.rows.map((row) => ({
    id: row.id,
    description: String(row.descricao ?? "").trim(),
  }));
}

async function listDiscounts() {
  const pool = getIngressoDbPool();
  const result = await pool.query<DiscountRow>(
    `
      SELECT
        descontos.id,
        descontos.tipo_id,
        descontos.nome,
        descontos.tipo_aplicacao,
        descontos.valor::text AS valor,
        descontos_tipos.descricao AS tipo_desc
      FROM descontos
      JOIN descontos_tipos ON descontos_tipos.id = descontos.tipo_id
      ORDER BY descontos.nome ASC, descontos.id ASC
    `,
  );

  return result.rows.map((row) => ({
    id: row.id,
    typeId: row.tipo_id,
    typeDescription: row.tipo_desc ? String(row.tipo_desc).trim() : null,
    name: String(row.nome ?? "").trim(),
    applicationType: row.tipo_aplicacao ? String(row.tipo_aplicacao).trim() : null,
    value: Number(row.valor ?? 0).toFixed(2),
  }));
}

async function listCourtesyAuthors() {
  const pool = getIngressoDbPool();
  const result = await pool.query<CourtesyRow>(
    `
      SELECT
        cortesias.id,
        cortesias.nome
      FROM cortesias
      ORDER BY cortesias.nome ASC, cortesias.id ASC
    `,
  );

  return result.rows.map((row) => ({
    id: row.id,
    name: String(row.nome ?? "").trim(),
  }));
}

export async function getOperationalReferenceData(): Promise<OpsReferenceData> {
  const [discountTypes, discounts, courtesyAuthors] = await Promise.all([
    listDiscountTypes(),
    listDiscounts(),
    listCourtesyAuthors(),
  ]);

  return {
    discountTypes,
    discounts,
    courtesyAuthors,
  };
}

async function getOperationalReferenceDataWithClient(
  client: PoolClient,
): Promise<OpsReferenceData> {
  const [discountTypes, discounts, courtesyAuthors] = await Promise.all([
    listDiscountTypesWithClient(client),
    listDiscountsWithClient(client),
    listCourtesyAuthorsWithClient(client),
  ]);

  return {
    discountTypes,
    discounts,
    courtesyAuthors,
  };
}

async function listDiscountTypesWithClient(client: PoolClient) {
  const result = await client.query<DiscountTypeRow>(
    `
      SELECT
        descontos_tipos.id,
        descontos_tipos.descricao
      FROM descontos_tipos
      ORDER BY descontos_tipos.descricao ASC, descontos_tipos.id ASC
    `,
  );

  return result.rows.map((row) => ({
    id: row.id,
    description: String(row.descricao ?? "").trim(),
  }));
}

async function listDiscountsWithClient(client: PoolClient) {
  const result = await client.query<DiscountRow>(
    `
      SELECT
        descontos.id,
        descontos.tipo_id,
        descontos.nome,
        descontos.tipo_aplicacao,
        descontos.valor::text AS valor,
        descontos_tipos.descricao AS tipo_desc
      FROM descontos
      JOIN descontos_tipos ON descontos_tipos.id = descontos.tipo_id
      ORDER BY descontos.nome ASC, descontos.id ASC
    `,
  );

  return result.rows.map((row) => ({
    id: row.id,
    typeId: row.tipo_id,
    typeDescription: row.tipo_desc ? String(row.tipo_desc).trim() : null,
    name: String(row.nome ?? "").trim(),
    applicationType: row.tipo_aplicacao ? String(row.tipo_aplicacao).trim() : null,
    value: Number(row.valor ?? 0).toFixed(2),
  }));
}

async function listCourtesyAuthorsWithClient(client: PoolClient) {
  const result = await client.query<CourtesyRow>(
    `
      SELECT
        cortesias.id,
        cortesias.nome
      FROM cortesias
      ORDER BY cortesias.nome ASC, cortesias.id ASC
    `,
  );

  return result.rows.map((row) => ({
    id: row.id,
    name: String(row.nome ?? "").trim(),
  }));
}

async function assertDiscountTypeExists(client: PoolClient, typeId: number) {
  const result = await client.query<{ id: number }>(
    "SELECT id FROM descontos_tipos WHERE id = $1 LIMIT 1",
    [typeId],
  );

  if (!result.rows[0]) {
    throw new OpsReferenceDataError(
      "discount_type_not_found",
      "Tipo de desconto inexistente.",
      404,
    );
  }
}

async function assertDiscountTypeDescriptionAvailable(
  client: PoolClient,
  description: string,
  ignoredId: number | null,
) {
  const result = await client.query<{ id: number }>(
    `
      SELECT id
      FROM descontos_tipos
      WHERE LOWER(descricao) = LOWER($1)
        AND ($2::integer IS NULL OR id <> $2)
      LIMIT 1
    `,
    [description, ignoredId],
  );

  if (result.rows[0]) {
    throw new OpsReferenceDataError(
      "discount_type_already_exists",
      "Ja existe um tipo com essa descricao.",
      409,
    );
  }
}

async function assertDiscountNameAvailable(
  client: PoolClient,
  typeId: number,
  name: string,
  ignoredId: number | null,
) {
  const result = await client.query<{ id: number }>(
    `
      SELECT id
      FROM descontos
      WHERE tipo_id = $1
        AND LOWER(nome) = LOWER($2)
        AND ($3::integer IS NULL OR id <> $3)
      LIMIT 1
    `,
    [typeId, name, ignoredId],
  );

  if (result.rows[0]) {
    throw new OpsReferenceDataError(
      "discount_already_exists",
      "Ja existe um desconto com esse nome nesse tipo.",
      409,
    );
  }
}

async function assertCourtesyNameAvailable(
  client: PoolClient,
  name: string,
  ignoredId: number | null,
) {
  const result = await client.query<{ id: number }>(
    `
      SELECT id
      FROM cortesias
      WHERE LOWER(nome) = LOWER($1)
        AND ($2::integer IS NULL OR id <> $2)
      LIMIT 1
    `,
    [name, ignoredId],
  );

  if (result.rows[0]) {
    throw new OpsReferenceDataError(
      "courtesy_author_already_exists",
      "Ja existe alguem cadastrado com esse nome.",
      409,
    );
  }
}

async function assertDiscountExists(client: PoolClient, id: number) {
  const result = await client.query<{ id: number }>(
    "SELECT id FROM descontos WHERE id = $1 LIMIT 1 FOR UPDATE",
    [id],
  );

  if (!result.rows[0]) {
    throw new OpsReferenceDataError(
      "discount_not_found",
      "Desconto nao encontrado.",
      404,
    );
  }
}

async function assertCourtesyExists(client: PoolClient, id: number) {
  const result = await client.query<{ id: number }>(
    "SELECT id FROM cortesias WHERE id = $1 LIMIT 1 FOR UPDATE",
    [id],
  );

  if (!result.rows[0]) {
    throw new OpsReferenceDataError(
      "courtesy_author_not_found",
      "Autorizador de cortesia nao encontrado.",
      404,
    );
  }
}

async function assertDiscountCanBeDeleted(client: PoolClient, id: number) {
  const result = await client.query<{ exists: number }>(
    "SELECT 1 AS exists FROM voucher WHERE desconto_id = $1 LIMIT 1",
    [id],
  );

  if (result.rows[0]) {
    throw new OpsReferenceDataError(
      "discount_in_use",
      "Nao e possivel excluir: ha voucher vinculado a este desconto.",
      409,
    );
  }
}

async function assertDiscountTypeCanBeDeleted(client: PoolClient, id: number) {
  const result = await client.query<{ exists: number }>(
    "SELECT 1 AS exists FROM descontos WHERE tipo_id = $1 LIMIT 1",
    [id],
  );

  if (result.rows[0]) {
    throw new OpsReferenceDataError(
      "discount_type_in_use",
      "Nao e possivel excluir: ha descontos vinculados.",
      409,
    );
  }
}

async function assertCourtesyCanBeDeleted(client: PoolClient, id: number) {
  const result = await client.query<{ exists: number }>(
    "SELECT 1 AS exists FROM voucher WHERE autorizado_por_id = $1 LIMIT 1",
    [id],
  );

  if (result.rows[0]) {
    throw new OpsReferenceDataError(
      "courtesy_author_in_use",
      "Nao e possivel excluir: ha voucher vinculado a este autorizador.",
      409,
    );
  }
}

export async function createOperationalDiscountType(
  input: DiscountTypeInput,
): Promise<OpsReferenceMutationSuccess> {
  const normalized = normalizeDiscountTypeInput(input, "create");
  const pool = getIngressoDbPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await assertDiscountTypeDescriptionAvailable(client, normalized.description, null);

    const result = await client.query<{ id: number }>(
      "INSERT INTO descontos_tipos (descricao) VALUES ($1) RETURNING id",
      [normalized.description],
    );
    const id = result.rows[0]?.id;

    if (!id) {
      throw new OpsReferenceDataError(
        "discount_type_create_failed",
        "Nao foi possivel cadastrar o tipo de desconto.",
        502,
      );
    }

    const auditLogId = await registerOpsAuditLog(client, {
      origem: "ops-reference",
      acao: "discount_type_create",
      descricao: `Tipo de desconto #${id} cadastrado no BFF.`,
      motivo: normalized.reason,
      usuarioNome: normalizeActorName(normalized.actor),
      detalhes: {
        resource: "discount_type",
        id,
        after: {
          description: normalized.description,
        },
      },
    });
    const referenceData = await getOperationalReferenceDataWithClient(client);

    await client.query("COMMIT");

    return {
      action: "create",
      resource: "discount_type",
      id,
      referenceData,
      auditLogId,
      message: "Tipo de desconto cadastrado com sucesso.",
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function updateOperationalDiscountType(
  input: DiscountTypeInput,
): Promise<OpsReferenceMutationSuccess> {
  const normalized = normalizeDiscountTypeInput(input, "update");
  const id = normalized.id as number;
  const pool = getIngressoDbPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await assertDiscountTypeExists(client, id);
    await assertDiscountTypeDescriptionAvailable(
      client,
      normalized.description,
      id,
    );

    await client.query(
      "UPDATE descontos_tipos SET descricao = $2 WHERE id = $1",
      [id, normalized.description],
    );

    const auditLogId = await registerOpsAuditLog(client, {
      origem: "ops-reference",
      acao: "discount_type_update",
      descricao: `Tipo de desconto #${id} editado no BFF.`,
      motivo: normalized.reason,
      usuarioNome: normalizeActorName(normalized.actor),
      detalhes: {
        resource: "discount_type",
        id,
        after: {
          description: normalized.description,
        },
      },
    });
    const referenceData = await getOperationalReferenceDataWithClient(client);

    await client.query("COMMIT");

    return {
      action: "update",
      resource: "discount_type",
      id,
      referenceData,
      auditLogId,
      message: "Tipo de desconto alterado com sucesso.",
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteOperationalDiscountType(input: {
  id?: number | null;
  reason?: string | null;
  actor?: ReferenceActor | null;
}): Promise<OpsReferenceMutationSuccess> {
  const id = Number(input.id);

  if (!Number.isInteger(id) || id <= 0) {
    throw new OpsReferenceDataError(
      "invalid_reference_payload",
      "Informe um tipo de desconto valido para excluir.",
      400,
    );
  }

  const pool = getIngressoDbPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await assertDiscountTypeExists(client, id);
    await assertDiscountTypeCanBeDeleted(client, id);
    await client.query("DELETE FROM descontos_tipos WHERE id = $1", [id]);

    const auditLogId = await registerOpsAuditLog(client, {
      origem: "ops-reference",
      acao: "discount_type_delete",
      descricao: `Tipo de desconto #${id} excluido no BFF.`,
      motivo: normalizeReason(
        input.reason,
        "Exclusao operacional de tipo de desconto no BFF",
      ),
      usuarioNome: normalizeActorName(input.actor),
      detalhes: {
        resource: "discount_type",
        id,
      },
    });
    const referenceData = await getOperationalReferenceDataWithClient(client);

    await client.query("COMMIT");

    return {
      action: "delete",
      resource: "discount_type",
      id,
      referenceData,
      auditLogId,
      message: "Tipo de desconto excluido com sucesso.",
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function createOperationalDiscount(
  input: DiscountInput,
): Promise<OpsReferenceMutationSuccess> {
  const normalized = normalizeDiscountInput(input, "create");
  const pool = getIngressoDbPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await assertDiscountTypeExists(client, normalized.typeId);
    await assertDiscountNameAvailable(
      client,
      normalized.typeId,
      normalized.name,
      null,
    );

    const result = await client.query<{ id: number }>(
      `
        INSERT INTO descontos (
          tipo_id,
          nome,
          tipo_aplicacao,
          valor
        ) VALUES ($1, $2, $3, $4)
        RETURNING id
      `,
      [
        normalized.typeId,
        normalized.name,
        normalized.applicationType,
        normalized.value,
      ],
    );
    const id = result.rows[0]?.id;

    if (!id) {
      throw new OpsReferenceDataError(
        "discount_create_failed",
        "Nao foi possivel cadastrar o desconto.",
        502,
      );
    }

    const auditLogId = await registerOpsAuditLog(client, {
      origem: "ops-reference",
      acao: "discount_create",
      descricao: `Desconto #${id} cadastrado no BFF.`,
      motivo: normalized.reason,
      usuarioNome: normalizeActorName(normalized.actor),
      detalhes: {
        resource: "discount",
        id,
        after: {
          typeId: normalized.typeId,
          name: normalized.name,
          applicationType: normalized.applicationType,
          value: normalized.value,
        },
      },
    });
    const referenceData = await getOperationalReferenceDataWithClient(client);

    await client.query("COMMIT");

    return {
      action: "create",
      resource: "discount",
      id,
      referenceData,
      auditLogId,
      message: "Desconto cadastrado com sucesso.",
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function updateOperationalDiscount(
  input: DiscountInput,
): Promise<OpsReferenceMutationSuccess> {
  const normalized = normalizeDiscountInput(input, "update");
  const id = normalized.id as number;
  const pool = getIngressoDbPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await assertDiscountExists(client, id);
    await assertDiscountTypeExists(client, normalized.typeId);
    await assertDiscountNameAvailable(
      client,
      normalized.typeId,
      normalized.name,
      id,
    );

    await client.query(
      `
        UPDATE descontos
        SET tipo_id = $2,
            nome = $3,
            tipo_aplicacao = $4,
            valor = $5
        WHERE id = $1
      `,
      [
        id,
        normalized.typeId,
        normalized.name,
        normalized.applicationType,
        normalized.value,
      ],
    );

    const auditLogId = await registerOpsAuditLog(client, {
      origem: "ops-reference",
      acao: "discount_update",
      descricao: `Desconto #${id} editado no BFF.`,
      motivo: normalized.reason,
      usuarioNome: normalizeActorName(normalized.actor),
      detalhes: {
        resource: "discount",
        id,
        after: {
          typeId: normalized.typeId,
          name: normalized.name,
          applicationType: normalized.applicationType,
          value: normalized.value,
        },
      },
    });
    const referenceData = await getOperationalReferenceDataWithClient(client);

    await client.query("COMMIT");

    return {
      action: "update",
      resource: "discount",
      id,
      referenceData,
      auditLogId,
      message: "Desconto alterado com sucesso.",
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteOperationalDiscount(input: {
  id?: number | null;
  reason?: string | null;
  actor?: ReferenceActor | null;
}): Promise<OpsReferenceMutationSuccess> {
  const id = Number(input.id);

  if (!Number.isInteger(id) || id <= 0) {
    throw new OpsReferenceDataError(
      "invalid_reference_payload",
      "Informe um desconto valido para excluir.",
      400,
    );
  }

  const pool = getIngressoDbPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await assertDiscountExists(client, id);
    await assertDiscountCanBeDeleted(client, id);
    await client.query("DELETE FROM descontos WHERE id = $1", [id]);

    const auditLogId = await registerOpsAuditLog(client, {
      origem: "ops-reference",
      acao: "discount_delete",
      descricao: `Desconto #${id} excluido no BFF.`,
      motivo: normalizeReason(
        input.reason,
        "Exclusao operacional de desconto no BFF",
      ),
      usuarioNome: normalizeActorName(input.actor),
      detalhes: {
        resource: "discount",
        id,
      },
    });
    const referenceData = await getOperationalReferenceDataWithClient(client);

    await client.query("COMMIT");

    return {
      action: "delete",
      resource: "discount",
      id,
      referenceData,
      auditLogId,
      message: "Desconto excluido com sucesso.",
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function createOperationalCourtesyAuthor(
  input: CourtesyInput,
): Promise<OpsReferenceMutationSuccess> {
  const normalized = normalizeCourtesyInput(input, "create");
  const pool = getIngressoDbPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await assertCourtesyNameAvailable(client, normalized.name, null);

    const result = await client.query<{ id: number }>(
      "INSERT INTO cortesias (nome) VALUES ($1) RETURNING id",
      [normalized.name],
    );
    const id = result.rows[0]?.id;

    if (!id) {
      throw new OpsReferenceDataError(
        "courtesy_author_create_failed",
        "Nao foi possivel cadastrar o autorizador de cortesia.",
        502,
      );
    }

    const auditLogId = await registerOpsAuditLog(client, {
      origem: "ops-reference",
      acao: "courtesy_author_create",
      descricao: `Autorizador de cortesia #${id} cadastrado no BFF.`,
      motivo: normalized.reason,
      usuarioNome: normalizeActorName(normalized.actor),
      detalhes: {
        resource: "courtesy_author",
        id,
        after: {
          name: normalized.name,
        },
      },
    });
    const referenceData = await getOperationalReferenceDataWithClient(client);

    await client.query("COMMIT");

    return {
      action: "create",
      resource: "courtesy_author",
      id,
      referenceData,
      auditLogId,
      message: "Autorizador de cortesia cadastrado com sucesso.",
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function updateOperationalCourtesyAuthor(
  input: CourtesyInput,
): Promise<OpsReferenceMutationSuccess> {
  const normalized = normalizeCourtesyInput(input, "update");
  const id = normalized.id as number;
  const pool = getIngressoDbPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await assertCourtesyExists(client, id);
    await assertCourtesyNameAvailable(client, normalized.name, id);

    await client.query("UPDATE cortesias SET nome = $2 WHERE id = $1", [
      id,
      normalized.name,
    ]);

    const auditLogId = await registerOpsAuditLog(client, {
      origem: "ops-reference",
      acao: "courtesy_author_update",
      descricao: `Autorizador de cortesia #${id} editado no BFF.`,
      motivo: normalized.reason,
      usuarioNome: normalizeActorName(normalized.actor),
      detalhes: {
        resource: "courtesy_author",
        id,
        after: {
          name: normalized.name,
        },
      },
    });
    const referenceData = await getOperationalReferenceDataWithClient(client);

    await client.query("COMMIT");

    return {
      action: "update",
      resource: "courtesy_author",
      id,
      referenceData,
      auditLogId,
      message: "Autorizador de cortesia alterado com sucesso.",
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteOperationalCourtesyAuthor(input: {
  id?: number | null;
  reason?: string | null;
  actor?: ReferenceActor | null;
}): Promise<OpsReferenceMutationSuccess> {
  const id = Number(input.id);

  if (!Number.isInteger(id) || id <= 0) {
    throw new OpsReferenceDataError(
      "invalid_reference_payload",
      "Informe um autorizador de cortesia valido para excluir.",
      400,
    );
  }

  const pool = getIngressoDbPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await assertCourtesyExists(client, id);
    await assertCourtesyCanBeDeleted(client, id);
    await client.query("DELETE FROM cortesias WHERE id = $1", [id]);

    const auditLogId = await registerOpsAuditLog(client, {
      origem: "ops-reference",
      acao: "courtesy_author_delete",
      descricao: `Autorizador de cortesia #${id} excluido no BFF.`,
      motivo: normalizeReason(
        input.reason,
        "Exclusao operacional de autorizador de cortesia no BFF",
      ),
      usuarioNome: normalizeActorName(input.actor),
      detalhes: {
        resource: "courtesy_author",
        id,
      },
    });
    const referenceData = await getOperationalReferenceDataWithClient(client);

    await client.query("COMMIT");

    return {
      action: "delete",
      resource: "courtesy_author",
      id,
      referenceData,
      auditLogId,
      message: "Autorizador de cortesia excluido com sucesso.",
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
