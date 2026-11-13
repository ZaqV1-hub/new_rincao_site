import { readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { expireUnusedVouchers, rescheduleUserVoucher, resetVoucherLifecycleSchemaForTests } from "@/lib/voucher-repository";
import { lockVoucherCashContext } from "@/lib/ops-voucher-validation-cash";
import { validateVoucherByNumber, validateSelectedVouchers, validateSchoolTripVouchers, unvalidateSelectedVouchers, invalidateSelectedVouchers } from "@/lib/ops-voucher-validation";
import { admitCountingVoucher } from "./counting-admission";
import { markVoucherUsed } from "@/lib/ops-voucher-validation-shared";

const mock = vi.hoisted(() => ({ pool: null as Pool | null }));
vi.mock("@/lib/ingresso-db", () => ({ getIngressoSistemaDbPool: () => mock.pool, getIngressoSistemaDbDialect: () => "postgres" }));
vi.mock("@/lib/school-payment-eligibility", () => ({ getSchoolPaymentHold: async () => null }));
vi.mock("@/lib/ticket-service", () => ({ syncTicketValidation: async () => ({ status: "sent" }) }));
const connectionString = process.env.PANEL_TEST_DATABASE_URL;
if (connectionString) {
  const url = new URL(connectionString);
  if (!["postgres:", "postgresql:"].includes(url.protocol) || url.hostname !== "127.0.0.1" || url.pathname !== "/chargeback_test_painel" || url.search || url.hash) throw new Error("Use only the scratch database chargeback_test_painel on 127.0.0.1 without URL options");
}

describe.skipIf(!connectionString)("operational voucher validity with PostgreSQL", () => {
  const schema = `voucher_validity_it_${randomBytes(8).toString("hex")}`;
  let admin: Pool, pool: Pool;
  let created = false;
  let today: string;
  beforeAll(async () => {
    admin = new Pool({ connectionString, connectionTimeoutMillis: 2000 });
    await admin.query(`CREATE SCHEMA ${schema}`); created = true;
    pool = new Pool({ connectionString, options: `-c search_path=${schema}`, connectionTimeoutMillis: 2000 }); mock.pool = pool;
    await pool.query(`
      CREATE TABLE compra (idcompra INT PRIMARY KEY, cpf TEXT, dtcompra DATE, stcompra TEXT,tpcompra TEXT DEFAULT 'ponli',formapag TEXT DEFAULT 'pix');
      CREATE TABLE agenda (idagenda INT PRIMARY KEY, dtagenda DATE, tpagenda TEXT, stagenda TEXT);
      CREATE TABLE voucher (idvoucher INT PRIMARY KEY, idcompra INT REFERENCES compra, idagenda INT REFERENCES agenda,
        stusado TEXT DEFAULT 'n', stvoucher TEXT DEFAULT 'ativo', flreagendado CHAR(1) DEFAULT 'n',
        dtinicio_validade DATE, dtvalidade DATE, parque_operacional TEXT, dtuso DATE, hruso TIME,
        numvoucher TEXT,tpvoucher TEXT DEFAULT 'norma',servico_id BIGINT,idescola INTEGER,tpparticipante TEXT,periodo_id INTEGER,closed_at TIMESTAMP);
      CREATE TABLE pagpagseguro(idcompra INT,status INT);
      CREATE TABLE caixa_locais(id BIGSERIAL PRIMARY KEY,parque TEXT,nome TEXT,tipo TEXT,ativo BOOLEAN DEFAULT true,UNIQUE(parque,id));
      CREATE TABLE caixa_periodos(id SERIAL PRIMARY KEY,aberto_em TIMESTAMPTZ DEFAULT now(),fechado_em TIMESTAMPTZ,operador TEXT,fechamento_auto BOOLEAN DEFAULT false,folha_id INTEGER);
      CREATE TABLE caixa_fechamentos(id SERIAL PRIMARY KEY,periodo_id INTEGER,snapshot_json JSONB);
      CREATE TABLE compra_pagamentos(id SERIAL PRIMARY KEY,idcompra INTEGER,forma_pagamento TEXT,valor NUMERIC);
      CREATE TABLE movimentacao_caixa(id SERIAL PRIMARY KEY,tipo TEXT);
      CREATE TABLE edicoes_log(id SERIAL PRIMARY KEY,origem VARCHAR(30),acao VARCHAR(30),compra_id INTEGER,movimentacao_id INTEGER,movimentacao_tipo VARCHAR(20),periodo_id INTEGER,folha_id INTEGER,descricao TEXT,motivo TEXT,usuario_nome TEXT,detalhes_json TEXT,created_at TIMESTAMPTZ DEFAULT now());
      CREATE TABLE online_capacity_reservations (idcompra INT PRIMARY KEY, delivery_hold BOOLEAN DEFAULT false);
      CREATE TABLE agenda_extras(idagenda integer,idcliente integer);
      CREATE TABLE contagem_entradas(parque text,idempotency_key text,actor_cpf text,request_hash text,result jsonb,PRIMARY KEY(parque,idempotency_key));
      CREATE TABLE passeio_operacao(parque text,agenda_id integer,cliente_id integer,finalized_receipt_id uuid);
      CREATE TABLE operacao_dias (parque TEXT, data DATE, estado TEXT, PRIMARY KEY (parque,data));
    `);
    await pool.query(await readFile(new URL("../../docs/sql/2026-11-12-cash-sessions.sql", import.meta.url), "utf8"));
    today = (await pool.query("SELECT to_char((NOW() AT TIME ZONE 'America/Sao_Paulo')::date,'YYYY-MM-DD') AS today")).rows[0].today;
  });
  afterAll(async () => {
    try { await pool?.end(); if (created) await admin.query(`DROP SCHEMA ${schema} CASCADE`); }
    finally { await admin?.end(); vi.unstubAllEnvs(); }
  });
  beforeEach(async () => {
    vi.stubEnv("OPERATIONAL_PARK_ID", "rincao"); resetVoucherLifecycleSchemaForTests();
    await pool.query("TRUNCATE contagem_entradas,agenda_extras,voucher, compra, agenda, operacao_dias, online_capacity_reservations,pagpagseguro,edicoes_log,caixa_operacoes,caixa_periodos,caixa_locais,caixa_fechamentos,compra_pagamentos RESTART IDENTITY CASCADE");
    await pool.query(`INSERT INTO compra (idcompra,cpf,dtcompra,stcompra) VALUES (1,'52998224725',$1::date-10,'conc');
      `, [today]);
    await pool.query("INSERT INTO pagpagseguro VALUES(1,3); INSERT INTO caixa_locais(parque,nome,tipo) VALUES('rincao','Portaria','sales'),('rincao','Piscina','sales')");
    await pool.query(`INSERT INTO caixa_periodos(parque,data_operacional,local_id,local_nome,tipo,troco_inicial)
      VALUES('rincao',$1,1,'Portaria','sales',0),('rincao',$1,2,'Piscina','sales',0)`,[today]);
    await pool.query("INSERT INTO agenda VALUES (1,$1::date-5,'padra','abe'),(2,$1,'promo','abe')", [today]);
    await pool.query(`INSERT INTO voucher (idvoucher,idcompra,idagenda,dtinicio_validade,dtvalidade,parque_operacional)
      VALUES (1,1,1,$1::date-5,$1,'rincao'), (2,1,1,$1::date-5,$1::date-1,'rincao'),(3,1,1,NULL,$1::date-1,NULL)`, [today]);
    await pool.query("UPDATE voucher SET numvoucher='TICKET-'||idvoucher");
  });

  it("admits at the gate without any cash session and reconciles the same attempt", async () => {
    await pool.query('DELETE FROM caixa_periodos');
    const actor = { name: 'Monitora', cpf: '52998224725' };
    const input = { date:today, code: '1-1', idempotencyKey: 'gate-1' };
    const result = await admitCountingVoucher(input,actor);
    expect(result).toMatchObject({ voucherId: 1, admitted: true });
    expect(await admitCountingVoucher(input,actor)).toMatchObject({voucherId:result.voucherId,replayed:true,date:today});
    const row = (await pool.query('SELECT validacao_periodo_id,validado_por_nome,stusado FROM voucher WHERE idvoucher=1')).rows[0];
    expect(row).toEqual({ validacao_periodo_id:null,validado_por_nome:'Monitora',stusado:'s' });
    expect((await pool.query('SELECT count(*) FROM caixa_periodos')).rows[0].count).toBe('0');
    await expect(admitCountingVoucher({ ...input,idempotencyKey:'gate-other' },actor)).rejects.toMatchObject({ code:'voucher_already_used',details:{validation:{actorName:'Monitora'}} });
  });
  it("admits once when two gate readers race and rejects wrong purchase or services", async () => {
    const actor = { name:'A',cpf:'52998224725' };
    await expect(admitCountingVoucher({date:today,code:'9-1',idempotencyKey:'wrong'},actor)).rejects.toMatchObject({ code:'voucher_purchase_mismatch' });
    await pool.query("UPDATE voucher SET tpvoucher='espec' WHERE idvoucher=1");
    await expect(admitCountingVoucher({date:today,code:'1-1',idempotencyKey:'service'},actor)).rejects.toMatchObject({code:'gate_admission_only'});
    await pool.query("UPDATE voucher SET tpvoucher='norma' WHERE idvoucher=1");
    const results=await Promise.allSettled([admitCountingVoucher({date:today,code:'1-1',idempotencyKey:'race-a'},actor),admitCountingVoucher({date:today,code:'1-1',idempotencyKey:'race-b'},{name:'B',cpf:'11144477735'})]);
    expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
    expect((await pool.query('SELECT count(*) FROM contagem_entradas')).rows[0].count).toBe('1');
  });
  it("gate rejects expired, unpaid, wrong-park and closed-day admissions", async () => {
    const actor={name:'A',cpf:'52998224725'};
    await expect(admitCountingVoucher({date:today,code:'1-2',idempotencyKey:'expired'},actor)).rejects.toMatchObject({code:'voucher_expired'});
    await pool.query("UPDATE compra SET stcompra='pend'");
    await expect(admitCountingVoucher({date:today,code:'1-1',idempotencyKey:'unpaid'},actor)).rejects.toMatchObject({code:'voucher_payment_pending'});
    await pool.query("UPDATE compra SET stcompra='conc'; UPDATE voucher SET parque_operacional='estancia' WHERE idvoucher=1");
    await expect(admitCountingVoucher({date:today,code:'1-1',idempotencyKey:'park'},actor)).rejects.toMatchObject({code:'voucher_park_mismatch'});
    await pool.query("UPDATE voucher SET parque_operacional='rincao'; UPDATE agenda SET stagenda='fec' WHERE idagenda=2");
    await expect(admitCountingVoucher({date:today,code:'1-1',idempotencyKey:'closed'},actor)).rejects.toMatchObject({code:'voucher_day_closed'});
  });


  it("does not turn an expired attempt into a fresh admission and accepts paid reservations",async()=>{
    const actor={name:'A',cpf:'52998224725'};
    await expect(admitCountingVoucher({date:'2000-01-01',code:'1-1',idempotencyKey:'old'},actor)).rejects.toMatchObject({code:'gate_date_changed'});
    await pool.query("UPDATE compra SET tpcompra='reser',formapag='N/A'");
    await expect(admitCountingVoucher({date:today,code:'1-1',idempotencyKey:'reserve'},actor)).rejects.toMatchObject({code:'voucher_payment_pending'});
    await pool.query("UPDATE compra SET formapag='PIX'");
    expect(await admitCountingVoucher({date:today,code:'1-1',idempotencyKey:'reserve-paid'},actor)).toMatchObject({admitted:true,replayed:false});
  });
  it("blocks gate admission after the financial day closes while agenda remains open",async()=>{
    await pool.query("INSERT INTO operacao_dias VALUES('rincao',$1,'closed')",[today]);
    await expect(admitCountingVoucher({date:today,code:'1-1',idempotencyKey:'financial-closed'},{name:'A',cpf:'52998224725'})).rejects.toMatchObject({code:'voucher_day_closed'});
  });


  it("prevents a concurrent financial close from freezing a pre-admission snapshot",async()=>{
    await pool.query("INSERT INTO operacao_dias VALUES('rincao',$1,'open')",[today]);
    const closing=await pool.connect(),gate=await pool.connect(),original=gate.query.bind(gate);
    let releaseGate!:()=>void,gateReady!:()=>void;
    const ready=new Promise<void>(resolve=>{gateReady=resolve;}),release=new Promise<void>(resolve=>{releaseGate=resolve;});
    const query=vi.spyOn(gate,'query').mockImplementation((async (text:string,values?:unknown[])=>{
      if(text.startsWith('INSERT INTO contagem_entradas')){gateReady();await release;}
      return original(text,values);
    }) as typeof gate.query);
    vi.spyOn(pool,'connect').mockImplementationOnce((()=>Promise.resolve(gate)) as typeof pool.connect);
    const admission=admitCountingVoucher({date:today,code:'1-1',idempotencyKey:'concurrent-close'},{name:'A',cpf:'52998224725'});
    try{
      await ready;
      await closing.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
      await closing.query('SELECT estado FROM operacao_dias WHERE parque=$1 AND data=$2',['rincao',today]);
      const close=(async()=>{
        await closing.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`operational-day:rincao:${today}`]);
        await closing.query('SELECT stusado FROM voucher WHERE idvoucher=1');
        await closing.query("UPDATE operacao_dias SET estado='closed' WHERE parque='rincao'");
        await closing.query('COMMIT');
      })();
      releaseGate();
      expect(await admission).toMatchObject({admitted:true});
      await expect(close).rejects.toMatchObject({code:'40001'});
    }finally{releaseGate();query.mockRestore();vi.restoreAllMocks();await closing.query('ROLLBACK');closing.release();}
  });

  it("expires snapshots at their exact end while preserving legacy six month validity", async () => {
    const result = await expireUnusedVouchers();
    expect(result.expiredVoucherIds).toEqual([2]);
    expect((await pool.query("SELECT idvoucher,stvoucher FROM voucher ORDER BY idvoucher")).rows).toEqual([
      { idvoucher: 1, stvoucher: "ativo" }, { idvoucher: 2, stvoucher: "vencido" }, { idvoucher: 3, stvoucher: "ativo" },
    ]);
  });

  it("rejects direct rescheduling of snapshot vouchers and retains legacy rescheduling", async () => {
    await pool.query("UPDATE agenda SET tpagenda='padra' WHERE idagenda=2");
    expect(await rescheduleUserVoucher("52998224725", 1, 2)).toBeNull();
    expect(await rescheduleUserVoucher("52998224725", 3, 2)).toBe(3);
    expect((await pool.query("SELECT idagenda FROM voucher WHERE idvoucher=1")).rows[0].idagenda).toBe(1);
  });

  async function validate(periodId = 1) {
    const client = await pool.connect();
    try { await client.query("BEGIN"); await markVoucherUsed(client, 1, today, "12:00:00", await lockVoucherCashContext(client, periodId, today), {name:"Operador",cpf:"00000000001"}); await client.query("COMMIT"); }
    catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  }
  it("uses a different open day once and keeps the original agenda", async () => {
    await validate();
    expect((await pool.query("SELECT idagenda,stusado,to_char(dtuso,'YYYY-MM-DD') AS used FROM voucher WHERE idvoucher=1")).rows[0]).toEqual({ idagenda: 1, stusado: "s", used: today });
    await expect(validate()).rejects.toMatchObject({ code: "voucher_already_used" });
  });
  it("admits an already paid voucher when online sales are full but day use remains open", async () => {
    await pool.query("UPDATE agenda SET stagenda='lot' WHERE idagenda=2");
    await validate();
    expect((await pool.query("SELECT stusado FROM voucher WHERE idvoucher=1")).rows[0].stusado).toBe("s");
  });
  it("retains a paid voucher until its online capacity is released", async () => {
    await pool.query("INSERT INTO online_capacity_reservations VALUES (1,true)");
    await expect(validate()).rejects.toMatchObject({ code: "online_capacity_delivery_hold", status: 409 });
    expect((await pool.query("SELECT stusado FROM voucher WHERE idvoucher=1")).rows[0].stusado).toBe("n");
    await pool.query("UPDATE online_capacity_reservations SET delivery_hold=false WHERE idcompra=1");
    await validate();
    expect((await pool.query("SELECT stusado FROM voucher WHERE idvoucher=1")).rows[0].stusado).toBe("s");
  });
  it("admits exactly once under competing transactions", async () => {
    const results = await Promise.allSettled([validate(1), validate(2)]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.find((result) => result.status === "rejected")).toMatchObject({ reason: { code: "voucher_already_used" } });
  });
  const actor = { name: "Operador A", cpf: "00000000001" };
  it("records one admission across two cashiers, the real actor/location/time, and before/after audit", async () => {
    const results = await Promise.allSettled([validateVoucherByNumber("TICKET-1", false, actor, 1), validateVoucherByNumber("TICKET-1", false, { name: "Operador B", cpf: "00000000002" }, 2)]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const used = (await pool.query("SELECT validacao_periodo_id,validado_em,validado_por_nome,validado_por_cpf FROM voucher WHERE idvoucher=1")).rows[0];
    expect([1, 2]).toContain(used.validacao_periodo_id); expect(used.validado_em).toBeInstanceOf(Date);
    expect(used.validado_por_nome).toBe(used.validacao_periodo_id === 1 ? "Operador A" : "Operador B");
    const failed = results.find((result) => result.status === "rejected") as PromiseRejectedResult;
    expect(failed.reason).toMatchObject({ code: "voucher_already_used", details: { validation: { periodId: used.validacao_periodo_id, locationName: used.validacao_periodo_id === 1 ? "Portaria" : "Piscina" } } });
    expect(failed.reason.message).toContain("Local:");
    const audit = (await pool.query("SELECT periodo_id,detalhes_json FROM edicoes_log")).rows;
    expect(audit).toHaveLength(1); expect(audit[0].periodo_id).toBe(used.validacao_periodo_id);
    expect(JSON.parse(audit[0].detalhes_json)).toMatchObject({ before: [expect.objectContaining({ stusado: "n" })], after: [expect.objectContaining({ stusado: "s", validacao_periodo_id: used.validacao_periodo_id })] });
    expect((await pool.query("SELECT * FROM compra_pagamentos")).rowCount).toBe(0);
  });
  it("requires explicit cash even for legacy vouchers and consumes paid/free box-office services without public admission", async () => {
    await expect(validateVoucherByNumber("TICKET-3")).rejects.toMatchObject({ code: "cash_session_required", status: 409 });
    await expect(validateVoucherByNumber("TICKET-3", false, actor, 1)).resolves.toMatchObject({ processedCount: 1 });
    await pool.query("UPDATE compra SET tpcompra='bilhe',formapag=NULL; UPDATE voucher SET tpvoucher='espec',servico_id=123 WHERE idvoucher=1");
    await expect(validateSelectedVouchers([1], actor, 2)).resolves.toMatchObject({ processedCount: 1 });
    expect((await pool.query("SELECT count(*)::int AS count FROM voucher WHERE stusado='s' AND tpvoucher IN ('norma','infan','isent','corte')")).rows[0].count).toBe(1);
  });
  it("requires open day use for a service voucher even when its cash session is open", async () => {
    await pool.query("UPDATE compra SET tpcompra='bilhe',formapag=NULL; UPDATE voucher SET tpvoucher='espec',servico_id=123 WHERE idvoucher=1; DELETE FROM agenda WHERE idagenda=2");
    await expect(validateSelectedVouchers([1], actor, 2)).rejects.toMatchObject({ code: "voucher_day_closed" });
    expect((await pool.query("SELECT stusado FROM voucher WHERE idvoucher=1")).rows[0].stusado).toBe("n");
  });
  it("admits confirmed box-office vouchers through the school-trip path in explicit cash", async () => {
    await pool.query("UPDATE compra SET tpcompra='bilhe',formapag=NULL; UPDATE voucher SET idescola=10 WHERE idvoucher=1");
    await expect(validateSchoolTripVouchers(10, 1, actor, 2)).resolves.toMatchObject({ processedCount: 1 });
    expect((await pool.query("SELECT validacao_periodo_id FROM voucher WHERE idvoucher=1")).rows[0].validacao_periodo_id).toBe(2);
  });
  it("refuses a write after the database date changed, even if the application clock still shows yesterday", async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const context = await lockVoucherCashContext(client, 1, today);
      const yesterday = new Date(Date.parse(`${today}T12:00:00Z`) - 86400000).toISOString().slice(0, 10);
      await client.query("INSERT INTO agenda VALUES(99,$1,'padra','abe')", [yesterday]);
      context.session.date = yesterday;
      vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(`${yesterday}T23:59:59-03:00`));
      await expect(markVoucherUsed(client, 1, yesterday, "23:59:59", context, actor)).rejects.toMatchObject({ code: "cash_date_not_today", status: 409 });
    } finally { vi.useRealTimers(); await client.query("ROLLBACK"); client.release(); }
    expect((await pool.query("SELECT stusado FROM voucher WHERE idvoucher=1")).rows[0].stusado).toBe("n");
  });
  it.each(["closed", "yesterday", "tomorrow", "trips", "other_park"])("rejects cash %s before changing voucher", async (state) => {
    if (state === "closed") await pool.query("UPDATE caixa_periodos SET fechado_em=now() WHERE id=1");
    if (state === "yesterday" || state === "tomorrow") await pool.query(`UPDATE caixa_periodos SET data_operacional=data_operacional${state === "yesterday" ? "-1" : "+1"} WHERE id=1`);
    if (state === "trips") await pool.query("UPDATE caixa_periodos SET tipo='trips' WHERE id=1");
    if (state === "other_park") vi.stubEnv("OPERATIONAL_PARK_ID", "estancia");
    await expect(validateVoucherByNumber("TICKET-1", false, actor, 1)).rejects.toThrow();
    expect((await pool.query("SELECT stusado FROM voucher WHERE idvoucher=1")).rows[0].stusado).toBe("n");
  });
  it("preserves admission history when undoing an open session and creates no cash refund", async () => {
    await validateVoucherByNumber("TICKET-1", false, actor, 1);
    await unvalidateSelectedVouchers([1], actor, 2);
    expect((await pool.query("SELECT stusado,validacao_periodo_id,validado_em FROM voucher WHERE idvoucher=1")).rows[0]).toEqual({ stusado: "n", validacao_periodo_id: null, validado_em: null });
    const logs = (await pool.query("SELECT detalhes_json FROM edicoes_log ORDER BY id")).rows.map((row) => JSON.parse(row.detalhes_json));
    expect(logs[1]).toMatchObject({ cash: { id: 2 }, before: [expect.objectContaining({ validacao_periodo_id: 1 })], after: [expect.objectContaining({ validacao_periodo_id: null })] });
    expect((await pool.query("SELECT * FROM movimentacao_caixa")).rowCount).toBe(0);
  });
  it.each(["validation_cash", "financial_snapshot", "legacy_snapshot", "day"])("refuses undo/invalidation after %s closure", async (closed) => {
    await validateVoucherByNumber("TICKET-1", false, actor, 1);
    if (closed === "validation_cash") await pool.query("UPDATE caixa_periodos SET fechado_em=now() WHERE id=1");
    if (closed === "financial_snapshot") await pool.query("INSERT INTO caixa_fechamentos(periodo_id,snapshot_json) VALUES(1,'{\"immutable\":true}')");
    if (closed === "legacy_snapshot") await pool.query("UPDATE voucher SET periodo_id=1,closed_at=now() WHERE idvoucher=1");
    if (closed === "day") await pool.query("INSERT INTO operacao_dias VALUES('rincao',$1,'closed')", [today]);
    const before = (await pool.query("SELECT * FROM voucher WHERE idvoucher=1")).rows[0];
    for (const mutate of [unvalidateSelectedVouchers, invalidateSelectedVouchers]) await expect(mutate([1], actor, 2)).rejects.toMatchObject({ status: 409 });
    expect((await pool.query("SELECT * FROM voucher WHERE idvoucher=1")).rows[0]).toEqual(before);
    expect((await pool.query("SELECT * FROM edicoes_log")).rowCount).toBe(1);
  });
  it.each(["closed", "no_agenda", "school_only", "closed_agenda"])("rejects day use %s", async (state) => {
    if (state === "closed") await pool.query("INSERT INTO operacao_dias VALUES ('rincao',$1,'closed')", [today]);
    if (state === "no_agenda") await pool.query("DELETE FROM agenda WHERE idagenda=2");
    if (state === "school_only") await pool.query("UPDATE agenda SET tpagenda='escol' WHERE idagenda=2");
    if (state === "closed_agenda") await pool.query("UPDATE agenda SET stagenda='fec' WHERE idagenda=2");
    await expect(validate()).rejects.toMatchObject({ code: state === "closed" ? "day_closed" : "voucher_day_closed" });
    expect((await pool.query("SELECT stusado FROM voucher WHERE idvoucher=1")).rows[0].stusado).toBe("n");
  });
});
