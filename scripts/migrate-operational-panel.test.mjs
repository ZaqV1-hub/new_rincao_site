import assert from "node:assert/strict";
import { test } from "node:test";
import { applyOperationalMigration, migrationSql } from "./migrate-operational-panel.mjs";

test("runs SQL and journal in the same transaction", async () => {
  const queries = [];
  const client = { query: async (sql) => { queries.push(sql); return { rows: [] }; } };
  assert.equal(await applyOperationalMigration(client, { id: "foundation", checksum: "abc", sql: "CREATE TABLE example(id int);" }), "applied");
  assert.equal(queries[0], "BEGIN");
  assert.equal(queries.at(-1), "COMMIT");
  assert.ok(queries.indexOf("CREATE TABLE example(id int);") < queries.findIndex((sql) => sql.startsWith("INSERT INTO painel_schema_migrations")));
});

test("refuses changed content of an applied migration and rolls back", async () => {
  const queries = [];
  const client = { query: async (sql) => { queries.push(sql); return { rows: sql.startsWith("SELECT checksum") ? [{ checksum: "previous" }] : [] }; } };
  await assert.rejects(applyOperationalMigration(client, { id: "foundation", checksum: "new", sql: "CREATE TABLE example(id int);" }), /checksum/);
  assert.equal(queries.at(-1), "ROLLBACK");
  assert.ok(!queries.some((sql) => sql.startsWith("CREATE TABLE example")));
});

test("does not reapply an identical migration", async () => {
  const queries = [];
  const client = { query: async (sql) => { queries.push(sql); return { rows: sql.startsWith("SELECT checksum") ? [{ checksum: "abc" }] : [] }; } };
  assert.equal(await applyOperationalMigration(client, { id: "foundation", checksum: "abc", sql: "CREATE TABLE example(id int);" }), "already_applied");
  assert.ok(!queries.includes("CREATE TABLE example(id int);"));
});

test("rolls back SQL failure without recording success", async () => {
  const queries = [];
  const client = { query: async (sql) => { queries.push(sql); if (sql === "BROKEN") throw new Error("syntax"); return { rows: [] }; } };
  await assert.rejects(applyOperationalMigration(client, { id: "foundation", checksum: "abc", sql: "BROKEN" }), /syntax/);
  assert.equal(queries.at(-1), "ROLLBACK");
  assert.ok(!queries.some((sql) => sql.startsWith("INSERT INTO painel_schema_migrations")));
});

test("unwraps only the file transaction and rejects nested transaction boundaries", () => {
  assert.equal(migrationSql("BEGIN;\nCREATE TABLE example(id int);\nCOMMIT;"), "CREATE TABLE example(id int);");
  assert.throws(() => migrationSql("BEGIN;\nCOMMIT;\nCREATE TABLE example(id int);\nCOMMIT;"), /transaction/);
});
