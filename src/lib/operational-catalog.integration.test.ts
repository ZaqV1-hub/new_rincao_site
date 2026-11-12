import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as services from "@/app/api/painel/servicos/route";
import * as locations from "@/app/api/painel/locais-caixa/route";
import { createOperationsSessionToken, OPERATIONS_COOKIE_NAME } from "@/lib/ops-session";
import { savePainelService } from "@/lib/painel-services";

const mock = vi.hoisted(() => ({ pool: null as Pool | null }));
vi.mock("@/lib/ingresso-db", () => ({
  getIngressoSistemaDbPool: () => mock.pool,
  getIngressoSistemaDbDialect: () => "postgres",
}));

// This suite may create and drop only its own schema in the local scratch database.
const connectionString = process.env.PANEL_TEST_DATABASE_URL;
if (connectionString) {
  const url = new URL(connectionString);
  if (!["postgres:", "postgresql:"].includes(url.protocol) || url.hostname !== "127.0.0.1" ||
    url.pathname !== "/chargeback_test_painel" || url.search || url.hash) {
    throw new Error("PANEL_TEST_DATABASE_URL must target the chargeback_test_painel scratch database on 127.0.0.1 without URL options");
  }
}

const actor = { name: "Gerente de teste", cpf: "00000000001" };
const manager = createOperationsSessionToken({
  authSource: "panel", role: "admin", legacyRoleId: 1, actorName: actor.name, actorCpf: actor.cpf,
  legacyResources: ["vis_ingesp", "vis_bilhet"],
});
const operator = createOperationsSessionToken({
  authSource: "panel", role: "operator", legacyRoleId: 3, legacyResources: ["vis_bilhet"],
});
const service = { name: "Armário", description: "Chave na entrada", active: true, sitePriceCents: null, gatePriceCents: 0 };
const location = { name: "Bilheteria", description: "", active: true };

