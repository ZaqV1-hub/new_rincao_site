import { listPainelAgendaMonth } from "@/lib/painel-agenda";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { applyOperationalPriceTable, getOperationalDay, listOperationalDays, saveOperationalDay } from "./operational-day";
import * as route from "@/app/api/painel/dias/route";
import { createOperationsSessionToken, OPERATIONS_COOKIE_NAME } from "./ops-session";

const mock = vi.hoisted(() => ({ pool: null as Pool | null }));
vi.mock("@/lib/ingresso-db", () => ({ getIngressoSistemaDbPool: () => mock.pool, getIngressoSistemaDbDialect: () => "postgres" }));
const connectionString = process.env.PANEL_TEST_DATABASE_URL;
if (connectionString) {
  const url = new URL(connectionString);
  if (!["postgres:", "postgresql:"].includes(url.protocol) || url.hostname !== "127.0.0.1" ||
      url.pathname !== "/chargeback_test_painel" || url.search || url.hash) {
    throw new Error("PANEL_TEST_DATABASE_URL must target the chargeback_test_painel scratch database on 127.0.0.1 without URL options");
  }
}
const actor = { name: "Gerente confiável", cpf: "00000000001" };
const manager = createOperationsSessionToken({ authSource: "panel", role: "admin", legacyRoleId: 1,
  actorName: actor.name, actorCpf: actor.cpf, legacyResources: ["vis_agenda"] });
const input = { date: "2099-01-01", version: null, priceTableId: 1, dayUseOpen: false,
  validity: "day", onlineLimit: null, ticketTypes: ["norma", "infan", "isent"], serviceIds: [], reason: "Programação" };
function request(method: string, body?: unknown) {
  return new Request("https://example.test/api/painel/dias?date=2099-01-01", { method,
    headers: { cookie: `${OPERATIONS_COOKIE_NAME}=${manager}`, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body) });
}

