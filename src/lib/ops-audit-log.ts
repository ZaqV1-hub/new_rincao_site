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

let auditTableReady = false;

export async function ensureOpsAuditLogTable(client: PoolClient) {
  if (auditTableReady) {
    return;
  }

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

  auditTableReady = true;
}

export async function registerOpsAuditLog(
  client: PoolClient,
  input: OpsAuditInput,
) {
  const descricao = input.descricao.trim();
  const motivo = input.motivo.trim();

  if (!descricao || !motivo) {
    throw new Error("Descricao e motivo sao obrigatorios para auditoria.");
  }

  await ensureOpsAuditLogTable(client);

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
