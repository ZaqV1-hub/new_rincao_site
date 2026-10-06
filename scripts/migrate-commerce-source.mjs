import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Pool } from "pg";

const args = new Set(process.argv.slice(2));
const environment = process.argv.find((value) => value.startsWith("--environment="))?.split("=", 2)[1];
const apply = args.has("--apply");

if (environment !== "hml") {
  throw new Error("Informe --environment=hml; esta rotina nao aceita outros ambientes.");
}

const envFile = process.env.RINCAO_SITE_HML_ENV_FILE ?? "C:\\SitesData\\Rincao\\hml\\.env.local";
const backupRoot = process.env.RINCAO_SITE_HML_BACKUP_ROOT ?? "C:\\SitesData\\Rincao\\hml\\backups";

function loadEnvironment(contents) {
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const separator = line.indexOf("=");
    const name = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[name]) process.env[name] = value;
  }
}

function getPgConfig() {
  const connectionString = process.env.INGRESSO_SISTEMA_DB_URL;
  const host = process.env.INGRESSO_SISTEMA_DB_HOST;
  const database = process.env.INGRESSO_SISTEMA_DB_NAME;
  const user = process.env.INGRESSO_SISTEMA_DB_USER;
  if (!connectionString && (!host || !database || !user)) {
    throw new Error("Configuracao PostgreSQL do sistema ausente.");
  }
  return {
    ...(connectionString ? { connectionString } : {
      host,
      port: Number(process.env.INGRESSO_SISTEMA_DB_PORT ?? 5432),
      database,
      user,
      password: process.env.INGRESSO_SISTEMA_DB_PASSWORD,
    }),
    ssl: process.env.INGRESSO_SISTEMA_DB_SSL === "true" ? { rejectUnauthorized: true } : undefined,
    connectionTimeoutMillis: 10_000,
  };
}

async function readSnapshot(client) {
  const version = await client.query("SELECT current_setting('server_version_num') AS version");
  const purchase = await client.query("SELECT count(*)::int AS count FROM public.compra");
  const columns = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'compra'
    ORDER BY ordinal_position
  `);
  const indexes = await client.query(`
    SELECT indexname, indexdef FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'compra'
    ORDER BY indexname
  `);
  const constraints = await client.query(`
    SELECT conname, pg_get_constraintdef(oid) AS definition
    FROM pg_constraint
    WHERE conrelid = 'public.compra'::regclass
    ORDER BY conname
  `);
  const originNullCount = columns.rows.some((column) => column.column_name === "origem_checkout")
    ? (await client.query("SELECT count(*)::int AS count FROM public.compra WHERE origem_checkout IS NULL")).rows[0]?.count
    : null;
  return {
    serverVersion: version.rows[0]?.version,
    purchaseCount: purchase.rows[0]?.count,
    columns: columns.rows,
    indexes: indexes.rows,
    constraints: constraints.rows,
    originNullCount,
  };
}

async function ensureMigration(client) {
  await client.query("BEGIN");
  try {
    await client.query(`
      ALTER TABLE public.compra
        ADD COLUMN IF NOT EXISTS origem_checkout character varying(12),
        ADD COLUMN IF NOT EXISTS checkout_session_id character varying(120)
    `);
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'compra_origem_checkout_check'
            AND conrelid = 'public.compra'::regclass
        ) THEN
          ALTER TABLE public.compra
            ADD CONSTRAINT compra_origem_checkout_check
            CHECK (origem_checkout IS NULL OR origem_checkout IN ('site', 'lumi'));
        END IF;
      END $$
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS compra_checkout_session_id_uq
      ON public.compra (checkout_session_id)
      WHERE checkout_session_id IS NOT NULL
    `);
    await client.query(`COMMENT ON COLUMN public.compra.origem_checkout IS
      'Origem persistida do checkout: site ou lumi; NULL preserva origem historica desconhecida.'`);
    await client.query(`COMMENT ON COLUMN public.compra.checkout_session_id IS
      'Identificador idempotente da sessao de checkout externa, quando aplicavel.'`);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

const envContents = await readFile(resolve(envFile), "utf8");
loadEnvironment(envContents);
const pool = new Pool(getPgConfig());
try {
  const client = await pool.connect();
  try {
    const before = await readSnapshot(client);
    const expected = new Set(["origem_checkout", "checkout_session_id"]);
    let backupPath = null;
    if (apply) {
      await mkdir(backupRoot, { recursive: true });
      backupPath = resolve(backupRoot, `commerce-source-before-${new Date().toISOString().replaceAll(":", "-")}.json`);
      await writeFile(backupPath, `${JSON.stringify(before, null, 2)}\n`, { flag: "wx" });
      await ensureMigration(client);
    }
    const after = await readSnapshot(client);
    const afterColumns = new Set(after.columns.map((column) => column.column_name));
    const indexReady = after.indexes.some((index) => index.indexname === "compra_checkout_session_id_uq");
    const checkReady = after.constraints.some((constraint) => constraint.conname === "compra_origem_checkout_check");
    const ready = [...expected].every((column) => afterColumns.has(column)) && indexReady && checkReady;
    if ((apply && !ready) || before.purchaseCount !== after.purchaseCount) {
      throw new Error("Validacao de schema/contagem da migracao falhou.");
    }
    const result = {
      environment: "hml",
      applied: apply,
      migrationNeeded: !ready,
      databaseEngine: "postgres",
      serverVersion: after.serverVersion,
      purchaseRowsPreserved: after.purchaseCount,
      originColumnsReady: [...expected].every((column) => afterColumns.has(column)),
      idempotencyIndexReady: indexReady,
      originConstraintReady: checkReady,
      unclassifiedPurchaseRows: after.originNullCount,
      backupPath,
    };
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } finally {
    client.release();
  }
} finally {
  await pool.end();
}
