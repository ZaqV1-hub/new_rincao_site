import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { autoCloseExpiredCashSessions, closeCashSession, closeLockedCashSession, createCashSessionMovement, getCashSession, listCashSessions, lockOpenCashSession, openCashSession, readCashSessionSnapshot, withCashSessionCommand } from "./operational-cash-session";
import { getSaoPauloToday } from "./operational-date";

const mock = vi.hoisted(() => ({ pool: null as Pool | null }));
vi.mock("@/lib/ingresso-db", () => ({ getIngressoSistemaDbPool: () => mock.pool, getIngressoSistemaDbDialect: () => "postgres" }));
const connectionString = process.env.PANEL_TEST_DATABASE_URL;
if (connectionString) {
  const url = new URL(connectionString);
  if (!["postgres:", "postgresql:"].includes(url.protocol) || url.hostname !== "127.0.0.1" || url.pathname !== "/chargeback_test_painel" || url.search || url.hash) throw new Error("PANEL_TEST_DATABASE_URL must use the local scratch database without URL options");
}
const actor = { name: "Operador A", cpf: "00000000001" }, secondActor = { name: "Operador B", cpf: "00000000002" };
const today = getSaoPauloToday();
const yesterday = getSaoPauloToday(new Date(Date.now() - 86400000));
const tomorrow = getSaoPauloToday(new Date(Date.now() + 86400000));
const opening = (key = "open", locationId = 1, openingCashCents = 10000) => ({ date: today, locationId, openingCashCents, idempotencyKey: key });
const movement = (periodId: number, key: string, type: "fundo" | "sangria", amountCents: number) => ({ periodId, type, amountCents, idempotencyKey: key, responsible: "Responsável", reason: "Conferência do caixa" });

