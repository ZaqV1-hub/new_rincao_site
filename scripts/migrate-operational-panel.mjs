import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

const migrations = [
  "2026-11-12-operational-panel-foundation.sql",
  "2026-11-12-operational-voucher-validity.sql",
  "2026-11-12-online-capacity.sql",
  "2026-11-12-operational-service-vouchers.sql",
  "2026-11-12-day-program.sql",
  "2026-11-12-weather-forecast.sql",
  "2026-11-12-cash-sessions.sql",
  "2026-11-12-voucher-notifications.sql",
  "2026-11-13-purchase-batches.sql",
  "2026-11-13-trip-counting.sql",
];

export function migrationSql(contents) {
  const sql = contents.trim().replace(/^BEGIN;\s*/i, "").replace(/\s*COMMIT;$/i, "").trim();
  if (/\b(?:BEGIN|COMMIT|ROLLBACK)\s*;/i.test(sql)) throw new Error("Unexpected nested transaction boundary");
  return sql;
}

export async function applyOperationalMigration(client, migration) {
  await client.query("BEGIN");
  try {
    await client.query("SELECT pg_advisory_xact_lock(735214, 1)");
    await client.query(`CREATE TABLE IF NOT EXISTS painel_schema_migrations (
      id TEXT PRIMARY KEY, checksum TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), applied_by TEXT NOT NULL DEFAULT CURRENT_USER
    )`);
    const { rows } = await client.query("SELECT checksum FROM painel_schema_migrations WHERE id = $1", [migration.id]);
    if (rows[0] && rows[0].checksum !== migration.checksum) throw new Error(`Migration checksum mismatch: ${migration.id}`);
    if (!rows[0]) {
      await client.query(migration.sql);
      await client.query("INSERT INTO painel_schema_migrations (id, checksum) VALUES ($1, $2)", [migration.id, migration.checksum]);
    }
    await client.query("COMMIT");
    return rows[0] ? "already_applied" : "applied";
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => !["--check", "--apply"].includes(arg)) || args.length > 1) throw new Error("Use --check ou --apply.");
  const apply = args[0] === "--apply";
  const connectionString = process.env.PANEL_MIGRATION_DATABASE_URL;
  if (!connectionString) throw new Error("Defina PANEL_MIGRATION_DATABASE_URL explicitamente; nenhum .env é carregado automaticamente.");
  const client = new Client({
    connectionString,
    connectionTimeoutMillis: 10000,
    options: `-c search_path=public -c statement_timeout=60000 -c lock_timeout=10000${apply ? "" : " -c default_transaction_read_only=on"}`,
  });
  await client.connect();
  try {
    const { rows: [target] } = await client.query("SELECT current_database() AS database, current_setting('server_version') AS version");
    console.log(JSON.stringify({ mode: apply ? "apply" : "check", ...target }));
    let pending = false;
    for (const id of migrations) {
      const contents = await readFile(new URL(`../docs/sql/${id}`, import.meta.url), "utf8");
      const migration = { id, checksum: createHash("sha256").update(contents).digest("hex"), sql: migrationSql(contents) };
      if (apply) {
        console.log(JSON.stringify({ id, checksum: migration.checksum, state: await applyOperationalMigration(client, migration) }));
      } else {
        const { rows: [table] } = await client.query("SELECT to_regclass('public.painel_schema_migrations') AS name");
        const rows = table.name ? (await client.query("SELECT checksum FROM painel_schema_migrations WHERE id = $1", [id])).rows : [];
        if (rows[0] && rows[0].checksum !== migration.checksum) throw new Error(`Migration checksum mismatch: ${id}`);
        pending ||= !rows[0];
        console.log(JSON.stringify({ id, checksum: migration.checksum, state: rows[0] ? "applied" : "pending" }));
      }
    }
    if (pending) process.exitCode = 2;
  } finally {
    await client.end();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    // Database driver messages can contain connection details; expose only a stable code.
    console.error(error instanceof Error && /^(Use |Defina |Migration checksum|Unexpected nested)/.test(error.message)
      ? error.message : `Migration failed (${typeof error?.code === "string" ? error.code : "unknown"}).`);
    process.exitCode = 1;
  });
}
