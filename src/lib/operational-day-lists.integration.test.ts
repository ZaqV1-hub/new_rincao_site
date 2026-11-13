import { randomBytes } from "node:crypto";
import { Pool } from "pg";
import { beforeAll, afterAll, beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { readOperationalDayList } from "./operational-day-lists";

const connectionString = process.env.PANEL_TEST_DATABASE_URL;
if (connectionString) {
  const url = new URL(connectionString);
  if (!["postgres:", "postgresql:"].includes(url.protocol) || url.hostname !== "127.0.0.1" || url.pathname !== "/chargeback_test_painel" || url.search || url.hash) {
    throw new Error("PANEL_TEST_DATABASE_URL must target the local chargeback_test_painel scratch database without options");
  }
}
describe.skipIf(!connectionString)("day lists PostgreSQL", () => {
  const schema = `day_lists_it_${randomBytes(8).toString("hex")}`;
  let admin: Pool;
  let pool: Pool;
  let created = false;
  beforeAll(async () => {
    admin = new Pool({ connectionString, connectionTimeoutMillis: 2000 });
    await admin.query(`CREATE SCHEMA ${schema}`); created = true;
    pool = new Pool({ connectionString, options: `-c search_path=${schema}`, connectionTimeoutMillis: 2000 });
    await pool.query(`CREATE TABLE agenda (idagenda INT PRIMARY KEY,dtagenda DATE,tpagenda TEXT);
      CREATE TABLE usuario (cpf TEXT PRIMARY KEY,nmusuario TEXT);
      CREATE TABLE compra (idcompra INT PRIMARY KEY,cpf TEXT,checkout_buyer_name TEXT,stcompra TEXT,tpcompra TEXT);
      CREATE TABLE voucher (idcompra INT,idagenda INT,dtinicio_validade DATE,parque_operacional TEXT,vlunicompra NUMERIC,idescola INT,tpvoucher TEXT,servico_id BIGINT,stusado TEXT);
      CREATE TABLE clientes (idcliente INT PRIMARY KEY,nome TEXT);
      CREATE TABLE agenda_extras (idagenda INT,idcliente INT,stagenda_cli TEXT,PRIMARY KEY(idagenda,idcliente));`);
  });
  afterAll(async () => { try { await pool?.end(); if (created) await admin.query(`DROP SCHEMA ${schema} CASCADE`); } finally { await admin?.end(); } });
  beforeEach(async () => {
    vi.stubEnv("OPERATIONAL_PARK_ID", "rincao");
    await pool.query(`TRUNCATE voucher,compra,usuario,agenda_extras,clientes,agenda;
      INSERT INTO agenda VALUES (1,'2099-11-15','padra'),(2,'2099-11-20','escol');`);
  });
  afterEach(() => vi.unstubAllEnvs());
  it("paginates all purchase statuses and sums only items belonging to the chosen date and park", async () => {
    await pool.query(`INSERT INTO compra SELECT i,NULL,'Comprador '||i,CASE WHEN i=22 THEN 'pend' ELSE 'conc' END,'ponli' FROM generate_series(1,22) i;
      INSERT INTO voucher SELECT i,1,NULL,NULL,10.25,NULL,'norma',NULL,'n' FROM generate_series(1,22) i;
      INSERT INTO voucher VALUES (22,2,NULL,NULL,999,NULL,'norma',NULL,'n'),(22,1,'2099-11-15','estancia',888,NULL,'norma',NULL,'n');
      INSERT INTO usuario VALUES ('123','Nome do cadastro'); UPDATE compra SET cpf='123' WHERE idcompra=22;`);
    const first = await readOperationalDayList(pool,"2099-11-15","purchases",1);
    expect(first).toMatchObject({ total: 22, pageCount: 2, pageSize: 20, counters: { origin: { all: 22, site: 22, gate: 0 }, type: { all: 22, dayuse: 22, group: 0 } } });
    expect(first.items).toHaveLength(20);
    expect(first.items[0]).toMatchObject({ purchaseId: 22,buyerName: "Comprador 22",status: "pend",dateAmountCents: 1025,itemCount: 1 });
    const last = await readOperationalDayList(pool,"2099-11-15","purchases",2);
    expect(last.items.map((item) => "purchaseId" in item && item.purchaseId)).toEqual([2,1]);
    expect(await readOperationalDayList(pool,"2099-11-15","purchases",3,{ origin: "site" })).toMatchObject({ total: 22, items: [], counters: { origin: { all: 22, site: 22, gate: 0 }, type: { all: 22, dayuse: 22, group: 0 } } });
  });
  it("filters distinct purchases by proven item presence and computes counters with the opposite filter", async () => {
    await pool.query(`INSERT INTO agenda VALUES (3,'2099-11-15','escol'),(4,'2099-11-15','igrej');
      INSERT INTO clientes VALUES (10,'Grupo A'),(20,'Grupo B');
      INSERT INTO agenda_extras VALUES (3,10,'abe'),(3,20,'abe');
      INSERT INTO compra VALUES
        (1,NULL,'Day use site','conc','ponli'),(2,NULL,'Grupo caixa','conc','bilhe'),
        (3,NULL,'Reserva de grupo','pend','reser'),(4,NULL,'Igreja site','conc','ponli'),
        (5,NULL,'Serviço site','conc','ponli'),(6,NULL,'Serviço caixa','conc','bilhe'),
        (7,NULL,'Canal legado','canc','other'),(8,NULL,'Compra mista','conc','ponli');
      INSERT INTO voucher VALUES
        (1,1,NULL,NULL,10,NULL,'norma',NULL,'n'),(1,1,NULL,NULL,10,NULL,'infan',NULL,'n'),
        (2,1,NULL,NULL,20,10,'norma',NULL,'n'),(3,1,NULL,NULL,30,NULL,'escol',NULL,'n'),
        (4,4,NULL,NULL,40,NULL,'norma',NULL,'n'),(5,3,NULL,NULL,50,10,'norma',1,'n'),
        (6,3,NULL,NULL,60,10,'espec',NULL,'n'),(7,1,NULL,NULL,70,NULL,'norma',NULL,'inv'),
        (8,1,NULL,NULL,10,NULL,'norma',NULL,'n'),(8,3,NULL,NULL,20,10,'escol',NULL,'n'),
        (8,3,NULL,NULL,30,10,'espec',1,'n'),(8,2,NULL,NULL,999,10,'escol',NULL,'n'),
        (8,1,NULL,'estancia',888,NULL,'norma',NULL,'n');`);
    const all = await readOperationalDayList(pool,"2099-11-15","purchases",1);
    expect(all).toMatchObject({ total: 8, filters: { origin: "all", type: "all", query: "" }, counters: {
      origin: { all: 8, site: 4, gate: 3 }, type: { all: 8, dayuse: 3, group: 4 },
    } });
    expect(all.items[0]).toMatchObject({ purchaseId: 8, itemCount: 3, dateAmountCents: 6000 });
    expect(all.items[0]).toMatchObject({ batchSelectable: false });
    expect(all.items.find(row => "purchaseId" in row && row.purchaseId === 1)).toMatchObject({ batchSelectable: true });
    expect(all.items.find(row => "purchaseId" in row && row.purchaseId === 7)).toMatchObject({ channel: "other" });
    const filtered = await readOperationalDayList(pool,"2099-11-15","purchases",1,{ origin: "site", type: "group" });
    expect(filtered).toMatchObject({ total: 2, filters: { origin: "site", type: "group", query: "" }, counters: {
      origin: { all: 4, site: 2, gate: 2 }, type: { all: 4, dayuse: 2, group: 2 },
    } });
    expect(filtered.items.map(row => "purchaseId" in row && row.purchaseId)).toEqual([8,4]);
    expect(filtered.items[0]).toMatchObject({ itemCount: 3, dateAmountCents: 6000 });
    const gate = await readOperationalDayList(pool,"2099-11-15","purchases",1,{ origin: "gate", type: "group" });
    expect(gate.items.map(row => "purchaseId" in row && row.purchaseId)).toEqual([3,2]);
  });
  it("searches checkout or registered names, exact purchase number and normalized CPF without interpreting wildcards", async () => {
    await pool.query(`INSERT INTO usuario VALUES ('529.982.247-25','Nome do cadastro');
      INSERT INTO compra VALUES (123,'529.982.247-25','Nome do checkout','conc','ponli'),
        (124,NULL,'Loja 100%_! especial','pend','bilhe'),(125,NULL,'Loja 100XX especial','conc','ponli');
      INSERT INTO voucher SELECT idcompra,1,NULL,NULL,10,NULL,'norma',NULL,'n' FROM compra;`);
    for (const query of ["checkout", "CADASTRO", "123", "52998224725", "529.982.247-25"]) {
      const result = await readOperationalDayList(pool,"2099-11-15","purchases",1,{ query });
      expect(result.total).toBe(1); expect(result.items[0]).toMatchObject({ purchaseId: 123 });
      expect(result).toMatchObject({ counters: { origin: { all: 1, site: 1, gate: 0 }, type: { all: 1, dayuse: 1, group: 0 } } });
    }
    const literal = await readOperationalDayList(pool,"2099-11-15","purchases",1,{ query: "  100%_!  " });
    expect(literal).toMatchObject({ total: 1, filters: { query: "100%_!" } });
    expect(literal.items[0]).toMatchObject({ purchaseId: 124 });
    expect(await readOperationalDayList(pool,"2099-11-15","purchases",1,{ query: "' OR 1=1 --" })).toMatchObject({ total: 0, items: [], counters: { origin: { all: 0, site: 0, gate: 0 }, type: { all: 0, dayuse: 0, group: 0 } } });
    expect(await readOperationalDayList(pool,"2099-11-15","purchases",1,{ query: "Loja", origin: "site" })).toMatchObject({ total: 1, counters: { origin: { all: 2, site: 1, gate: 1 }, type: { all: 1, dayuse: 1, group: 0 } } });
  });
  it("preserves two distinct clients in the same agenda and counts paid online people without services", async () => {
    await pool.query(`INSERT INTO clientes VALUES (10,'Escola A'),(20,'Escola B');
      INSERT INTO agenda_extras VALUES (2,10,'abe'),(2,20,'fec');
      INSERT INTO compra VALUES (1,NULL,'Pai','conc','ponli'),(2,NULL,'Pai','pend','ponli'),(3,NULL,'Caixa','conc','bilhe');
      INSERT INTO voucher VALUES (1,2,NULL,NULL,20,10,'escol',NULL,'n'),(1,2,NULL,NULL,20,10,'espec',1,'n'),
      (2,2,NULL,NULL,20,10,'escol',NULL,'n'),(3,2,NULL,NULL,20,10,'escol',NULL,'n'),
      (1,2,NULL,NULL,20,20,'escol',NULL,'n'),(1,2,NULL,NULL,20,20,'escol',NULL,'inv');`);
    const result = await readOperationalDayList(pool,"2099-11-20","groups",1);
    expect(result).toMatchObject({ total: 2,items: [
      { agendaId: 2,clientId: 10,clientName: "Escola A",paidOnlinePeople: 1 },
      { agendaId: 2,clientId: 20,clientName: "Escola B",paidOnlinePeople: 1 },
    ] });
  });
  it("rejects missing or fractional money instead of silently reporting a zero", async () => {
    await pool.query(`INSERT INTO compra VALUES (1,NULL,NULL,'conc','ponli');
      INSERT INTO voucher VALUES (1,1,NULL,NULL,NULL,NULL,'norma',NULL,'n');`);
    await expect(readOperationalDayList(pool,"2099-11-15","purchases",1)).rejects.toMatchObject({ code: "invalid_data" });
    await pool.query("UPDATE voucher SET vlunicompra=1.005");
    await expect(readOperationalDayList(pool,"2099-11-15","purchases",1)).rejects.toMatchObject({ code: "invalid_data" });
  });
  it("rejects invalid pagination and date without querying", async () => {
    const client = { query: vi.fn() };
    await expect(readOperationalDayList(client,"2099-02-30","groups",1)).rejects.toMatchObject({ code: "invalid_input" });
    await expect(readOperationalDayList(client,"2099-11-15","groups",0)).rejects.toMatchObject({ code: "invalid_input" });
    expect(client.query).not.toHaveBeenCalled();
  });
});