describe.skipIf(!connectionString)("cash sessions with PostgreSQL", () => {
  const schema = `cash_sessions_it_${randomBytes(8).toString("hex")}`;
  let admin: Pool, pool: Pool, created = false, migration: string;
  beforeAll(async () => {
    admin = new Pool({ connectionString, connectionTimeoutMillis: 3000 });
    await admin.query(`CREATE SCHEMA ${schema}`); created = true;
    pool = new Pool({ connectionString, options: `-c search_path=${schema} -c statement_timeout=15000 -c lock_timeout=10000`, connectionTimeoutMillis: 3000, max: 8 }); mock.pool = pool;
    await pool.query(`
      CREATE TABLE tabpreco (idtabpreco INTEGER PRIMARY KEY);
      CREATE TABLE agenda (idagenda INTEGER PRIMARY KEY, tpagenda TEXT, dtagenda DATE);
      CREATE TABLE agenda_extras (idagenda INTEGER);
      CREATE TABLE compra (idcompra SERIAL PRIMARY KEY, tpcompra TEXT, stcompra TEXT, vltotcompra NUMERIC(10,2), vltotdesc NUMERIC(10,2));
      CREATE TABLE compra_pagamentos (id SERIAL PRIMARY KEY, idcompra INTEGER REFERENCES compra, forma_pagamento CHAR(5), valor NUMERIC(10,2) NOT NULL CHECK(valor>0),created_at TIMESTAMP DEFAULT now());
      CREATE TABLE voucher (idvoucher SERIAL PRIMARY KEY,idcompra INTEGER REFERENCES compra,idagenda INTEGER REFERENCES agenda,tpvoucher TEXT,vlunicompra NUMERIC(8,2),vldesc NUMERIC(8,2),stusado TEXT,idescola INTEGER,item_id INTEGER,descricao TEXT,autorizado_por_id INTEGER,dtvalidade DATE,periodo_id INTEGER,closed_at TIMESTAMP);
      CREATE TABLE passeio_recebimentos (method TEXT,amount_cents BIGINT,confirmed_at TIMESTAMPTZ,period_id INTEGER,status TEXT);
      CREATE TABLE caixa_periodos (id SERIAL PRIMARY KEY,aberto_em TIMESTAMPTZ NOT NULL DEFAULT now(),fechado_em TIMESTAMPTZ,operador VARCHAR(120),fechamento_auto BOOLEAN NOT NULL DEFAULT false,folha_id INTEGER,created_at TIMESTAMPTZ NOT NULL DEFAULT now());
      CREATE TABLE caixa_fechamentos (id SERIAL PRIMARY KEY,snapshot_json JSONB NOT NULL,totals_dinheiro NUMERIC(12,2) NOT NULL DEFAULT 0,totals_fundo NUMERIC(12,2) NOT NULL DEFAULT 0,totals_geral NUMERIC(12,2) NOT NULL DEFAULT 0,created_at TIMESTAMPTZ NOT NULL DEFAULT now(),periodo_id INTEGER);
      CREATE TABLE movimentacao_caixa (id SERIAL PRIMARY KEY,tipo VARCHAR(10) NOT NULL,responsavel VARCHAR(100) NOT NULL,valor NUMERIC(10,2) NOT NULL CHECK(valor>=0),data_hora TIMESTAMP NOT NULL DEFAULT now(),created_at TIMESTAMPTZ DEFAULT now());
      CREATE TABLE edicoes_log(id SERIAL PRIMARY KEY,origem VARCHAR(30) NOT NULL,acao VARCHAR(30) NOT NULL,compra_id INTEGER,movimentacao_id INTEGER,movimentacao_tipo VARCHAR(20),periodo_id INTEGER,folha_id INTEGER,descricao TEXT NOT NULL,motivo TEXT NOT NULL,usuario_nome VARCHAR(255) CHECK(usuario_nome<>'Audit failure'),detalhes_json TEXT,created_at TIMESTAMPTZ DEFAULT now());
    `);
    for (const name of ["operational-panel-foundation", "operational-voucher-validity", "operational-service-vouchers"]) await pool.query(await readFile(new URL(`../../docs/sql/2026-11-12-${name}.sql`, import.meta.url), "utf8"));
    migration = await readFile(new URL("../../docs/sql/2026-11-12-cash-sessions.sql", import.meta.url), "utf8");
    await pool.query(migration);
  });
  afterAll(async () => { try { await pool?.end(); if (created) await admin.query(`DROP SCHEMA ${schema} CASCADE`); } finally { await admin?.end(); } });
  beforeEach(async () => {
    vi.stubEnv("OPERATIONAL_PARK_ID", "rincao");
    await pool.query(`TRUNCATE passeio_recebimentos,caixa_operacoes,edicoes_log,movimentacao_caixa,voucher,compra_pagamentos,compra,caixa_fechamentos,caixa_periodos,caixa_locais,servico_datas,servicos_adicionais,operacao_dias,agenda_extras,agenda,tabpreco RESTART IDENTITY CASCADE;
      INSERT INTO tabpreco VALUES(1); INSERT INTO agenda VALUES(1,'padra',CURRENT_DATE),(2,'escol',CURRENT_DATE);
      INSERT INTO caixa_locais(parque,nome,tipo) VALUES('rincao','Portaria','sales'),('rincao','Piscina','sales'),('rincao','Passeios','trips'),('estancia','Outro parque','sales');`);
  });
  afterEach(() => vi.unstubAllEnvs());

  it("opens distinct locations for two operators without creating an operational day; GETs never create cash", async () => {
    expect(await listCashSessions(today)).toEqual([]);
    const sessions = await Promise.all([openCashSession(opening(), actor), openCashSession(opening("open-other", 2, 2500), secondActor)]);
    expect(sessions.map((session) => session.snapshot.expectedCashCents).sort((a,b) => a-b)).toEqual([2500,10000]);
    expect((await listCashSessions(today)).map((session) => session.locationName)).toEqual(["Portaria","Piscina"]);
    expect((await pool.query("SELECT * FROM operacao_dias")).rowCount).toBe(0);
    expect((await pool.query("SELECT usuario_nome FROM edicoes_log ORDER BY id")).rows.map((row) => row.usuario_nome).sort()).toEqual([actor.name,secondActor.name]);
    expect(await getCashSession(sessions[0].id)).toMatchObject({ id: sessions[0].id, openedBy: actor, snapshot: { expectedCashCents: 10000 } });
  });
  it("serializes competing opens, then allows a successive session after manual closure", async () => {
    const results = await Promise.allSettled([openCashSession(opening("a"),actor),openCashSession(opening("b"),secondActor)]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.find((result) => result.status === "rejected")).toMatchObject({reason:{code:"cash_location_already_open"}});
    const [session] = await listCashSessions(today);
    const closed = await closeCashSession({periodId:session.id,countedCashCents:0,reason:"Fim do turno",idempotencyKey:"close"},actor);
    expect(closed.snapshot).toMatchObject({countedCashCents:0,differenceCents:-10000});
    const next = await openCashSession(opening("next"),actor);
    expect(next.id).not.toBe(session.id); expect((await listCashSessions(today))).toHaveLength(2);
  });
  it("rejects legacy open cash, invalid dates, inactive/wrong-park places and a closed day", async () => {
    await pool.query("INSERT INTO caixa_periodos DEFAULT VALUES");
    await expect(openCashSession(opening(),actor)).rejects.toMatchObject({code:"legacy_cash_open"});
    await pool.query("UPDATE caixa_periodos SET fechado_em=now()");
    for (const date of [yesterday,tomorrow]) await expect(openCashSession({...opening(),date},actor)).rejects.toMatchObject({code:"cash_date_not_today"});
    await expect(openCashSession(opening("wrong",4),actor)).rejects.toMatchObject({code:"cash_location_unavailable"});
    await pool.query("UPDATE caixa_locais SET ativo=false WHERE id=1");
    await expect(openCashSession(opening(),actor)).rejects.toMatchObject({code:"cash_location_unavailable"});
    await pool.query("UPDATE caixa_locais SET ativo=true WHERE id=1; INSERT INTO operacao_dias(parque,data,tabela_preco_id,estado) VALUES('rincao',CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo',1,'closed')");
    await expect(openCashSession(opening(),actor)).rejects.toMatchObject({code:"day_closed"});
  });
  it("replays the original immutable response after close and rejects changed bodies", async () => {
    const original = await openCashSession(opening(),actor);
    const replay = await openCashSession({idempotencyKey:"open",openingCashCents:10000,locationId:1,date:today},secondActor);
    expect(replay).toEqual(original);
    await closeCashSession({periodId:original.id,countedCashCents:10000,idempotencyKey:"close",reason:"Fechamento"},actor);
    expect(await openCashSession(opening(),actor)).toEqual(original);
    await expect(openCashSession(opening("open",2),actor)).rejects.toMatchObject({code:"idempotency_conflict"});
    await expect(openCashSession({...opening(),date:yesterday},actor)).rejects.toMatchObject({code:"idempotency_conflict"});
    expect((await pool.query("SELECT * FROM caixa_periodos")).rowCount).toBe(1);
  });
  it("serializes the same idempotency key with different dates and concurrent duplicate movements", async () => {
    const sameKey = await Promise.allSettled([openCashSession(opening(),actor),openCashSession({...opening(),date:tomorrow},secondActor)]);
    expect(sameKey.filter((result)=>result.status==="fulfilled")).toHaveLength(1);
    expect(sameKey.find((result)=>result.status==="rejected")).toMatchObject({reason:{code:expect.stringMatching(/^(idempotency_conflict|cash_date_not_today)$/)}});
    const [session]=await listCashSessions(today);
    const [a,b]=await Promise.all([createCashSessionMovement(movement(session.id,"same","fundo",1),actor),createCashSessionMovement(movement(session.id,"same","fundo",1),secondActor)]);
    expect(a).toEqual(b);
    expect((await pool.query("SELECT * FROM movimentacao_caixa")).rowCount).toBe(1);
    await closeCashSession({periodId:session.id,countedCashCents:10001,idempotencyKey:"close",reason:"Fim"},actor);
    expect(await createCashSessionMovement(movement(session.id,"same","fundo",1),actor)).toEqual(a);
  });
  it("serializes two withdrawals against the same remaining balance, including two operators", async () => {
    const session=await openCashSession(opening(),actor);
    const results=await Promise.allSettled([createCashSessionMovement(movement(session.id,"a","sangria",6000),actor),createCashSessionMovement(movement(session.id,"b","sangria",6000),secondActor)]);
    expect(results.filter((result)=>result.status==="fulfilled")).toHaveLength(1);
    expect(results.find((result)=>result.status==="rejected")).toMatchObject({reason:{code:"cash_insufficient_balance"}});
    expect((await getCashSession(session.id)).snapshot.expectedCashCents).toBe(4000);
    await createCashSessionMovement(movement(session.id,"fund","fundo",123),secondActor);
    expect((await getCashSession(session.id)).snapshot.expectedCashCents).toBe(4123);
  });
  it("commits a movement fully before closing or rejects it, preserving the closed snapshot", async () => {
    const session=await openCashSession(opening(),actor);
    const results=await Promise.allSettled([createCashSessionMovement(movement(session.id,"withdraw","sangria",1234),actor),closeCashSession({periodId:session.id,countedCashCents:8766,idempotencyKey:"close",reason:"Fim"},secondActor)]);
    expect(results[1].status).toBe("fulfilled");
    const closed=await getCashSession(session.id);
    expect(closed.snapshot.expectedCashCents).toBe(results[0].status==="fulfilled"?8766:10000);
    expect(closed.snapshot.movements.length).toBe(results[0].status==="fulfilled"?1:0);
    await expect(createCashSessionMovement(movement(session.id,"late","fundo",100),actor)).rejects.toMatchObject({code:"cash_session_closed"});
    await pool.query("UPDATE caixa_locais SET nome='Nome novo' WHERE id=1");
    await pool.query("UPDATE movimentacao_caixa SET valor=99 WHERE periodo_id=$1",[session.id]);
    expect(await getCashSession(session.id)).toEqual(closed);
  });
  it("sums explicit net receipts regardless of cancellation, and subtracts only paid cash outflows", async () => {
    const a=await openCashSession(opening(),actor), b=await openCashSession(opening("b",2,0),secondActor);
    await pool.query(`INSERT INTO compra(tpcompra,stcompra,vltotcompra,caixa_periodo_id) VALUES('bilhe','conc',100,$1),('bilhe','canc',20,$1),('ponli','conc',50,NULL)`,[a.id]);
    await pool.query(`INSERT INTO compra_pagamentos(idcompra,forma_pagamento,valor,periodo_id,recebido_em) VALUES(1,'dinhe',40,$1,now()),(1,'pix',60,$1,now()),(2,'dinhe',20,$1,now()),(3,'dinhe',50,$2,now())`,[a.id,b.id]);
    await pool.query(`INSERT INTO movimentacao_caixa(tipo,responsavel,valor,periodo_id,motivo) VALUES('despesa','Responsável',3.01,$1,'Compra'),('devolucao','Responsável',4.02,$1,'Pago')`,[a.id]);
    const actual=await getCashSession(a.id);
    expect(actual.snapshot).toMatchObject({cashReceivedCents:6000,expensesCents:301,refundsCents:402,expectedCashCents:15297,receiptsCount:3});
    expect(actual.snapshot.payments).toEqual([{method:"dinhe",amountCents:6000},{method:"pix",amountCents:6000}]);
    expect(actual.snapshot.lastReceiptAt).toBeTruthy();
    expect((await getCashSession(b.id)).snapshot.expectedCashCents).toBe(5000);
  });
  it("classifies service sales and admissions without counting services or school participants as day use", async () => {
    const session=await openCashSession(opening(),actor);
    await pool.query(`INSERT INTO servicos_adicionais(parque,nome,preco_bilheteria) VALUES('rincao','Armário',19)`);
    await pool.query(`INSERT INTO compra(tpcompra,stcompra,vltotcompra,vltotdesc,caixa_periodo_id) VALUES('bilhe','conc',109,10,$1),('ponli','conc',50,0,NULL)`,[session.id]);
    await pool.query(`INSERT INTO voucher(idcompra,idagenda,tpvoucher,vlunicompra,stusado,servico_id,parque_operacional,dtinicio_validade,dtvalidade,descricao,validacao_periodo_id,validado_em) VALUES
        (1,1,'norma',90,'s',NULL,NULL,NULL,NULL,'Adulto',$1,now()),
        (1,1,'espec',19,'s',1,'rincao',CURRENT_DATE,CURRENT_DATE,'Armário',$1,now()),
        (1,1,'corte',0,'n',NULL,NULL,NULL,NULL,'Cortesia',NULL,NULL),
        (2,1,'norma',50,'s',NULL,NULL,NULL,NULL,'Adulto',$1,now()),
        (2,2,'norma',0,'s',NULL,NULL,NULL,NULL,'Aluno',$1,now());`,[session.id]);
    const actual=(await getCashSession(session.id)).snapshot;
    expect(actual.sales).toMatchObject({purchaseCount:1,ticketCount:2,serviceCount:1,courtesyCount:1,revenueCents:10900,serviceRevenueCents:1900,discountCents:1000});
    expect(actual.admissions).toEqual({ticketCount:2,serviceCount:1,onlineTicketCount:1,schoolCount:1,unclassifiedCount:0});
    expect(actual.services).toEqual([{serviceId:1,name:"Armário",quantity:1,revenueCents:1900}]);
    expect(actual.expectedCashCents).toBe(10000);
  });
  it("refuses to turn a sold purchase with missing value into zero revenue", async () => {
    const session=await openCashSession(opening(),actor);
    await pool.query("INSERT INTO compra(tpcompra,stcompra,caixa_periodo_id) VALUES('bilhe','conc',$1)",[session.id]);
    await expect(getCashSession(session.id)).rejects.toMatchObject({code:"cash_invalid_data"});
    await expect(closeCashSession({periodId:session.id,countedCashCents:10000,reason:"Fim",idempotencyKey:"invalid"},actor)).rejects.toMatchObject({code:"cash_invalid_data"});
    expect((await pool.query("SELECT * FROM caixa_fechamentos")).rowCount).toBe(0);
  });
  it("rolls back opening/movements/commands if the audit cannot be recorded", async () => {
    await expect(openCashSession(opening(),{name:"Audit failure",cpf:null})).rejects.toMatchObject({code:"23514"});
    expect((await pool.query("SELECT * FROM caixa_periodos")).rowCount).toBe(0);
    const session=await openCashSession(opening(),actor);
    await expect(createCashSessionMovement(movement(session.id,"bad","fundo",100),{name:"Audit failure",cpf:null})).rejects.toMatchObject({code:"23514"});
    expect((await pool.query("SELECT * FROM movimentacao_caixa")).rowCount).toBe(0);
    expect((await pool.query("SELECT * FROM caixa_operacoes")).rowCount).toBe(1);
    await expect(closeCashSession({periodId:session.id,countedCashCents:10000,reason:"Fim",idempotencyKey:"bad-close"},{name:"Audit failure",cpf:null})).rejects.toMatchObject({code:"23514"});
    expect((await getCashSession(session.id)).closedAt).toBeNull();
    expect((await pool.query("SELECT * FROM caixa_fechamentos")).rowCount).toBe(0);
  });
  it("retains exact boundary cents and denies wrong session types, cross-park reads and mutations after day closure", async () => {
    const session=await openCashSession(opening("large",1,9999999999),actor);
    await createCashSessionMovement(movement(session.id,"cent","fundo",1),actor);
    expect((await getCashSession(session.id)).snapshot.expectedCashCents).toBe(10000000000);
    const client=await pool.connect();
    try {
      await client.query("BEGIN");
      await expect(lockOpenCashSession(client,{periodId:session.id,expectedType:"trips"})).rejects.toMatchObject({code:"cash_type_mismatch"});
      await client.query("ROLLBACK");
    } finally {client.release();}
    vi.stubEnv("OPERATIONAL_PARK_ID","estancia");
    await expect(getCashSession(session.id)).rejects.toMatchObject({code:"cash_session_not_found",status:404});
    vi.stubEnv("OPERATIONAL_PARK_ID","rincao");
    await pool.query("INSERT INTO operacao_dias(parque,data,tabela_preco_id,estado) VALUES('rincao',$1::date,1,'closed')",[today]);
    await expect(createCashSessionMovement(movement(session.id,"blocked","fundo",1),actor)).rejects.toMatchObject({code:"day_closed"});
    expect((await getCashSession(session.id)).snapshot.expectedCashCents).toBe(10000000000);
  });
  it("auto-closes expired sessions once without inventing counted cash or opening successors", async () => {
    const a=await openCashSession(opening(),actor), b=await openCashSession(opening("b",2),secondActor);
    await pool.query("UPDATE caixa_periodos SET data_operacional=$1::date,aberto_em=$1::date::timestamp AT TIME ZONE 'America/Sao_Paulo'",[yesterday]);
    await expect(createCashSessionMovement(movement(a.id,"too-late","fundo",100),actor)).rejects.toMatchObject({code:"cash_date_not_today"});
    const closed=await autoCloseExpiredCashSessions({name:"Job diário",cpf:null});
    expect(closed).toEqual({closedCount:2,closedPeriodIds:[a.id,b.id]});
    expect(await autoCloseExpiredCashSessions({name:"Job diário",cpf:null})).toEqual({closedCount:0,closedPeriodIds:[]});
    for(const id of [a.id,b.id]) expect((await getCashSession(id)).snapshot).toMatchObject({countedCashCents:null,differenceCents:null,pending:expect.arrayContaining(["cash_count_missing"])});
    expect((await pool.query("SELECT * FROM caixa_periodos")).rowCount).toBe(2);
  });
  it("exposes a transaction-scoped lock, command replay and uncounted day-close helper without nested commits", async () => {
    const session=await openCashSession(opening(),actor);
    const client=await pool.connect();
    try {
      await client.query("BEGIN");
      const locked=await lockOpenCashSession(client,{periodId:session.id,expectedType:"sales",date:today});
      expect(await readCashSessionSnapshot(client,locked)).toMatchObject({expectedCashCents:10000});
      await closeLockedCashSession(client,locked,{countedCashCents:null,automatic:false,reason:"Fechamento do dia"},actor);
      await client.query("ROLLBACK");
      expect((await getCashSession(session.id)).closedAt).toBeNull();
      await client.query("BEGIN");
      const result=await withCashSessionCommand(client,{action:"test.receipt",key:"external",payload:{z:1,a:{b:2}},periodId:session.id},async()=>({periodId:session.id,response:{receiptId:123}}));
      await client.query("COMMIT");expect(result).toEqual({receiptId:123});
      await client.query("BEGIN");
      expect(await withCashSessionCommand(client,{action:"test.receipt",key:"external",payload:{a:{b:2},z:1},periodId:session.id},async()=>{throw new Error("Must not execute twice");})).toEqual({receiptId:123});
      await client.query("COMMIT");
    } finally { await client.query("ROLLBACK");client.release(); }
  });
  it("reapplying the migration preserves legacy rows and rejects partially scoped sessions", async () => {
    await pool.query("INSERT INTO caixa_periodos(operador,fechado_em) VALUES('Legado',now());INSERT INTO movimentacao_caixa(tipo,responsavel,valor) VALUES('fundo','Legado',1.23)");
    const before=(await pool.query("SELECT row_to_json(c) AS row FROM caixa_periodos c")).rows;
    await pool.query(migration);await pool.query(migration);
    expect((await pool.query("SELECT row_to_json(c) AS row FROM caixa_periodos c")).rows).toEqual(before);
    expect((await pool.query("SELECT valor::text,periodo_id FROM movimentacao_caixa")).rows).toEqual([{valor:"1.23",periodo_id:null}]);
    await expect(pool.query("INSERT INTO caixa_periodos(parque) VALUES('rincao')")).rejects.toMatchObject({code:"23514"});
  });
});
