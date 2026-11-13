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
      CREATE TABLE pagpagseguro(idcompra integer,idpagseguro text,status integer,"grossAmount" numeric,paymentmethodtype integer,"lastEventDate" timestamptz);
      CREATE TABLE compra (idcompra INTEGER PRIMARY KEY, tpcompra VARCHAR(5), stcompra VARCHAR(4), formapag VARCHAR(5), vltotcompra NUMERIC, vltotdesc NUMERIC,dtpagamento DATE);
      CREATE TABLE compra_pagamentos (id SERIAL PRIMARY KEY,idcompra INTEGER REFERENCES compra,forma_pagamento TEXT,valor NUMERIC,periodo_id INTEGER,recebido_em TIMESTAMPTZ);
      CREATE TABLE caixa_periodos (id SERIAL PRIMARY KEY,parque TEXT,data_operacional DATE,local_id BIGINT,fechado_em TIMESTAMPTZ,troco_inicial NUMERIC);
      CREATE TABLE voucher (idvoucher SERIAL PRIMARY KEY,idcompra INTEGER REFERENCES compra,idagenda INTEGER REFERENCES agenda,
        tpvoucher VARCHAR(5),vlunicompra NUMERIC,stusado VARCHAR(3) DEFAULT 'n',dtuso DATE,idescola INTEGER,item_id INTEGER,vldesc NUMERIC,dtvalidade DATE);
    `);
    for (const migration of ["2026-11-12-operational-panel-foundation.sql", "2026-11-12-operational-voucher-validity.sql", "2026-11-12-operational-service-vouchers.sql", "2026-11-12-day-program.sql", "2026-11-13-trip-counting.sql", "2026-11-13-trip-settlement.sql", "2026-11-13-day-closure.sql"]) {
      await pool.query(await readFile(new URL(`../../docs/sql/${migration}`, import.meta.url), "utf8"));
    }
  });
  afterAll(async () => { try { await pool?.end(); if (created) await admin.query(`DROP SCHEMA ${schema} CASCADE`); } finally { await admin?.end(); } });
  beforeEach(async () => {
    vi.stubEnv("OPERATIONAL_PARK_ID", "rincao");
    await pool.query("TRUNCATE pagpagseguro,caixa_periodos,voucher,compra_pagamentos,compra,agenda_extras,operacao_dias,servico_datas,servicos_adicionais,agenda RESTART IDENTITY CASCADE");
    await pool.query("INSERT INTO agenda VALUES (1,1,'2099-11-15','padra','abe')");
  });
  afterEach(() => vi.unstubAllEnvs());

  it('counts actual online gross receipts once on their payment date without changing visit revenue',async()=>{
    await pool.query(`UPDATE agenda SET dtagenda='2099-11-17';
      INSERT INTO compra(idcompra,tpcompra,stcompra,formapag,vltotcompra,vltotdesc,dtpagamento) VALUES(1,'ponli','conc','pgseg',350,0,'2099-11-15');
      INSERT INTO voucher(idcompra,idagenda,tpvoucher,vlunicompra) VALUES(1,1,'norma',200),(1,1,'norma',150);
      INSERT INTO pagpagseguro VALUES(1,'cielo-test',3,369.98,1,now());`);
    const paid=await getOperationalDaySummary('2099-11-15'),visit=await getOperationalDaySummary('2099-11-17');
    expect(paid.receipts.value).toBe(36998);expect(paid.revenue.totalCents.value).toBe(0);
    expect(visit.receipts.value).toBe(0);expect(visit.revenue.totalCents.value).toBe(35000);
  });
  it('marks online receipts without proven dates or gateway amounts unavailable instead of fabricating a total',async()=>{
    await pool.query(`INSERT INTO compra(idcompra,tpcompra,stcompra,formapag,vltotcompra,vltotdesc) VALUES(1,'ponli','conc','pgseg',100,0);INSERT INTO voucher(idcompra,idagenda,tpvoucher,vlunicompra) VALUES(1,1,'norma',100);`);
    expect((await getOperationalDaySummary(date)).receipts.status).toBe('unavailable');
    await pool.query("UPDATE compra SET dtpagamento='2099-11-15'");
    expect((await getOperationalDaySummary(date)).receipts.status).toBe('unavailable');
  });
  it("returns proven empty revenue and expense sources without inventing a daily closure", async () => {
    const summary = await getOperationalDaySummary(date);
    expect(summary).toMatchObject({ park: "rincao", date, configurationRevision: null, groupCount: 0,
      revenue: { siteNetCents: { status: "available", value: 0 }, knownSubtotalCents: 0,
        totalCents: { status: "available", value: 0 }, finalizedTripsNetCents: { status: "available", value: 0 } },
      attendance: { dayUseAdmitted: { status: "available", value: 0 }, totalAdmitted: { status: "available", value: 0 } },
      cash: { status: "available", value: 0 }, receipts: { status: "available", value: 0 }, expenses: { status: "available", value: 0 } });
    expect((await pool.query("SELECT * FROM caixa_periodos")).rowCount).toBe(0);
    expect((await pool.query("SELECT tablename FROM pg_tables WHERE schemaname=$1 AND tablename='edicoes_log'", [schema])).rowCount).toBe(0);
  });
  it("counts only completed current revisions, without duplicating school vouchers", async () => {
    await pool.query(`INSERT INTO agenda VALUES (2,1,'2099-11-15','escol','abe');
      INSERT INTO agenda_extras VALUES(2,10),(2,20);
      INSERT INTO passeio_operacao(parque,agenda_id,cliente_id,planned_people) VALUES('rincao',2,10,30),('rincao',2,20,5);
      INSERT INTO passeio_veiculos(parque,agenda_id,cliente_id,tipo) VALUES('rincao',2,10,'bus'),('rincao',2,20,'van');
      INSERT INTO passeio_contagens(id,parque,vehicle_id,catalog_version,status,owner_cpf,counts,responsible_name,responsible_phone,contact_confirmed,completed_at,created_by)
      VALUES('11111111-1111-1111-1111-111111111111','rincao',1,1,'completed','52998224725','{"adult":10,"child":20,"coordinator":0,"pcdChild":0,"pcdAdult":0,"pcdCompanion":0,"teacherChild":0,"exempt":0}', 'Maria','5511987654321',true,now(),'52998224725');
      UPDATE passeio_veiculos SET estado='completed',current_count_id='11111111-1111-1111-1111-111111111111',last_completed_count_id='11111111-1111-1111-1111-111111111111' WHERE id=1;
      INSERT INTO compra(idcompra,tpcompra,stcompra,formapag,vltotcompra,vltotdesc) VALUES(1,'ponli','conc','pix',10,0);
      INSERT INTO voucher(idcompra,idagenda,tpvoucher,vlunicompra,idescola,stusado,dtuso) VALUES(1,2,'escol',10,10,'s','2099-11-15');`);
    const summary = await getOperationalDaySummary(date);
    expect(summary.attendance).toMatchObject({ dayUseAdmitted: { value: 0 }, completedVehiclePeople: { value: 30 }, totalAdmitted: { status: "unavailable" } });
    expect(summary.forecast.plannedGroupPeople).toMatchObject({ status: "available", value: 35 });
    await pool.query("UPDATE passeio_veiculos SET estado='counting' WHERE id=1");
    expect((await getOperationalDaySummary(date)).attendance.completedVehiclePeople).toMatchObject({ value: 0 });
  });
  it("counts only explicit sessions for this park and date without treating opening cash as revenue", async () => {
    await pool.query(`INSERT INTO caixa_periodos(parque,data_operacional,local_id,fechado_em,troco_inicial) VALUES
      ('rincao','2099-11-15',1,NULL,100),('rincao','2099-11-15',1,now(),200),
      ('estancia','2099-11-15',2,NULL,900),('rincao','2099-11-16',3,NULL,800),(NULL,NULL,NULL,NULL,700);`);
    const summary = await getOperationalDaySummary(date);
    expect(summary.cash).toMatchObject({ status: "available", value: 2 });
    expect(summary.revenue.knownSubtotalCents).toBe(0);
    for (const source of [summary.receipts, summary.closure]) {
      expect(source).toMatchObject({ status: "available", value: 0 });
    }
  });
  it("navigates to session dates without an agenda and excludes foreign and unscoped cash", async () => {
    await pool.query(`INSERT INTO caixa_periodos(parque,data_operacional,local_id) VALUES
      ('rincao','2099-11-12',1),('rincao','2099-11-18',1),
      ('estancia','2099-11-14',2),('estancia','2099-11-16',2),(NULL,'2099-11-17',NULL);`);
    expect((await getOperationalDaySummary(date)).navigation).toEqual({ previousDate: "2099-11-12", nextDate: "2099-11-18" });
    const cashOnlyDate = await getOperationalDaySummary("2099-11-18");
    expect(cashOnlyDate.cash).toMatchObject({ status: "available", value: 1 });
    expect(cashOnlyDate.revenue.knownSubtotalCents).toBe(0);
  });
  it("sums net sold snapshots once with multiple payments and groups, excluding school and pending purchases", async () => {
    await pool.query(`INSERT INTO servicos_adicionais (parque,nome,preco_bilheteria) VALUES ('rincao','Serviço',25);
      INSERT INTO agenda VALUES (2,1,'2099-11-15','escol','abe');
      INSERT INTO agenda_extras VALUES (2,10),(2,20);
      INSERT INTO compra(idcompra,tpcompra,stcompra,formapag,vltotcompra,vltotdesc) VALUES (1,'ponli','conc','pgseg',85,15),(2,'bilhe','conc','dinhe',50,10),(3,'ponli','conc','pgseg',200,0),(4,'ponli','pend','pgseg',900,0);
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
      INSERT INTO compra(idcompra,tpcompra,stcompra,formapag,vltotcompra,vltotdesc) VALUES (1,'ponli','conc','pgseg',28,0);
      INSERT INTO voucher(idcompra,idagenda,tpvoucher,vlunicompra,item_id,stusado,dtuso) VALUES (1,1,'espec',17,NULL,'s','2099-11-15'),(1,1,'espec',11,44,'s','2099-11-15');`);
    const result = await getOperationalDaySummary(date);
    expect(result.revenue).toMatchObject({ servicesNetCents: { value: 1100 }, unclassifiedNetCents: { value: 1700 }, knownSubtotalCents: 1100 });
    expect(result.attendance.dayUseAdmitted).toMatchObject({ value: 0 });
    expect(result.warnings).toEqual(expect.arrayContaining([expect.objectContaining({ code: "unclassified_sales" })]));
  });
  it("keeps chosen-visit revenue separate from actual admission and excludes another park", async () => {
    await pool.query(`UPDATE agenda SET dtagenda='2099-11-17';
      INSERT INTO compra(idcompra,tpcompra,stcompra,formapag,vltotcompra,vltotdesc) VALUES (1,'ponli','conc','pgseg',10,0),(2,'ponli','conc','pgseg',999,0);
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
    await pool.query(`INSERT INTO compra(idcompra,tpcompra,stcompra,formapag,vltotcompra,vltotdesc) VALUES (1,'bilhe','conc','dinhe',20,0);
      INSERT INTO voucher(idcompra,idagenda,tpvoucher,vlunicompra,stusado,dtuso,idescola)
      VALUES (1,1,'norma',20,'s','2099-11-15',NULL),(1,1,'isent',0,'s','2099-11-15',NULL),(1,1,'escol',0,'s','2099-11-15',10),(1,1,'espec',0,'s','2099-11-15',NULL);`);
    const summary = await getOperationalDaySummary(date);
    expect(summary.attendance.dayUseAdmitted).toMatchObject({ value: 2 });
    expect(summary.forecast.ticketsForSelectedDate).toMatchObject({ value: 2 });
  });
  it("does not require future settlement amounts from school vouchers to read known day-use revenue", async () => {
    await pool.query(`INSERT INTO compra(idcompra,tpcompra,stcompra,formapag,vltotcompra,vltotdesc) VALUES (1,'ponli','conc','pgseg',10,0);
      INSERT INTO voucher(idcompra,idagenda,tpvoucher,vlunicompra,idescola)
      VALUES (1,1,'norma',10,NULL),(1,1,'escol',NULL,10);`);
    const summary = await getOperationalDaySummary(date);
    expect(summary.revenue.siteNetCents).toMatchObject({ value: 1000 });
    expect(summary.revenue.finalizedTripsNetCents).toMatchObject({ status: "available", value: 0 });
  });
  it("keeps confirmed sales with unknown payment channels outside the known subtotal", async () => {
    await pool.query(`INSERT INTO compra(idcompra,tpcompra,stcompra,formapag,vltotcompra,vltotdesc) VALUES (1,'reser','conc','N/A',10,0),(2,NULL,'conc',NULL,5,0);
      INSERT INTO voucher(idcompra,idagenda,tpvoucher,vlunicompra) VALUES (1,1,'norma',10),(2,1,'norma',5);`);
    const summary = await getOperationalDaySummary(date);
    expect(summary.revenue).toMatchObject({ gateNetCents: { value: 0 }, unclassifiedNetCents: { value: 1500 }, knownSubtotalCents: 0 });
    expect(summary.warnings).toEqual(expect.arrayContaining([expect.objectContaining({ code: "unclassified_sales" })]));
  });

  it("keeps financial summary readable when legacy day-use configuration is ambiguous", async () => {
    await pool.query(`INSERT INTO agenda VALUES (2,1,'2099-11-15','promo','abe');
      INSERT INTO compra(idcompra,tpcompra,stcompra,formapag,vltotcompra,vltotdesc) VALUES (1,'ponli','conc','pgseg',10,0),(2,'bilhe','conc','dinhe',20,0);
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
      await pool.query("INSERT INTO compra(idcompra,tpcompra,stcompra,formapag,vltotcompra,vltotdesc) VALUES(1,'ponli','conc','pgseg',10,0); INSERT INTO voucher(idcompra,idagenda,tpvoucher,vlunicompra) VALUES(1,1,'norma',10)");
      await pool.query("INSERT INTO caixa_periodos(parque,data_operacional,local_id) VALUES('rincao','2099-11-15',1),('rincao','2099-11-16',1)");
      const after = await readOperationalDaySummary(client, date, "rincao");
      expect(after.revenue.siteNetCents).toEqual(before.revenue.siteNetCents);
      expect(after.cash).toEqual(before.cash);
      expect(after.navigation).toEqual(before.navigation);
      expect((await client.query("SHOW transaction_read_only")).rows[0].transaction_read_only).toBe("on");
      await client.query("ROLLBACK");
    } finally { client.release(); }
    expect((await getOperationalDaySummary(date)).revenue.siteNetCents).toMatchObject({ value: 1000 });
    expect((await getOperationalDaySummary(date)).cash).toMatchObject({ status: "available", value: 1 });
  });
  it("refuses unsafe money totals and preserves paid invalidated vouchers as a financial warning", async () => {
    await pool.query("INSERT INTO compra(idcompra,tpcompra,stcompra,formapag,vltotcompra,vltotdesc) VALUES(1,'ponli','conc','pgseg',10,0); INSERT INTO voucher(idcompra,idagenda,tpvoucher,vlunicompra,stusado) VALUES(1,1,'norma',10,'inv')");
    const summary = await getOperationalDaySummary(date);
    expect(summary.revenue.siteNetCents).toMatchObject({ value: 1000 });
    expect(summary.warnings).toEqual(expect.arrayContaining([expect.objectContaining({ code: "paid_invalidated_vouchers" })]));
    await pool.query("UPDATE voucher SET vlunicompra=100000000000000");
    await expect(getOperationalDaySummary(date)).rejects.toMatchObject({ code: "summary_invalid_data" });
  });
  it('adds only the current immutable trip receipt once and separately sums operational expenses',async () => {
    await pool.query(`INSERT INTO agenda VALUES(2,1,'2099-11-15','escol','abe'); INSERT INTO agenda_extras VALUES(2,10);
      INSERT INTO passeio_operacao(parque,agenda_id,cliente_id) VALUES('rincao',2,10);
      INSERT INTO passeio_recibos(id,parque,agenda_id,cliente_id,visit_date,source_fingerprint,snapshot,actor_cpf) VALUES
       ('11111111-1111-1111-1111-111111111111','rincao',2,10,'2099-11-15',repeat('a',64),'{"calculation":{"totalTripCents":396000},"remainingCents":0,"pendingPaymentCents":0}','52998224725'),
       ('22222222-2222-2222-2222-222222222222','rincao',2,10,'2099-11-15',repeat('b',64),'{"calculation":{"totalTripCents":999999},"remainingCents":0,"pendingPaymentCents":0}','52998224725');
      UPDATE passeio_operacao SET finalized_receipt_id='11111111-1111-1111-1111-111111111111';
      INSERT INTO operacao_despesas(parque,visit_date,scope,description,category,amount_cents,method,reference,actor_cpf) VALUES('rincao','2099-11-15','trips','Monitoria','monitoria',10000,'pix','Comprovante','52998224725');`);
    const summary = await getOperationalDaySummary(date);
    expect(summary.revenue.finalizedTripsNetCents).toMatchObject({ value: 396000 });
    expect(summary.revenue.totalCents).toMatchObject({ value: 396000 });
    expect(summary.expenses).toMatchObject({ value: 10000 });
    await pool.query('UPDATE passeio_operacao SET finalized_receipt_id=NULL');
    expect((await getOperationalDaySummary(date)).revenue.finalizedTripsNetCents).toMatchObject({ value: 0 });
  });

});
