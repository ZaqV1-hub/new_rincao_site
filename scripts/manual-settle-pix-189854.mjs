import { readFile } from "node:fs/promises";
import { Pool } from "pg";

const purchaseId = 189854;
const expectedPaymentId = "ef98ceaa-376c-497d-b542-c8f19af6acd6";
const expectedAmount = 134.7;
const environmentFile = "C:\\SitesData\\Rincao\\prod\\.env.local";

function parseEnvironment(source) {
  return Object.fromEntries(
    source
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const separator = line.indexOf("=");
        const key = line.slice(0, separator).trim();
        let value = line.slice(separator + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        return [key, value];
      }),
  );
}

const environment = parseEnvironment(await readFile(environmentFile, "utf8"));
const prefix = "INGRESSO_SISTEMA_DB_";
const required = ["HOST", "NAME", "USER", "PASSWORD"];

for (const key of required) {
  if (!environment[`${prefix}${key}`]) {
    throw new Error("Configuracao de banco de producao incompleta.");
  }
}

if (["mysql", "mariadb"].includes((environment[`${prefix}CLIENT`] ?? "postgres").toLowerCase())) {
  throw new Error("O banco configurado nao e PostgreSQL; nada foi alterado.");
}

const pool = new Pool({
  host: environment[`${prefix}HOST`],
  port: Number(environment[`${prefix}PORT`] ?? 5432),
  database: environment[`${prefix}NAME`],
  user: environment[`${prefix}USER`],
  password: environment[`${prefix}PASSWORD`],
  ssl:
    environment[`${prefix}SSL`] === "true"
      ? { rejectUnauthorized: true }
      : undefined,
  connectionTimeoutMillis: 10_000,
});

const client = await pool.connect();

try {
  await client.query("BEGIN");
  const result = await client.query(
    `
      SELECT compra.idcompra, compra.tpcompra, compra.stcompra,
             compra.dtcompra, compra.vltotcompra,
             pagpagseguro.idpagseguro, pagpagseguro.status,
             pagpagseguro."grossAmount" AS gross_amount
      FROM compra
      JOIN pagpagseguro ON pagpagseguro.idcompra = compra.idcompra
      WHERE compra.idcompra = $1
      FOR UPDATE OF compra, pagpagseguro
    `,
    [purchaseId],
  );

  if (result.rowCount !== 1) {
    throw new Error("Compra ou pagamento nao encontrado; nada alterado.");
  }

  const row = result.rows[0];
  const purchaseDate = String(row.dtcompra).slice(0, 10);

  if (
    String(row.tpcompra).trim() !== "ponli" ||
    String(row.stcompra).trim() !== "conc"
  ) {
    throw new Error("Compra nao corresponde ao tipo/status esperado; nada alterado.");
  }
  if (purchaseDate !== "2026-09-23") {
    throw new Error("Data da compra nao corresponde; nada alterado.");
  }
  if (String(row.idpagseguro).toLowerCase() !== expectedPaymentId) {
    throw new Error("ID do pagamento nao corresponde; nada alterado.");
  }
  if (
    Math.abs(Number(row.vltotcompra) - expectedAmount) > 0.01 ||
    Math.abs(Number(row.gross_amount) - expectedAmount) > 0.01
  ) {
    throw new Error("Valor nao corresponde ao comprovante; nada alterado.");
  }
  if (Number(row.status) !== 1) {
    throw new Error("Pagamento nao esta mais pendente; nada alterado.");
  }

  const updateResult = await client.query(
    "UPDATE pagpagseguro SET status = 3 WHERE idcompra = $1 AND status = 1",
    [purchaseId],
  );

  if (updateResult.rowCount !== 1) {
    throw new Error("Pagamento mudou durante a operacao; nada foi confirmado.");
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
    `
      INSERT INTO edicoes_log (
        origem, acao, compra_id, descricao, motivo,
        usuario_nome, detalhes_json, created_at
      ) VALUES ('compra', 'editar', $1, $2, $3, $4, $5, NOW())
    `,
    [
      purchaseId,
      "Pagamento Pix registrado como pago manualmente com base no comprovante enviado pela cliente.",
      "Comprovante Pix de R$ 134,70 em 23/09/2026 conferido; excecao aprovada por Isaque apesar do status pendente retornado pela Cielo.",
      "Isaque",
      JSON.stringify({
        via: "manual_pix_settlement_workflow",
        paymentId: expectedPaymentId,
        gatewayStatusBefore: Number(row.status),
        gatewayStatusAfter: 3,
        amount: expectedAmount,
        receiptDate: "2026-09-23",
        gatewayReportedPending: true,
      }),
    ],
  );

  await client.query("COMMIT");
  console.log(
    JSON.stringify({
      purchaseId,
      result: "manual_settlement_recorded",
      amount: expectedAmount,
    }),
  );
} catch (error) {
  await client.query("ROLLBACK").catch(() => undefined);
  console.error(error instanceof Error ? error.message : "Baixa manual falhou.");
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
