import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getOperationalDaySummary, readOperationalDaySummary } from "./operational-day-summary";
const mock = vi.hoisted(() => ({ pool: null as Pool | null }));
vi.mock("@/lib/ingresso-db", () => ({ getIngressoSistemaDbPool: () => mock.pool, getIngressoSistemaDbDialect: () => "postgres" }));
const connectionString = process.env.PANEL_TEST_DATABASE_URL;
if (connectionString) {
  const url = new URL(connectionString);
  if (!["postgres:", "postgresql:"].includes(url.protocol) || url.hostname !== "127.0.0.1" ||
      url.pathname !== "/chargeback_test_painel" || url.search || url.hash) throw new Error("PANEL_TEST_DATABASE_URL must target only the chargeback_test_painel scratch database on 127.0.0.1 without URL options");
}
const date = "2099-11-15";
describe.skipIf(!connectionString)("operational summary PostgreSQL", () => {
  const schema = `operational_summary_it_${randomBytes(8).toString("hex")}`;
  let admin: Pool;
  let pool: Pool;
  let created = false;
  beforeAll(async () => {
    admin = new Pool({ connectionString, connectionTimeoutMillis: 2000 });
    await admin.query(`CREATE SCHEMA ${schema}`); created = true;
    pool = new Pool({ connectionString, options: `-c search_path=${schema}`, connectionTimeoutMillis: 2000 });
    mock.pool = pool;
    await pool.query(`CREATE TABLE tabpreco (idtabpreco INTEGER PRIMARY KEY);
      INSERT INTO tabpreco VALUES (1);
      CREATE TABLE agenda (idagenda INTEGER PRIMARY KEY, idtabpreco INTEGER REFERENCES tabpreco, dtagenda DATE, tpagenda VARCHAR(5), stagenda VARCHAR(3));
      CREATE TABLE agenda_extras (idagenda INTEGER REFERENCES agenda, idcliente INTEGER, PRIMARY KEY (idagenda,idcliente));
      CREATE TABLE compra (idcompra INTEGER PRIMARY KEY, tpcompra VARCHAR(5), stcompra VARCHAR(4), formapag VARCHAR(5), vltotcompra NUMERIC, vltotdesc NUMERIC);
      CREATE TABLE compra_pagamentos (id SERIAL PRIMARY KEY,idcompra INTEGER REFERENCES compra,forma_pagamento TEXT,valor NUMERIC);
      CREATE TABLE voucher (idvoucher SERIAL PRIMARY KEY,idcompra INTEGER REFERENCES compra,idagenda INTEGER REFERENCES agenda,
        tpvoucher VARCHAR(5),vlunicompra NUMERIC,stusado VARCHAR(3) DEFAULT 'n',dtuso DATE,idescola INTEGER,item_id INTEGER,vldesc NUMERIC,dtvalidade DATE);
    `);
    for (const migration of ["2026-11-12-operational-panel-foundation.sql", "2026-11-12-operational-voucher-validity.sql", "2026-11-12-operational-service-vouchers.sql"]) {
      await pool.query(await readFile(new URL(`../../docs/sql/${migration}`, import.meta.url), "utf8"));
    }
  });
  afterAll(async () => { try { await pool?.end(); if (created) await admin.query(`DROP SCHEMA ${schema} CASCADE`); } finally { await admin?.end(); } });
  beforeEach(async () => {
    vi.stubEnv("OPERATIONAL_PARK_ID", "rincao");
    await pool.query("TRUNCATE voucher,compra_pagamentos,compra,agenda_extras,operacao_dias,servico_datas,servicos_adicionais,agenda RESTART IDENTITY");
    await pool.query("INSERT INTO agenda VALUES (1,1,'2099-11-15','padra','abe')");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("returns proven empty sources but keeps future totals unavailable even without groups", async () => {
    const summary = await getOperationalDaySummary(date);
    expect(summary).toMatchObject({ park: "rincao", date, configurationRevision: null, groupCount: 0,
      revenue: { siteNetCents: { status: "available", value: 0 }, knownSubtotalCents: 0,
        totalCents: { status: "unavailable", value: null }, finalizedTripsNetCents: { status: "unavailable", value: null } },
      attendance: { dayUseAdmitted: { status: "available", value: 0 }, totalAdmitted: { status: "unavailable", value: null } },
      cash: { status: "unavailable", value: null }, receipts: { status: "unavailable", value: null }, expenses: { status: "unavailable", value: null } });
    expect((await pool.query("SELECT tablename FROM pg_tables WHERE schemaname=$1 AND tablename IN ('caixa_periodos','edicoes_log')", [schema])).rowCount).toBe(0);
  });
  it("sums net sold snapshots once with multiple payments and groups, excluding school and pending purchases", async () => {
    await pool.query(`INSERT INTO servicos_adicionais (parque,nome,preco_bilheteria) VALUES ('rincao','Serviço',25);
      INSERT INTO agenda VALUES (2,1,'2099-11-15','escol','abe');
      INSERT INTO agenda_extras VALUES (2,10),(2,20);
      INSERT INTO compra VALUES (1,'ponli','conc','pgseg',85,15),(2,'bilhe','conc','dinhe',50,10),(3,'ponli','conc','pgseg',200,0),(4,'ponli','pend','pgseg',900,0);
      INSERT INTO compra_pagamentos(idcompra,forma_pagamento,valor) VALUES (1,'pix',40),(1,'credi',45);
      INSERT INTO voucher(idcompra,idagenda,tpvoucher,vlunicompra,vldesc) VALUES (1,1,'norma',60,-15),(2,1,'infan',50,NULL),(4,1,'norma',900,NULL);
      INSERT INTO voucher(idcompra,idagenda,tpvoucher,vlunicompra,servico_id,dtinicio_validade,dtvalidade,parque_operacional) VALUES (1,1,'espec',25,1,'2099-11-15','2099-11-15','rincao');
      INSERT INTO voucher(idcompra,idagenda,tpvoucher,vlunicompra,idescola,stusado,dtuso) VALUES (3,2,'escol',100,10,'s','2099-11-15'),(3,2,'escol',100,20,'s','2099-11-15');
    `);
    const result = await getOperationalDaySummary(date);
    expect(result.revenue).toMatchObject({ siteNetCents: { value: 6000 }, gateNetCents: { value: 5000 }, servicesNetCents: { value: 2500 }, unclassifiedNetCents: { value: 0 }, knownSubtotalCents: 13500 });
    expect(result.groupCount).toBe(2);
    expect(result.forecast.ticketsForSelectedDate).toMatchObject({ value: 2 });
    expect(result.attendance.dayUseAdmitted).toMatchObject({ value: 0 });
  });
  it("classifies legacy services only through a stable catalog ID mapping and warns on unknown special items", async () => {
    await pool.query(`INSERT INTO servicos_adicionais (parque,nome,preco_bilheteria,legacy_ticket_id,ativo) VALUES ('rincao','Legado',11,44,FALSE);
      INSERT INTO compra VALUES (1,'ponli','conc','pgseg',28,0);
      INSERT INTO voucher(idcompra,idagenda,tpvoucher,vlunicompra,item_id,stusado,dtuso) VALUES (1,1,'espec',17,NULL,'s','2099-11-15'),(1,1,'espec',11,44,'s','2099-11-15');`);
    const result = await getOperationalDaySummary(date);
    expect(result.revenue).toMatchObject({ servicesNetCents: { value: 1100 }, unclassifiedNetCents: { value: 1700 }, knownSubtotalCents: 1100 });
    expect(result.attendance.dayUseAdmitted).toMatchObject({ value: 0 });
    expect(result.warnings).toEqual(expect.arrayContaining([expect.objectContaining({ code: "unclassified_sales" })]));
  });
  it("keeps chosen-visit revenue separate from actual admission and excludes another park", async () => {
    await pool.query(`UPDATE agenda SET dtagenda='2099-11-17';
      INSERT INTO compra VALUES (1,'ponli','conc','pgseg',10,0),(2,'ponli','conc','pgseg',999,0);
      INSERT INTO voucher(idcompra,idagenda,tpvoucher,vlunicompra,stusado,dtuso,dtinicio_validade,dtvalidade,parque_operacional)
      VALUES (1,1,'norma',10,'s','2099-11-20','2099-11-15','2099-12-14','rincao'),(2,1,'norma',999,'s','2099-11-20','2099-11-15','2099-12-14','estancia');`);
    const chosen = await getOperationalDaySummary(date);
    const used = await getOperationalDaySummary("2099-11-20");
    expect(chosen.revenue.siteNetCents).toMatchObject({ value: 1000 });
    expect(chosen.attendance.dayUseAdmitted).toMatchObject({ value: 0 });
    expect(used.revenue.siteNetCents).toMatchObject({ value: 0 });
    expect(used.attendance.dayUseAdmitted).toMatchObject({ value: 1 });
  });
  it("does not count service or school vouchers as persons and includes exempt admissions", async () => {
    await pool.query(`INSERT INTO compra VALUES (1,'bilhe','conc','dinhe',20,0);
      INSERT INTO voucher(idcompra,idagenda,tpvoucher,vlunicompra,stusado,dtuso,idescola)
      VALUES (1,1,'norma',20,'s','2099-11-15',NULL),(1,1,'isent',0,'s','2099-11-15',NULL),(1,1,'escol',0,'s','2099-11-15',10),(1,1,'espec',0,'s','2099-11-15',NULL);`);
    const summary = await getOperationalDaySummary(date);
    expect(summary.attendance.dayUseAdmitted).toMatchObject({ value: 2 });
    expect(summary.forecast.ticketsForSelectedDate).toMatchObject({ value: 2 });
  });
  it("does not require future settlement amounts from school vouchers to read known day-use revenue", async () => {
    await pool.query(`INSERT INTO compra VALUES (1,'ponli','conc','pgseg',10,0);
      INSERT INTO voucher(idcompra,idagenda,tpvoucher,vlunicompra,idescola)
      VALUES (1,1,'norma',10,NULL),(1,1,'escol',NULL,10);`);
    const summary = await getOperationalDaySummary(date);
    expect(summary.revenue.siteNetCents).toMatchObject({ value: 1000 });
    expect(summary.revenue.finalizedTripsNetCents).toMatchObject({ status: "unavailable", value: null });
  });
  it("keeps confirmed sales with unknown payment channels outside the known subtotal", async () => {
    await pool.query(`INSERT INTO compra VALUES (1,'reser','conc','N/A',10,0),(2,NULL,'conc',NULL,5,0);
      INSERT INTO voucher(idcompra,idagenda,tpvoucher,vlunicompra) VALUES (1,1,'norma',10),(2,1,'norma',5);`);
    const summary = await getOperationalDaySummary(date);
    expect(summary.revenue).toMatchObject({ gateNetCents: { value: 0 }, unclassifiedNetCents: { value: 1500 }, knownSubtotalCents: 0 });
    expect(summary.warnings).toEqual(expect.arrayContaining([expect.objectContaining({ code: "unclassified_sales" })]));
  });

  it("keeps financial summary readable when legacy day-use configuration is ambiguous", async () => {
    await pool.query(`INSERT INTO agenda VALUES (2,1,'2099-11-15','promo','abe');
      INSERT INTO compra VALUES (1,'ponli','conc','pgseg',10,0),(2,'bilhe','conc','dinhe',20,0);
      INSERT INTO voucher(idcompra,idagenda,tpvoucher,vlunicompra,stusado,dtuso)
      VALUES (1,1,'norma',10,'s','2099-11-15'),(2,2,'infan',20,'s','2099-11-15');`);
    const summary = await getOperationalDaySummary(date);
    expect(summary.configuration).toBeNull();
    expect(summary.configurationRevision).toBeNull();
    expect(summary.revenue).toMatchObject({ siteNetCents: { value: 1000 }, gateNetCents: { value: 2000 }, knownSubtotalCents: 3000 });
    expect(summary.attendance.dayUseAdmitted).toMatchObject({ value: 2 });
    expect(summary.warnings).toEqual(expect.arrayContaining([expect.objectContaining({ code: "configuration_ambiguous" })]));
  });
  it("still rejects configuration conflicts other than legacy ambiguity", async () => {
    await pool.query(`UPDATE agenda SET tpagenda='escol';
      INSERT INTO operacao_dias(parque,data,tabela_preco_id,day_use_agenda_id) VALUES('rincao','2099-11-15',1,1);`);
    await expect(getOperationalDaySummary(date)).rejects.toMatchObject({ code: "version_conflict" });
  });

  it("navigates across months to real movement and ignores prices without day use", async () => {
    await pool.query(`INSERT INTO agenda VALUES (2,1,'2099-10-31','promo','lot'),(3,1,'2099-12-02','escol','fec');
      INSERT INTO agenda_extras VALUES(3,10),(3,20);
      INSERT INTO operacao_dias(parque,data,tabela_preco_id) VALUES('rincao','2099-11-16',1);
      INSERT INTO operacao_dias(parque,data,tabela_preco_id,day_use_agenda_id,versao) VALUES('rincao','2099-11-15',1,1,7);`);
    const summary = await getOperationalDaySummary(date);
    expect(summary.navigation).toEqual({ previousDate: "2099-10-31", nextDate: "2099-12-02" });
    expect(summary.configurationRevision).toBe(7);
  });
  it("reads within a caller-owned read-only repeatable snapshot without committing it", async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      const before = await readOperationalDaySummary(client, date, "rincao");
      await pool.query("INSERT INTO compra VALUES(1,'ponli','conc','pgseg',10,0); INSERT INTO voucher(idcompra,idagenda,tpvoucher,vlunicompra) VALUES(1,1,'norma',10)");
      const after = await readOperationalDaySummary(client, date, "rincao");
      expect(after.revenue.siteNetCents).toEqual(before.revenue.siteNetCents);
      expect((await client.query("SHOW transaction_read_only")).rows[0].transaction_read_only).toBe("on");
      await client.query("ROLLBACK");
    } finally { client.release(); }
    expect((await getOperationalDaySummary(date)).revenue.siteNetCents).toMatchObject({ value: 1000 });
  });
  it("refuses unsafe money totals and preserves paid invalidated vouchers as a financial warning", async () => {
    await pool.query("INSERT INTO compra VALUES(1,'ponli','conc','pgseg',10,0); INSERT INTO voucher(idcompra,idagenda,tpvoucher,vlunicompra,stusado) VALUES(1,1,'norma',10,'inv')");
    const summary = await getOperationalDaySummary(date);
    expect(summary.revenue.siteNetCents).toMatchObject({ value: 1000 });
    expect(summary.warnings).toEqual(expect.arrayContaining([expect.objectContaining({ code: "paid_invalidated_vouchers" })]));
    await pool.query("UPDATE voucher SET vlunicompra=100000000000000");
    await expect(getOperationalDaySummary(date)).rejects.toMatchObject({ code: "summary_invalid_data" });
  });
});
