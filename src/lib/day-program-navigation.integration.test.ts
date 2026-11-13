import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { beforeAll, beforeEach, afterAll, afterEach, describe, it, expect, vi } from "vitest";
import * as programs from "./day-program";
import { getDayProgramNavigation } from "./day-program-navigation";
const mock = vi.hoisted(() => ({ pool: null as Pool | null }));
vi.mock("@/lib/ingresso-db", () => ({ getIngressoSistemaDbPool: () => mock.pool, getIngressoSistemaDbDialect: () => "postgres" }));
const connectionString = process.env.PANEL_TEST_DATABASE_URL;
if (connectionString) { const url = new URL(connectionString); if (!["postgres:", "postgresql:"].includes(url.protocol) || url.hostname !== "127.0.0.1" || url.pathname !== "/chargeback_test_painel" || url.search || url.hash) throw new Error("Use the authorized local scratch database without URL options"); }
const actor = { name: "Gerente", cpf: "00000000001" };
describe.skipIf(!connectionString)("program navigation PostgreSQL", () => {
  const schema = `program_nav_it_${randomBytes(8).toString("hex")}`;
  let admin: Pool; let pool: Pool; let created = false;
  beforeAll(async () => {
    admin = new Pool({ connectionString, connectionTimeoutMillis: 2000 }); await admin.query(`CREATE SCHEMA ${schema}`); created = true;
    pool = new Pool({ connectionString, options: `-c search_path=${schema}`, connectionTimeoutMillis: 2000 }); mock.pool = pool;
    await pool.query(`CREATE TABLE agenda(idagenda INTEGER PRIMARY KEY,dtagenda DATE,tpagenda TEXT,stagenda TEXT);
      CREATE TABLE clientes(idcliente INTEGER PRIMARY KEY,nome TEXT,endereco TEXT);
      CREATE TABLE agenda_extras(idagenda INTEGER REFERENCES agenda,idcliente INTEGER REFERENCES clientes,PRIMARY KEY(idagenda,idcliente));
      CREATE TABLE operacao_dias(parque TEXT,data DATE,estado TEXT,PRIMARY KEY(parque,data));
      CREATE TABLE compra(idcompra INTEGER PRIMARY KEY,stcompra TEXT,tpcompra TEXT,formapag TEXT);
      CREATE TABLE voucher(id INTEGER PRIMARY KEY,idcompra INTEGER,idagenda INTEGER,dtinicio_validade DATE,parque_operacional TEXT,tpvoucher TEXT,idescola INTEGER,servico_id INTEGER,stusado TEXT);
      CREATE TABLE edicoes_log(id SERIAL PRIMARY KEY,origem VARCHAR(30),acao VARCHAR(30),compra_id INTEGER,movimentacao_id INTEGER,
        movimentacao_tipo VARCHAR(20),periodo_id INTEGER,folha_id INTEGER,descricao TEXT,motivo TEXT,usuario_nome VARCHAR(255),detalhes_json TEXT,created_at TIMESTAMPTZ DEFAULT now());`);
    for (const migration of ["2026-11-12-day-program.sql", "2026-11-12-weather-forecast.sql", "2026-11-13-trip-counting.sql", "2026-11-13-counting-app-details.sql", "2026-11-13-counting-day-revisions.sql"]) await pool.query(await readFile(new URL(`../../docs/sql/${migration}`, import.meta.url), "utf8"));
  });
  beforeEach(async () => {
    vi.stubEnv("OPERATIONAL_PARK_ID", "rincao");
    await pool.query(`TRUNCATE programacao_exportacoes, programacao_contratacoes, passeio_veiculos, passeio_operacao, transportadores, programacoes_dia, operacao_dias, agenda_extras, clientes, agenda, compra, voucher, edicoes_log RESTART IDENTITY CASCADE;
      INSERT INTO agenda VALUES (1,'2099-10-30','padra','abe'),(2,'2099-11-01','padra','fec'),(3,'2099-11-02','escol','fec'),(4,'2099-11-10','padra','lot'),(5,'2099-11-11','padra','abe');
      INSERT INTO clientes VALUES (1,'Escola privada','Endereço privado'); INSERT INTO agenda_extras VALUES (3,1);
      INSERT INTO operacao_dias VALUES ('rincao','2099-11-11','closed');
      INSERT INTO programacoes_dia(parque,data) VALUES ('estancia','2099-11-10');`);
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
  afterAll(async () => { try { await pool?.end(); if (created) await admin.query(`DROP SCHEMA ${schema} CASCADE`); } finally { await admin?.end(); } });
  async function createExport(date: string) {
    const program = await programs.createDayProgram(date, {}, actor);
    await programs.markDayProgramExported(date, program.version!, actor, { expectedFingerprint: program.sourceFingerprint });
  }
  it("jumps across months over empty or closed day use, preserves groups and sold-out days, and scopes the park", async () => {
    await createExport("2099-11-02");
    const result = await getDayProgramNavigation("2099-11-03");
    expect(result).toEqual({ previousDate: "2099-11-02", nextDate: "2099-11-10", dates: [
      { date: "2099-10-30", status: "uncreated" }, { date: "2099-11-02", status: "exported" },
      { date: "2099-11-03", status: "uncreated" }, { date: "2099-11-10", status: "uncreated" },
    ] });
    expect(JSON.stringify(result)).not.toContain("privad");
  });
  it("reads at most seven date statuses in one batch and marks a same-version client edit stale", async () => {
    await createExport("2099-11-02");
    await pool.query(`INSERT INTO agenda VALUES (6,'2099-10-29','padra','abe'),(7,'2099-10-28','padra','abe'),
      (8,'2099-11-12','padra','abe'),(9,'2099-11-13','padra','abe'),(10,'2099-11-14','padra','abe');
      UPDATE clientes SET nome='Cliente alterado' WHERE idcliente=1`);
    const batch = vi.spyOn(programs, "getDayPrograms");
    const result = await getDayProgramNavigation("2099-11-03");
    expect(batch).toHaveBeenCalledTimes(1);
    expect(batch).toHaveBeenCalledWith(["2099-10-29", "2099-10-30", "2099-11-02", "2099-11-03", "2099-11-10", "2099-11-12", "2099-11-13"]);
    expect(result.dates.find((item) => item.date === "2099-11-02")?.status).toBe("created");
    expect((await pool.query("SELECT versao,exported_revision FROM programacoes_dia WHERE parque='rincao' AND data='2099-11-02'")).rows[0]).toEqual({ versao: 1, exported_revision: 1 });
  });
  it("marks same-version admission sales stale without fabricating uncreated status", async () => {
    await createExport("2099-11-10");
    await pool.query(`INSERT INTO compra VALUES (1,'conc','ponli',NULL); INSERT INTO voucher VALUES (1,1,4,NULL,NULL,'norma',NULL,NULL,NULL)`);
    expect((await getDayProgramNavigation("2099-11-03")).dates.find((item) => item.date === "2099-11-10")?.status).toBe("created");
  });
  it("propagates unavailable program sources instead of claiming the dates are uncreated", async () => {
    await pool.query("ALTER TABLE programacoes_dia RENAME TO programacoes_dia_hidden");
    try { await expect(getDayProgramNavigation("2099-11-03")).rejects.toMatchObject({ code: "42P01" }); }
    finally { await pool.query("ALTER TABLE programacoes_dia_hidden RENAME TO programacoes_dia"); }
  });
  it("rejects impossible dates", async () => { await expect(getDayProgramNavigation("2099-02-30")).rejects.toMatchObject({ code: "invalid_input" }); });
});
