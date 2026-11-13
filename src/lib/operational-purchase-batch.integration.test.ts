import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { applyPurchaseBatch, previewPurchaseBatch } from "./operational-purchase-batch";
import { dispatchPurchaseBatchEmail, listPurchaseBatchEmail } from "./operational-purchase-batch-email";

const state = vi.hoisted(() => ({ pool: null as Pool | null, onDay: null as (() => Promise<void>) | null,send: vi.fn(),configured: vi.fn() }));
vi.mock("@/lib/ingresso-db", () => ({ getIngressoSistemaDbPool: () => state.pool }));
vi.mock("@/lib/legacy-email", () => ({ sendLegacyEmailOnce: state.send,isSmtpConfigured: state.configured }));
vi.mock("@/lib/operational-day-lock", async importOriginal => {
  const original = await importOriginal<typeof import("./operational-day-lock")>();
  return { lockOperationalDay: async (...args: Parameters<typeof original.lockOperationalDay>) => { await state.onDay?.(); return original.lockOperationalDay(...args); } };
});
const connectionString = process.env.PANEL_TEST_DATABASE_URL;
if (connectionString) {
  const url = new URL(connectionString);
  if (!["postgres:","postgresql:"].includes(url.protocol) || url.hostname !== "127.0.0.1" || url.pathname !== "/chargeback_test_painel" || url.search || url.hash) throw new Error("Use only the local scratch database");
}
const input = { purchaseIds: [1], targetDate: "2099-07-21", validity: "7_days", reason: "Chuva", notifyEmail: false };
const actor = { name: "Operador", cpf: "52998224725" };
describe.skipIf(!connectionString)("atomic whole-purchase batches with PostgreSQL", () => {
  const schema = `purchase_batch_${randomBytes(8).toString("hex")}`;
  let admin: Pool, pool: Pool, created = false;
  beforeAll(async () => {
    admin = new Pool({ connectionString }); await admin.query(`CREATE SCHEMA ${schema}`); created = true;
    pool = new Pool({ connectionString, options: `-c search_path=${schema} -c statement_timeout=10000 -c lock_timeout=7000`, max: 6 }); state.pool = pool;
    await pool.query(`CREATE TABLE usuario(cpf text PRIMARY KEY,email text);
      CREATE TABLE compra(idcompra integer PRIMARY KEY,cpf text,stcompra text,dtcompra date,caixa_periodo_id integer,checkout_school_site_context jsonb);
      CREATE TABLE agenda(idagenda integer PRIMARY KEY,dtagenda date,tpagenda text,stagenda text,idtabpreco integer);
      CREATE TABLE agenda_extras(idagenda integer,idcliente integer);
      CREATE TABLE voucher(idvoucher integer PRIMARY KEY,idcompra integer REFERENCES compra,idagenda integer REFERENCES agenda,idescola integer,
        tpvoucher text,servico_id bigint,parque_operacional text,dtinicio_validade date,dtvalidade date,dtuso date,stusado text,stvoucher text,
        periodo_id integer,validacao_periodo_id integer,closed_at timestamptz,vlunicompra numeric,flreagendado char(1));
      CREATE TABLE compra_pagamentos(idcompra integer,periodo_id integer);
      CREATE TABLE caixa_periodos(id integer PRIMARY KEY,parque text,data_operacional date,fechado_em timestamptz,folha_id integer);
      CREATE TABLE caixa_fechamentos(periodo_id integer);
      CREATE TABLE operacao_dias(parque text,data date,estado text,versao integer,tabela_preco_id integer,day_use_agenda_id integer,validade text,limite_online integer,tipos_ingresso jsonb,PRIMARY KEY(parque,data));
      CREATE TABLE servico_datas(parque text,data date,servico_id bigint);
      CREATE TABLE online_capacity_reservations(idcompra integer PRIMARY KEY,parque text,data date,quantidade integer,delivery_hold boolean DEFAULT false,
        expires_at timestamptz DEFAULT now()+interval '12 hours',attempt_started_at timestamptz);
      CREATE TABLE commerce_school_payment_hold(order_id integer PRIMARY KEY,status text);
      CREATE TABLE edicoes_log(id serial PRIMARY KEY,origem varchar(30),acao varchar(30),compra_id integer,movimentacao_id integer,movimentacao_tipo text,
        periodo_id integer,folha_id integer,descricao text,motivo text,usuario_nome text,detalhes_json text,created_at timestamptz DEFAULT now());`);
    await pool.query(await readFile(new URL("../../docs/sql/2026-11-13-purchase-batches.sql",import.meta.url),"utf8"));
  });
  beforeEach(async () => {
    vi.stubEnv("OPERATIONAL_PARK_ID","rincao"); state.onDay = null; state.send.mockReset().mockResolvedValue('accepted'); state.configured.mockReset().mockReturnValue(true);
    await pool.query(`TRUNCATE purchase_batch_email,purchase_adjustments,purchase_batches,edicoes_log,commerce_school_payment_hold,online_capacity_reservations,
      compra_pagamentos,voucher,compra,usuario,agenda_extras,agenda,operacao_dias,caixa_fechamentos,caixa_periodos CASCADE;
      INSERT INTO usuario VALUES('52998224725','cliente@example.test');
      INSERT INTO compra VALUES(1,'52998224725','conc',CURRENT_DATE,NULL,NULL),(2,'52998224725','conc',CURRENT_DATE,NULL,NULL);
      INSERT INTO agenda VALUES(10,'2099-07-20','padra','abe',1),(20,'2099-07-21','padra','abe',1);
      INSERT INTO operacao_dias SELECT 'rincao',dtagenda,'open',1,1,idagenda,'7_days',10,'["norma","infan","isent"]' FROM agenda;
      INSERT INTO voucher(idvoucher,idcompra,idagenda,tpvoucher,parque_operacional,dtinicio_validade,dtvalidade,stusado,stvoucher,vlunicompra)
        VALUES(11,1,10,'norma','rincao','2099-07-20','2099-07-26','n','ativo',100),(12,1,10,'isent','rincao','2099-07-20','2099-07-26','n','ativo',0),
        (21,2,10,'norma','rincao','2099-07-20','2099-07-26','n','ativo',80);
      INSERT INTO voucher(idvoucher,idcompra,idagenda,tpvoucher,servico_id,parque_operacional,dtinicio_validade,dtvalidade,stusado,stvoucher,vlunicompra)
        VALUES(13,1,10,'espec',1,'rincao','2099-07-20','2099-07-26','n','ativo',20);
      INSERT INTO online_capacity_reservations(idcompra,parque,data,quantidade) VALUES(1,'rincao','2099-07-20',2);
      INSERT INTO caixa_periodos VALUES(5,'rincao','2099-07-20',NULL,NULL);`);
  });
  afterEach(() => { state.onDay = null; vi.unstubAllEnvs(); });
  afterAll(async () => { await pool?.end(); if (created) await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin?.end(); });
  async function snapshot() { return (await pool.query("SELECT * FROM voucher ORDER BY idvoucher")).rows; }
  async function apply(data: { purchaseIds: number[]; targetDate: string | null; validity: string; reason: string; notifyEmail: boolean } = input, key = "first") { const preview = await previewPurchaseBatch(data); return applyPurchaseBatch({ ...data, fingerprint: preview.fingerprint, idempotencyKey: key },actor); }
  it("previews without writes then moves all tickets and services at their original prices", async () => {
    const before = await snapshot(); const preview = await previewPurchaseBatch(input);
    expect(preview.items[0]).toMatchObject({ purchaseId: 1,status: "eligible" }); expect(preview.items[0].vouchers).toHaveLength(3);
    expect(await snapshot()).toEqual(before);
    expect(await apply()).toMatchObject({ applied: [1],adjustments: [],emailPending: 0 });
    const after = await snapshot();
    expect(after.slice(0,3).map(v => [v.idvoucher,v.idcompra,v.idagenda,v.vlunicompra])).toEqual([[11,1,20,"100"],[12,1,20,"0"],[13,1,20,"20"]]);
    expect(after[3]).toEqual(before[3]);
    expect((await pool.query('SELECT data::text,quantidade FROM online_capacity_reservations')).rows).toEqual([{ data: '2099-07-21',quantidade: 2 }]);
  });
  it('supports legacy purchases without the optional school checkout context column', async () => {
    await pool.query('ALTER TABLE compra DROP COLUMN checkout_school_site_context');
    try { expect((await previewPurchaseBatch(input)).items[0].status).toBe('eligible'); }
    finally { await pool.query('ALTER TABLE compra ADD COLUMN checkout_school_site_context jsonb'); }
  });
  it("replays a committed command after closure once and rejects changed payload or actor", async () => {
    const preview = await previewPurchaseBatch(input); const command = { ...input, fingerprint: preview.fingerprint,idempotencyKey: "replay" };
    const first = await applyPurchaseBatch(command,actor); await pool.query("UPDATE operacao_dias SET estado='closed'");
    expect(await applyPurchaseBatch(command,actor)).toEqual(first);
    await expect(applyPurchaseBatch({ ...command, reason: "Outro" },actor)).rejects.toMatchObject({ code: "batch_idempotency_conflict" });
    await expect(applyPurchaseBatch(command,{ ...actor,cpf: '11111111111' })).rejects.toMatchObject({ status: 403 });
    expect((await pool.query('SELECT count(*) FROM edicoes_log')).rows[0].count).toBe('1');
  });
  it.each([
    "UPDATE voucher SET stusado='s' WHERE idvoucher=12", "UPDATE voucher SET stusado='inv' WHERE idvoucher=12",
    "UPDATE compra SET stcompra='canc' WHERE idcompra=1", "UPDATE compra SET stcompra='pend' WHERE idcompra=1",
    "UPDATE voucher SET dtinicio_validade='2000-01-01',dtvalidade='2000-01-02' WHERE idvoucher=12",
    "UPDATE voucher SET idescola=1 WHERE idvoucher=12", "INSERT INTO agenda_extras VALUES(10,1)",
    "UPDATE voucher SET parque_operacional='estancia' WHERE idvoucher=12", "UPDATE online_capacity_reservations SET delivery_hold=true",
    "INSERT INTO commerce_school_payment_hold VALUES(1,'held')", "UPDATE compra SET checkout_school_site_context='{}' WHERE idcompra=1",
  ])("rejects the whole purchase: %s", async sql => {
    await pool.query(sql); const before = await snapshot(); const data = { ...input,purchaseIds: [1,2] };
    const preview = await previewPurchaseBatch(data); expect(preview.items[0].status).toBe('rejected');
    await apply(data); expect((await snapshot()).filter(v => v.idcompra === 1)).toEqual(before.filter(v => v.idcompra === 1));
  });
  it("creates an explicit adjustment for closed financial history without changing vouchers or capacity", async () => {
    await pool.query("UPDATE voucher SET periodo_id=5 WHERE idcompra=1; UPDATE caixa_periodos SET fechado_em=now()");
    const before = await snapshot(); expect((await previewPurchaseBatch(input)).items[0].status).toBe('adjustment_required');
    expect(await apply()).toMatchObject({ applied: [],adjustments: [1],emailPending: 0 }); expect(await snapshot()).toEqual(before);
    expect((await pool.query('SELECT status FROM purchase_adjustments')).rows).toEqual([{ status: 'pending' }]);
    expect((await pool.query('SELECT data::text FROM online_capacity_reservations')).rows[0].data).toBe('2099-07-20');
  });
  it("rejects a stale preview without applying the still-eligible subset", async () => {
    const data = { ...input,purchaseIds: [1,2] }; const preview = await previewPurchaseBatch(data);
    await pool.query("UPDATE voucher SET stusado='s' WHERE idvoucher=21"); const before = await snapshot();
    await expect(applyPurchaseBatch({ ...data,fingerprint: preview.fingerprint,idempotencyKey: "stale" },actor)).rejects.toMatchObject({ code: "batch_preview_changed" });
    expect(await snapshot()).toEqual(before);
  });
  it('serializes concurrent commands for the same purchases without duplicate moves or audits', async () => {
    const preview = await previewPurchaseBatch(input);
    const results = await Promise.allSettled(['one','two'].map(idempotencyKey => applyPurchaseBatch({ ...input,fingerprint: preview.fingerprint,idempotencyKey },actor)));
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.find(r => r.status === 'rejected')).toMatchObject({ reason: { code: 'batch_preview_changed' } });
    expect((await pool.query('SELECT count(*) FROM edicoes_log')).rows[0].count).toBe('1');
  });
  it('deduplicates concurrent identical keys', async () => {
    const preview = await previewPurchaseBatch(input); const command = { ...input,fingerprint: preview.fingerprint,idempotencyKey: 'same' };
    const [a,b] = await Promise.all([applyPurchaseBatch(command,actor),applyPurchaseBatch(command,actor)]); expect(a).toEqual(b);
    expect((await pool.query('SELECT count(*) FROM purchase_batches')).rows[0].count).toBe('1');
  });
  it('validity-only edits leave quota and agenda identity intact', async () => {
    const result = await apply({ ...input,targetDate: null,validity: '30_days' });
    expect(result.applied).toEqual([1]);
    expect((await pool.query('SELECT idagenda,dtvalidade::text FROM voucher WHERE idvoucher=11')).rows[0]).toEqual({ idagenda: 10,dtvalidade: '2099-08-18' });
    expect((await pool.query('SELECT data::text FROM online_capacity_reservations')).rows[0].data).toBe('2099-07-20');
  });
  it("checks aggregate online quota and never creates reservations for historical or gate purchases", async () => {
    await pool.query("UPDATE operacao_dias SET limite_online=1 WHERE data='2099-07-21'");
    expect((await previewPurchaseBatch(input)).items[0].status).toBe('rejected');
    await pool.query("UPDATE operacao_dias SET limite_online=2 WHERE data='2099-07-21'");
    expect(await apply({ ...input,purchaseIds: [1,2] })).toMatchObject({ applied: [1,2] });
    expect((await pool.query('SELECT count(*) FROM online_capacity_reservations')).rows[0].count).toBe('1');
  });
  it("rejects all incoming online reservations when their combined quantity exceeds the target", async () => {
    await pool.query("INSERT INTO online_capacity_reservations(idcompra,parque,data,quantidade) VALUES(2,'rincao','2099-07-20',1); UPDATE operacao_dias SET limite_online=2 WHERE data='2099-07-21'");
    expect((await previewPurchaseBatch({ ...input,purchaseIds: [1,2] })).items.map(i => i.status)).toEqual(['rejected','rejected']);
  });
  it.each(["INSERT INTO agenda_extras VALUES(20,1)","UPDATE online_capacity_reservations SET quantidade=1", "UPDATE online_capacity_reservations SET data='2099-07-19'"])("rejects inconsistent target or capacity: %s", async sql => {
    await pool.query(sql); expect((await previewPurchaseBatch(input)).items[0].status).toBe('rejected');
  });
  it("persists notification once in the same transaction without altering legacy sent flags", async () => {
    expect(await apply({ ...input,notifyEmail: true })).toMatchObject({ applied: [1],emailPending: 1 });
    expect((await pool.query('SELECT status,destination FROM purchase_batch_email')).rows).toEqual([{ status: 'pending',destination: 'cliente@example.test' }]);
  });
  it('dispatches frozen notices once after commit and masks destinations', async () => {
    const batch = await apply({ ...input,notifyEmail: true,reason: '<script>alert(1)</script>' });
    const result = await dispatchPurchaseBatchEmail(batch.batchId,actor);
    expect(result).toMatchObject({ pending: 0,accepted: 1,unknown: 0 }); expect(JSON.stringify(result)).not.toContain('cliente@example.test');
    expect(state.send).toHaveBeenCalledOnce(); expect(state.send.mock.calls[0][0].html).toContain('&lt;script&gt;');
    expect(state.send.mock.calls[0][0].html).not.toContain('<script>');
    await dispatchPurchaseBatchEmail(batch.batchId,actor); expect(state.send).toHaveBeenCalledOnce();
    await expect(dispatchPurchaseBatchEmail(batch.batchId,{ ...actor,cpf: '11111111111' })).rejects.toMatchObject({ status: 403 });
  });
  it('keeps unconfigured email pending without claiming or sending', async () => {
    const batch = await apply({ ...input,notifyEmail: true }); state.configured.mockReturnValue(false);
    expect(await dispatchPurchaseBatchEmail(batch.batchId,actor)).toMatchObject({ configured: false,pending: 1,dispatching: 0 }); expect(state.send).not.toHaveBeenCalled();
    expect(await listPurchaseBatchEmail(actor)).toMatchObject([{ batchId: batch.batchId,purchaseIds: [1],summary: { pending: 1 } }]);
    expect(await listPurchaseBatchEmail({ ...actor,cpf: '11111111111' })).toEqual([]);
  });
  it('concurrent recovery never sends the same notice twice, including after an expired lease', async () => {
    const batch = await apply({ ...input,notifyEmail: true });
    let entered!: () => void,release!: (value: string) => void; const started = new Promise<void>(resolve => { entered = resolve; });
    state.send.mockImplementation(() => { entered(); return new Promise(resolve => { release = resolve; }); });
    const first = dispatchPurchaseBatchEmail(batch.batchId,actor); await started;
    expect(await dispatchPurchaseBatchEmail(batch.batchId,actor)).toMatchObject({ dispatching: 1 }); expect(state.send).toHaveBeenCalledOnce();
    await pool.query("UPDATE purchase_batch_email SET lease_expires_at=clock_timestamp()-interval '1 second'");
    expect(await dispatchPurchaseBatchEmail(batch.batchId,actor)).toMatchObject({ unknown: 1 });
    release('accepted'); expect(await first).toMatchObject({ unknown: 1,accepted: 0 }); expect(state.send).toHaveBeenCalledOnce();
  });
  it("rolls back all changes and notifications if audit fails", async () => {
    await pool.query(`CREATE FUNCTION fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'audit unavailable'; END $$;
      CREATE TRIGGER fail_audit BEFORE INSERT ON edicoes_log FOR EACH ROW EXECUTE FUNCTION fail_audit();`);
    try { const before = await snapshot(); await expect(apply({ ...input,notifyEmail: true })).rejects.toThrow('audit unavailable'); expect(await snapshot()).toEqual(before);
      expect((await pool.query('SELECT count(*) FROM purchase_batches')).rows[0].count).toBe('0');
    } finally { await pool.query('DROP TRIGGER fail_audit ON edicoes_log; DROP FUNCTION fail_audit()'); }
  });
  it("observes validation committed while waiting on the discovered day", async () => {
    const preview = await previewPurchaseBatch(input); const writer = await pool.connect();
    try {
      await writer.query("BEGIN; SELECT pg_advisory_xact_lock(hashtextextended('operational-day:rincao:2099-07-20',0)); UPDATE voucher SET stusado='s' WHERE idvoucher=11");
      let entered!: () => void; const discovery = new Promise<void>(resolve => { entered = resolve; }); state.onDay = async () => { entered(); };
      const pending = applyPurchaseBatch({ ...input,fingerprint: preview.fingerprint,idempotencyKey: 'race' },actor).then(value => ({ value }),error => ({ error }));
      await discovery; await writer.query('COMMIT'); expect(await pending).toMatchObject({ error: { code: 'batch_preview_changed' } });
      expect((await pool.query('SELECT idagenda FROM voucher WHERE idvoucher=12')).rows[0].idagenda).toBe(10);
    } finally { await writer.query('ROLLBACK'); writer.release(); }
  });
});