describe.skipIf(!connectionString)("operational days with PostgreSQL", () => {
  const schema = `operational_days_it_${randomBytes(8).toString("hex")}`;
  let created = false;
  let admin: Pool;
  let pool: Pool;
  beforeAll(async () => {
    admin = new Pool({ connectionString, connectionTimeoutMillis: 2000 });
    await admin.query(`CREATE SCHEMA ${schema}`); created = true;
    pool = new Pool({ connectionString, options: `-c search_path=${schema}`, connectionTimeoutMillis: 2000 });
    mock.pool = pool;
    await pool.query(`
      CREATE TABLE tabpreco (idtabpreco INTEGER PRIMARY KEY, sttabpreco VARCHAR(4), nmtabpreco TEXT, vlnormal NUMERIC, vlinfant NUMERIC, vlnormalbil NUMERIC, vlinfantbil NUMERIC);
      INSERT INTO tabpreco (idtabpreco,sttabpreco) VALUES (1, 'ativ'), (2, 'ativ'), (3, 'inat');
      CREATE TABLE agenda (
        idagenda INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY, idtabpreco INTEGER REFERENCES tabpreco,
        dtagenda DATE, tpagenda VARCHAR(5), stagenda VARCHAR(3), dtcadastro DATE, hrcadastro TIME,
        usucadastro VARCHAR(11), dtualt DATE, hrualt TIME, usualt VARCHAR(11), idinformacao INTEGER, dspromocao TEXT, nmpromocional TEXT, dspromocional TEXT
      );
      CREATE TABLE informacao (idinformacao INTEGER PRIMARY KEY, nome TEXT);
      CREATE TABLE compra (id INTEGER PRIMARY KEY, idcompra INTEGER GENERATED ALWAYS AS (id) STORED UNIQUE, stcompra TEXT NOT NULL DEFAULT 'conc', idagenda INTEGER REFERENCES agenda, valor NUMERIC, idtabpreco INTEGER);
      CREATE TABLE voucher (id INTEGER PRIMARY KEY, compra_id INTEGER REFERENCES compra, validado BOOLEAN, validade DATE);
      CREATE TABLE acl (idrecurso TEXT NOT NULL, idpapel INTEGER NOT NULL);
      CREATE TABLE edicoes_log (
        id SERIAL PRIMARY KEY, origem VARCHAR(30) NOT NULL, acao VARCHAR(30) NOT NULL,
        compra_id INTEGER, movimentacao_id INTEGER, movimentacao_tipo VARCHAR(20), periodo_id INTEGER, folha_id INTEGER,
        descricao TEXT NOT NULL, motivo TEXT NOT NULL, usuario_nome VARCHAR(255) CHECK (usuario_nome <> 'Erro de auditoria'),
        detalhes_json TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await pool.query(await readFile(new URL("../../docs/sql/2026-11-12-operational-panel-foundation.sql", import.meta.url), "utf8"));
    await pool.query(await readFile(new URL("../../docs/sql/2026-11-12-online-capacity.sql", import.meta.url), "utf8"));
  });
  afterAll(async () => {
    try { await pool?.end(); if (created) await admin.query(`DROP SCHEMA ${schema} CASCADE`); }
    finally { await admin?.end(); }
  });
  beforeEach(async () => {
    vi.stubEnv("OPERATIONAL_PARK_ID", "rincao");
    await pool.query("TRUNCATE online_capacity_reservations, voucher, compra, operacao_dias, servico_datas, servicos_adicionais, agenda, edicoes_log RESTART IDENTITY");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("includes school and day-use agendas on the same calendar date", async () => {
    await pool.query("INSERT INTO agenda (idtabpreco,dtagenda,tpagenda,stagenda) VALUES (1,'2099-01-01','padra','abe'),(1,'2099-01-01','escol','abe')");
    const entries = await listPainelAgendaMonth(1, 2099);
    expect(entries.map(({ date, type }) => ({ date, type }))).toEqual([
      { date: input.date, type: "padra" }, { date: input.date, type: "escol" },
    ]);
  });

  it("persists prices without day use then opens with the stored price and trusted audit actor", async () => {
    const batch = await route.PATCH(request("PATCH", { dates: [{ date: input.date, version: null }], priceTableId: 2, reason: "Alta temporada" }));
    expect(batch.status).toBe(200);
    expect((await pool.query("SELECT * FROM agenda")).rowCount).toBe(0);
    const day = await getOperationalDay(input.date);
    expect(day).toEqual({ date: input.date, version: 1, priceTableId: 2, dayUseAgendaId: null, dayUseOpen: false,
      validity: "day", onlineLimit: null, ticketTypes: ["norma", "infan", "isent"], serviceIds: [], closed: false });
    const open = await route.POST(request("POST", { ...input, priceTableId: day.priceTableId, version: day.version, dayUseOpen: true }));
    expect(open.status).toBe(200);
    expect(open.headers.get("cache-control")).toBe("private, no-store");
    expect((await open.json()).data).toMatchObject({ version: 2, dayUseAgendaId: 1, dayUseOpen: true, priceTableId: 2 });
    expect((await pool.query("SELECT idtabpreco, tpagenda, stagenda, usucadastro FROM agenda")).rows)
      .toEqual([{ idtabpreco: 2, tpagenda: "padra", stagenda: "abe", usucadastro: actor.cpf }]);
    expect((await pool.query("SELECT usuario_nome, detalhes_json::jsonb->>'actorCpf' AS cpf FROM edicoes_log")).rows)
      .toEqual([{ usuario_nome: actor.name, cpf: actor.cpf }, { usuario_nome: actor.name, cpf: actor.cpf }]);
    expect(await (await route.GET(request("GET"))).json()).toMatchObject({ ok: true, data: { version: 2 } });
  });

  it("changes only day use price and status, retaining group, promotion, information and existing purchase", async () => {
    await pool.query(`INSERT INTO agenda (idtabpreco,dtagenda,tpagenda,stagenda,idinformacao,dspromocao)
      VALUES (1,'2099-01-01','escol','abe',5,'Grupo'), (1,'2099-01-01','promo','abe',7,'Promoção');
      INSERT INTO compra (id,idagenda,valor,idtabpreco) VALUES (1,2,123.45,1); INSERT INTO voucher VALUES (1,1,FALSE,'2099-01-01')`);
    const groupBefore = (await pool.query("SELECT * FROM agenda WHERE idagenda=1")).rows;
    const purchaseBefore = (await pool.query("SELECT * FROM compra")).rows;
    const day = await saveOperationalDay({ ...input, priceTableId: 2 }, actor);
    expect(day).toMatchObject({ dayUseAgendaId: 2, dayUseOpen: false, version: 1 });
    expect((await pool.query("SELECT * FROM agenda WHERE idagenda=1")).rows).toEqual(groupBefore);
    expect((await pool.query("SELECT * FROM compra")).rows).toEqual(purchaseBefore);
    expect((await pool.query("SELECT id,compra_id,validado,validade::text FROM voucher")).rows).toEqual([{ id: 1, compra_id: 1, validado: false, validade: "2099-01-01" }]);
    expect((await pool.query("SELECT idtabpreco,stagenda,idinformacao,dspromocao FROM agenda WHERE idagenda=2")).rows)
      .toEqual([{ idtabpreco: 2, stagenda: "fec", idinformacao: 7, dspromocao: "Promoção" }]);
  });

  it("preserves sold-out sales while updating an open day-use configuration", async () => {
    await pool.query("INSERT INTO agenda (idtabpreco,dtagenda,tpagenda,stagenda) VALUES (1,'2099-01-01','padra','lot')");
    expect(await getOperationalDay(input.date)).toMatchObject({ dayUseOpen: true, onlineSoldOut: true });
    const updated = await saveOperationalDay({ ...input, dayUseOpen: true, validity: "7_days" }, actor);
    expect(updated).toMatchObject({ dayUseOpen: true, onlineSoldOut: true });
    expect((await pool.query("SELECT stagenda FROM agenda")).rows[0].stagenda).toBe("lot");
    await saveOperationalDay({ ...input, version: 1 }, actor);
    expect((await pool.query("SELECT stagenda FROM agenda")).rows[0].stagenda).toBe("fec");
  });

  it("does not reopen legacy closed day use when applying only its price", async () => {
    await pool.query("INSERT INTO agenda (idtabpreco,dtagenda,tpagenda,stagenda) VALUES (1,'2099-01-01','padra','fec')");
    const days = await applyOperationalPriceTable({ dates: [{ date: input.date, version: null }], priceTableId: 2, reason: "Preço" }, actor);
    expect(days[0]).toMatchObject({ dayUseAgendaId: 1, dayUseOpen: false, priceTableId: 2 });
    expect((await pool.query("SELECT stagenda FROM agenda")).rows).toEqual([{ stagenda: "fec" }]);
  });

  it("reads preexisting service links without config and replaces assignments in the same park", async () => {
    await pool.query(`INSERT INTO servicos_adicionais (parque,nome,preco_bilheteria) VALUES ('rincao','Armário',0),('rincao','Vaga',10),('estancia','Outro',5);
      INSERT INTO servico_datas VALUES ('rincao','2099-01-01',1)`);
    expect(await getOperationalDay(input.date)).toMatchObject({ version: null, serviceIds: [1] });
    await saveOperationalDay({ ...input, validity: "30_days", onlineLimit: 0, ticketTypes: ["isent"], serviceIds: [2] }, actor);
    expect((await pool.query("SELECT servico_id FROM servico_datas")).rows).toEqual([{ servico_id: "2" }]);
    await expect(saveOperationalDay({ ...input, version: 1, serviceIds: [3] }, actor)).rejects.toMatchObject({ code: "invalid_input" });
    await pool.query("UPDATE servicos_adicionais SET ativo=FALSE WHERE id=2");
    await expect(saveOperationalDay({ ...input, version: 1, serviceIds: [2] }, actor)).rejects.toMatchObject({ code: "invalid_input" });
    const days = await applyOperationalPriceTable({ dates: [{ date: input.date, version: 1 }], priceTableId: 2, reason: "Preço" }, actor);
    expect(days[0]).toMatchObject({ validity: "30_days", onlineLimit: 0, ticketTypes: ["isent"], serviceIds: [2] });
  });

  it("rejects missing and inactive price tables without persisting configuration", async () => {
    for (const priceTableId of [3, 999]) {
      await expect(saveOperationalDay({ ...input, priceTableId }, actor)).rejects.toMatchObject({ code: "invalid_input" });
    }
    expect((await pool.query("SELECT * FROM operacao_dias")).rowCount).toBe(0);
  });

  it("rolls back every date when a later date has a version conflict", async () => {
    await saveOperationalDay({ ...input, date: "2099-01-02" }, actor);
    await expect(applyOperationalPriceTable({ dates: [{ date: input.date, version: null }, { date: "2099-01-02", version: null }], priceTableId: 2, reason: "Preço" }, actor))
      .rejects.toMatchObject({ code: "version_conflict" });
    expect(await getOperationalDay(input.date)).toMatchObject({ version: null, priceTableId: null });
    expect(await getOperationalDay("2099-01-02")).toMatchObject({ version: 1, priceTableId: 1 });
    expect((await pool.query("SELECT * FROM edicoes_log")).rowCount).toBe(1);
  });

  it("rolls back config, agenda and services if audit fails", async () => {
    await pool.query("INSERT INTO servicos_adicionais (parque,nome,preco_bilheteria) VALUES ('rincao','Armário',0),('rincao','Vaga',10); INSERT INTO servico_datas VALUES ('rincao','2099-01-01',1)");
    await expect(saveOperationalDay({ ...input, dayUseOpen: true, serviceIds: [2] }, { name: "Erro de auditoria", cpf: null })).rejects.toMatchObject({ code: "23514" });
    for (const table of ["operacao_dias", "agenda", "edicoes_log"]) expect((await pool.query(`SELECT * FROM ${table}`)).rowCount).toBe(0);
    expect((await pool.query("SELECT servico_id FROM servico_datas")).rows).toEqual([{ servico_id: "1" }]);
  });

  it("rejects ambiguous legacy day use rather than changing an arbitrary agenda", async () => {
    await pool.query("INSERT INTO agenda (idtabpreco,dtagenda,tpagenda,stagenda) VALUES (1,'2099-01-01','padra','abe'),(2,'2099-01-01','promo','abe')");
    await expect(getOperationalDay(input.date)).rejects.toMatchObject({ code: "ambiguous_agenda" });
    await expect(saveOperationalDay(input, actor)).rejects.toMatchObject({ code: "ambiguous_agenda" });
    expect((await pool.query("SELECT * FROM operacao_dias")).rowCount).toBe(0);
  });

  it("blocks both changes when the operational day is finalized", async () => {
    await saveOperationalDay(input, actor);
    await pool.query("UPDATE operacao_dias SET estado='closed'");
    expect(await getOperationalDay(input.date)).toMatchObject({ closed: true });
    await expect(saveOperationalDay({ ...input, version: 1 }, actor)).rejects.toMatchObject({ code: "day_closed" });
    await expect(applyOperationalPriceTable({ dates: [{ date: input.date, version: 1 }], priceTableId: 2, reason: "Preço" }, actor)).rejects.toMatchObject({ code: "day_closed" });
  });

  it("serializes two first-time edits and accepts only one expected null version", async () => {
    const results = await Promise.all([1, 2].map((priceTableId) => route.POST(request("POST", { ...input, priceTableId, dayUseOpen: true }))));
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect((await pool.query("SELECT * FROM agenda")).rowCount).toBe(1);
    expect((await pool.query("SELECT * FROM edicoes_log")).rowCount).toBe(1);
    const existing = await Promise.all([1, 2].map((priceTableId) => route.POST(request("POST", { ...input, priceTableId, version: 1 }))));
    expect(existing.map((r) => r.status).sort()).toEqual([200, 409]);
  });

  it("rejects a mapped agenda that moved or became a group, including calendar reads", async () => {
    await saveOperationalDay({ ...input, dayUseOpen: true }, actor);
    await pool.query("UPDATE agenda SET tpagenda='escol'");
    await expect(getOperationalDay(input.date)).rejects.toMatchObject({ code: "version_conflict" });
    await expect(listOperationalDays("2099-01-01", "2099-01-31")).rejects.toMatchObject({ code: "version_conflict" });
    await expect(saveOperationalDay({ ...input, version: 1 }, actor)).rejects.toMatchObject({ code: "version_conflict" });
    await pool.query("UPDATE agenda SET tpagenda='padra', dtagenda='2099-01-02'");
    await expect(listOperationalDays("2099-01-01", "2099-01-31")).rejects.toMatchObject({ code: "version_conflict" });
  });

  it("lists only configured rows in the range and current park", async () => {
    await saveOperationalDay(input, actor);
    vi.stubEnv("OPERATIONAL_PARK_ID", "estancia");
    expect(await listOperationalDays("2099-01-01", "2099-01-31")).toEqual([]);
    await saveOperationalDay({ ...input, date: "2099-01-02" }, actor);
    expect(await listOperationalDays("2099-01-01", "2099-01-31")).toEqual([expect.objectContaining({ date: "2099-01-02", version: 1 })]);
  });
});