function request(path: string, method: string, body?: unknown, session = manager) {
  return new Request(`https://example.test/api/painel/${path}`, {
    method,
    headers: { cookie: `${OPERATIONS_COOKIE_NAME}=${session}`, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe.skipIf(!connectionString)("operational catalog with PostgreSQL", () => {
  const schema = `operational_catalog_it_${randomBytes(8).toString("hex")}`;
  let created = false;
  let admin: Pool;
  let pool: Pool;
  let migration: string;

  beforeAll(async () => {
    admin = new Pool({ connectionString, connectionTimeoutMillis: 2_000 });
    await admin.query(`CREATE SCHEMA ${schema}`);
    created = true;
    pool = new Pool({ connectionString, options: `-c search_path=${schema}`, connectionTimeoutMillis: 2_000 });
    mock.pool = pool;
    await pool.query(`
      CREATE TABLE tabpreco (idtabpreco INTEGER PRIMARY KEY);
      INSERT INTO tabpreco VALUES (1);
      CREATE TABLE agenda (
        idagenda INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        dtagenda DATE, tpagenda VARCHAR(5), stagenda VARCHAR(3)
      );
      CREATE TABLE acl (idrecurso TEXT NOT NULL, idpapel INTEGER NOT NULL);
      CREATE TABLE edicoes_log (
        id SERIAL PRIMARY KEY, origem VARCHAR(30) NOT NULL, acao VARCHAR(30) NOT NULL,
        compra_id INTEGER, movimentacao_id INTEGER, movimentacao_tipo VARCHAR(20),
        periodo_id INTEGER, folha_id INTEGER, descricao TEXT NOT NULL, motivo TEXT NOT NULL,
        usuario_nome VARCHAR(255) CHECK (usuario_nome <> 'Erro de auditoria'),
        detalhes_json TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      INSERT INTO agenda (dtagenda, tpagenda, stagenda)
      SELECT d + offset_days, tipo, estado
      FROM (SELECT (NOW() AT TIME ZONE 'America/Sao_Paulo')::date AS d) today
      CROSS JOIN (VALUES
        (0, 'padra', 'abe'), (0, 'promo', 'abe'), (1, 'promo', 'abe'),
        (2, 'padra', 'fec'), (3, 'escol', 'abe'), (-1, 'padra', 'abe')
      ) data(offset_days, tipo, estado);
    `);
    migration = await readFile(new URL("../../docs/sql/2026-11-12-operational-panel-foundation.sql", import.meta.url), "utf8");
    await pool.query(migration);
  });

  afterAll(async () => {
    try {
      await pool?.end();
      if (created) await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    } finally {
      await admin?.end();
    }
  });

  beforeEach(async () => {
    vi.stubEnv("OPERATIONAL_PARK_ID", "rincao");
    await pool.query("TRUNCATE operacao_dias, servico_datas, servicos_adicionais, caixa_locais, edicoes_log RESTART IDENTITY");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("reapplies the migration and accepts a date with a price table and without day use", async () => {
    await pool.query(migration);
    const { rows } = await pool.query(`
      INSERT INTO operacao_dias (parque, data, tabela_preco_id) VALUES ('rincao', '2099-01-01', 1)
      RETURNING day_use_agenda_id, validade, limite_online, tipos_ingresso, estado, versao
    `);
    expect(rows).toEqual([{
      day_use_agenda_id: null, validade: "day", limite_online: null,
      tipos_ingresso: ["norma", "infan", "isent"], estado: "open", versao: 1,
    }]);
    await expect(pool.query("INSERT INTO operacao_dias (parque, data, tabela_preco_id) VALUES ('rincao', '2099-01-02', 999)"))
      .rejects.toMatchObject({ code: "23503" });
  });

  it("assigns only distinct open day use dates and audits the signed actor and actual reach", async () => {
    const result = await services.POST(request("servicos", "POST", { ...service, applyToOpenDates: true }));
    expect(result.status).toBe(201);
    expect(result.headers.get("cache-control")).toBe("private, no-store");
    expect(await result.json()).toEqual({ ok: true, data: { service: { ...service, id: 1, version: 1 }, appliedDates: 2 } });
    const links = await pool.query(`
      SELECT parque, servico_id, data - (NOW() AT TIME ZONE 'America/Sao_Paulo')::date AS offset_days
      FROM servico_datas ORDER BY data
    `);
    expect(links.rows).toEqual([
      { parque: "rincao", servico_id: "1", offset_days: 0 },
      { parque: "rincao", servico_id: "1", offset_days: 1 },
    ]);
    const audit = await pool.query("SELECT usuario_nome, detalhes_json::jsonb AS details FROM edicoes_log");
    expect(audit.rows).toEqual([{
      usuario_nome: actor.name,
      details: expect.objectContaining({ actorCpf: actor.cpf, park: "rincao", appliedDates: 2 }),
    }]);
  });

  it("rolls back the service and date links if audit fails", async () => {
    await expect(savePainelService({ ...service, applyToOpenDates: true }, { name: "Erro de auditoria", cpf: null }))
      .rejects.toMatchObject({ code: "23514" });
    expect((await pool.query("SELECT * FROM servicos_adicionais")).rowCount).toBe(0);
    expect((await pool.query("SELECT * FROM servico_datas")).rowCount).toBe(0);
  });

  it("round-trips unavailable, free, and maximum prices without changing their meaning", async () => {
    await services.POST(request("servicos", "POST", service));
    await services.POST(request("servicos", "POST", { ...service, name: "Vaga", sitePriceCents: 0, gatePriceCents: 999_999_999_999 }));
    const list = await services.GET(request("servicos", "GET"));
    expect(list.status).toBe(200);
    expect(await list.json()).toEqual({
      ok: true,
      data: [
        { ...service, id: 1, version: 1 },
        { ...service, id: 2, version: 1, name: "Vaga", sitePriceCents: 0, gatePriceCents: 999_999_999_999 },
      ],
    });
    expect((await pool.query("SELECT preco_site, preco_bilheteria FROM servicos_adicionais ORDER BY id")).rows).toEqual([
      { preco_site: null, preco_bilheteria: "0.00" },
      { preco_site: "0.00", preco_bilheteria: "9999999999.99" },
    ]);
  });

  it("keeps the stable service identity and links when deactivated", async () => {
    await services.POST(request("servicos", "POST", { ...service, applyToOpenDates: true }));
    const response = await services.PATCH(request("servicos", "PATCH", { ...service, id: 1, version: 1, active: false }));
    expect(await response.json()).toEqual({
      ok: true, data: { service: { ...service, id: 1, version: 2, active: false }, appliedDates: 0 },
    });
    expect((await pool.query("SELECT servico_id FROM servico_datas")).rows)
      .toEqual([{ servico_id: "1" }, { servico_id: "1" }]);
  });

  it("rejects forged park fields and keeps reads and writes scoped to the configured park", async () => {
    const createdService = await services.POST(request("servicos", "POST", service));
    const createdLocation = await locations.POST(request("locais-caixa", "POST", location));
    expect(createdService.status).toBe(201);
    expect(createdLocation.status).toBe(201);
    vi.stubEnv("OPERATIONAL_PARK_ID", "estancia");

    expect((await services.PATCH(request("servicos", "PATCH", { ...service, id: 1, version: 1, park: "rincao" }))).status).toBe(400);
    expect((await services.PATCH(request("servicos", "PATCH", { ...service, id: 1, version: 1 }))).status).toBe(409);
    expect((await locations.PATCH(request("locais-caixa", "PATCH", { ...location, id: 1, version: 1 }))).status).toBe(409);
    expect(await (await services.GET(request("servicos", "GET"))).json()).toEqual({ ok: true, data: [] });
    expect(await (await locations.GET(request("locais-caixa", "GET"))).json()).toEqual({ ok: true, data: [] });
    expect((await locations.POST(request("locais-caixa", "POST", location))).status).toBe(201);
    await expect(pool.query("INSERT INTO servico_datas (parque, data, servico_id) VALUES ('estancia', '2099-01-01', 1)"))
      .rejects.toMatchObject({ code: "23503" });
  });

  it("accepts only one of two competing service updates for the same version", async () => {
    await services.POST(request("servicos", "POST", service));
    const results = await Promise.all(["Vaga A", "Vaga B"].map((name) =>
      services.PATCH(request("servicos", "PATCH", { ...service, id: 1, version: 1, name })),
    ));
    expect(results.map((response) => response.status).sort()).toEqual([200, 409]);
    const winner = await results.find((response) => response.status === 200)!.json();
    const rejected = results.find((response) => response.status === 409)!;
    expect(rejected.headers.get("cache-control")).toBe("private, no-store");
    expect(await rejected.json()).toMatchObject({ ok: false, error: { code: "version_conflict" } });
    expect(await (await services.GET(request("servicos", "GET"))).json()).toEqual({
      ok: true, data: [{ ...service, id: 1, version: 2, name: winner.data.service.name }],
    });
    expect((await pool.query("SELECT * FROM edicoes_log")).rowCount).toBe(2);
  });

  it("lets a box office operator read locations and preserves location identity when deactivated", async () => {
    expect((await locations.POST(request("locais-caixa", "POST", location))).status).toBe(201);
    const duplicate = await locations.POST(request("locais-caixa", "POST", { ...location, name: "bilheteria" }));
    expect(duplicate.status).toBe(409);
    expect(await duplicate.json()).toMatchObject({ ok: false, error: { code: "duplicate_name" } });
    const update = await locations.PATCH(request("locais-caixa", "PATCH", { ...location, id: 1, version: 1, active: false }));
    expect(update.status).toBe(200);
    expect((await locations.PATCH(request("locais-caixa", "PATCH", { ...location, id: 1, version: 1 }))).status).toBe(409);
    expect(await (await locations.GET(request("locais-caixa", "GET", undefined, operator))).json()).toEqual({
      ok: true, data: [{ ...location, id: 1, version: 2, active: false }],
    });
  });
});
