import type { PoolClient } from "pg";

type OpsAuditInput = {
  origem: string;
  acao: string;
  compraId?: number | null;
  movimentacaoId?: number | null;
  movimentacaoTipo?: string | null;
  periodoId?: number | null;
  folhaId?: number | null;
  descricao: string;
  motivo: string;
  usuarioNome?: string | null;
  detalhes?: unknown;
};

const auditTableReady = {
  mysql: false,
  postgres: false,
};

type OpsAuditClient = Pick<PoolClient, "query" | "release">;

function isMysqlDialect() {
  const explicit =
    process.env.INGRESSO_DB_CLIENT ?? process.env.INGRESSO_DB_DIALECT ?? "";
  const normalized = explicit.trim().toLowerCase();

  if (normalized === "mysql") {
    return true;
  }

  if (normalized === "postgres" || normalized === "pg") {
    return false;
  }

  return (
    Boolean(process.env.WP_DB_HOST) ||
    Boolean(process.env.GROUP_REGISTRATION_MYSQL_HOST) ||
    process.env.INGRESSO_DB_HOST?.toLowerCase().includes("mysql") === true
  );
}

function isSyntaxOrDialectError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code ?? "")
      : "";

  return (
    code === "42601" ||
    code === "ER_PARSE_ERROR" ||
    message.includes("syntax error") ||
    message.includes("auto_increment") ||
    message.includes("serial") ||
    message.includes("timestamptz")
  );
}

async function ensureMysqlOpsAuditLogTable(client: OpsAuditClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS edicoes_log (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      origem VARCHAR(30) NOT NULL,
      acao VARCHAR(30) NOT NULL,
      compra_id INT NULL,
      movimentacao_id INT NULL,
      movimentacao_tipo VARCHAR(20) NULL,
      periodo_id INT NULL,
      folha_id INT NULL,
      descricao TEXT NOT NULL,
      motivo TEXT NOT NULL,
      usuario_nome VARCHAR(255) NULL,
      detalhes_json LONGTEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_edicoes_log_created_at (created_at),
      KEY idx_edicoes_log_compra_id (compra_id),
      KEY idx_edicoes_log_periodo_id (periodo_id),
      KEY idx_edicoes_log_folha_id (folha_id)
    )
  `);
}

export async function ensureOpsAuditLogTable(
  client: OpsAuditClient,
  dialectHint?: "mysql" | "postgres",
) {
  const preferredDialect = dialectHint ?? (isMysqlDialect() ? "mysql" : "postgres");

  if (auditTableReady[preferredDialect]) {
    return;
  }

  async function ensurePostgresTable() {
    await client.query(`
      CREATE TABLE IF NOT EXISTS edicoes_log (
        id SERIAL PRIMARY KEY,
        origem VARCHAR(30) NOT NULL,
        acao VARCHAR(30) NOT NULL,
        compra_id INTEGER NULL,
        movimentacao_id INTEGER NULL,
        movimentacao_tipo VARCHAR(20) NULL,
        descricao TEXT NOT NULL,
        motivo TEXT NOT NULL,
        usuario_nome VARCHAR(255) NULL,
        detalhes_json TEXT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(
      "ALTER TABLE edicoes_log ADD COLUMN IF NOT EXISTS periodo_id INTEGER NULL",
    );
    await client.query(
      "ALTER TABLE edicoes_log ADD COLUMN IF NOT EXISTS folha_id INTEGER NULL",
    );
    await client.query(
      "CREATE INDEX IF NOT EXISTS idx_edicoes_log_created_at ON edicoes_log (created_at DESC)",
    );
    await client.query(
      "CREATE INDEX IF NOT EXISTS idx_edicoes_log_compra_id ON edicoes_log (compra_id)",
    );
    await client.query(
      "CREATE INDEX IF NOT EXISTS idx_edicoes_log_periodo_id ON edicoes_log (periodo_id)",
    );
    await client.query(
      "CREATE INDEX IF NOT EXISTS idx_edicoes_log_folha_id ON edicoes_log (folha_id)",
    );
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_edicoes_log_box_office_idempotency
      ON edicoes_log ((NULLIF(detalhes_json, '')::jsonb ->> 'idempotencyKey'))
      WHERE origem = 'ops-box-office'
        AND acao = 'sale_create'
        AND detalhes_json IS NOT NULL
    `);
  }

  try {
    if (preferredDialect === "mysql") {
      await ensureMysqlOpsAuditLogTable(client);
    } else {
      await ensurePostgresTable();
    }
  } catch (error) {
    if (!isSyntaxOrDialectError(error)) {
      throw error;
    }

    if (preferredDialect === "mysql") {
      await ensurePostgresTable();
    } else {
      await ensureMysqlOpsAuditLogTable(client);
    }
  }

  auditTableReady[preferredDialect] = true;
}

export async function registerOpsAuditLog(
  client: OpsAuditClient,
  input: OpsAuditInput,
  dialectHint?: "mysql" | "postgres",
) {
  const descricao = input.descricao.trim();
  const motivo = input.motivo.trim();

  if (!descricao || !motivo) {
    throw new Error("Descricao e motivo sao obrigatorios para auditoria.");
  }

  await ensureOpsAuditLogTable(client, dialectHint);

  const result = await client.query<{ id: number }>(
    `
      INSERT INTO edicoes_log (
        origem,
        acao,
        compra_id,
        movimentacao_id,
        movimentacao_tipo,
        periodo_id,
        folha_id,
        descricao,
        motivo,
        usuario_nome,
        detalhes_json,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
      RETURNING id
    `,
    [
      input.origem.trim(),
      input.acao.trim(),
      input.compraId ?? null,
      input.movimentacaoId ?? null,
      input.movimentacaoTipo?.trim() || null,
      input.periodoId ?? null,
      input.folhaId ?? null,
      descricao,
      motivo,
      input.usuarioNome?.trim() || null,
      input.detalhes === undefined ? null : JSON.stringify(input.detalhes),
    ],
  );

  return result.rows[0]?.id ?? null;
}
