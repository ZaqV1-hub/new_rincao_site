import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { sendOperationalVoucherWhatsapp } from "./operational-voucher-whatsapp";

const mock = vi.hoisted(() => ({ pool: null as Pool | null, send: vi.fn() }));
vi.mock("@/lib/ingresso-db", () => ({ getIngressoSistemaDbPool: () => mock.pool }));
vi.mock("@/lib/ticket-service-whatsapp", () => ({ sendPurchaseTicketsWhatsApp: mock.send }));
const connectionString = process.env.PANEL_TEST_DATABASE_URL;
if (connectionString) {
  const url = new URL(connectionString);
  if (!["postgres:", "postgresql:"].includes(url.protocol) || url.hostname !== "127.0.0.1" || url.pathname !== "/chargeback_test_painel" || url.search || url.hash) throw new Error("PANEL_TEST_DATABASE_URL must use the local scratch database without URL options");
}
const actor = { name: "Operador", cpf: "52998224725" };
const input = (key = "first") => ({ voucherIds: [100,101],phoneNumber: "11987654321",destinationConfirmed: true,idempotencyKey: key });
describe.skipIf(!connectionString)("durable WhatsApp PostgreSQL", () => {
  const schema = `voucher_whatsapp_it_${randomBytes(8).toString("hex")}`;
  let admin: Pool, pool: Pool, created = false;
  beforeAll(async () => {
    admin = new Pool({ connectionString,connectionTimeoutMillis: 3000 });
    await admin.query(`CREATE SCHEMA ${schema}`); created = true;
    pool = new Pool({ connectionString,options: `-c search_path=${schema} -c statement_timeout=10000 -c lock_timeout=5000`,max: 6,connectionTimeoutMillis: 3000 }); mock.pool = pool;
    await pool.query(`CREATE TABLE compra (idcompra BIGINT PRIMARY KEY,stcompra CHAR(4),checkout_school_site_context JSONB);
      CREATE TABLE voucher (idvoucher BIGINT PRIMARY KEY,idcompra BIGINT REFERENCES compra,parque_operacional TEXT,stusado TEXT,idagenda INT,
        dtinicio_validade DATE,dtvalidade DATE,stvoucher TEXT,vlunicompra NUMERIC,voucherenviado TEXT);
      CREATE TABLE online_capacity_reservations(idcompra BIGINT PRIMARY KEY,delivery_hold BOOLEAN);
      CREATE TABLE commerce_school_payment_hold(order_id BIGINT PRIMARY KEY,status TEXT,source TEXT);
      CREATE TABLE edicoes_log(id SERIAL PRIMARY KEY,origem VARCHAR(30),acao VARCHAR(30),compra_id BIGINT,movimentacao_id INT,movimentacao_tipo TEXT,
        periodo_id INT,folha_id INT,descricao TEXT,motivo TEXT,usuario_nome TEXT,detalhes_json TEXT,created_at TIMESTAMPTZ DEFAULT now());`);
    const migration = await readFile(new URL("../../docs/sql/2026-11-12-voucher-notifications.sql",import.meta.url),"utf8");
    await pool.query(migration);
    await pool.query(migration); // Rerun preserves existing schema/data and needs no runtime DDL.
  });
  afterAll(async () => { try { await pool?.end(); if (created) await admin.query(`DROP SCHEMA ${schema} CASCADE`); } finally { await admin?.end(); } });
  beforeEach(async () => {
    vi.stubEnv("OPERATIONAL_PARK_ID","rincao"); vi.stubEnv("TICKETS_API_BASE_URL","http://127.0.0.1:1"); vi.stubEnv("INGRESSO_TICKET_API_WHATSAPP_TESTING","false");
    vi.stubGlobal("fetch",vi.fn(() => { throw new Error("No real network is allowed in this suite"); }));
    mock.send.mockReset().mockResolvedValue({ status: "sent",purchaseId: 1,sentVoucherIds: [100,101] });
    await pool.query(`TRUNCATE edicoes_log,voucher_notification_requests,voucher,online_capacity_reservations,commerce_school_payment_hold,compra;
      INSERT INTO compra VALUES (1,'conc',NULL),(2,'conc',NULL);
      INSERT INTO voucher VALUES (100,1,'rincao','n',10,'2099-11-12','2099-11-20','ativo',10,'s'),
        (101,1,NULL,'n',10,NULL,NULL,'ativo',20,'s'),(200,2,'rincao','n',10,NULL,NULL,'ativo',1,'s');`);
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
  const count = async () => Number((await pool.query("SELECT COUNT(*) FROM voucher_notification_requests")).rows[0].count);

  it("commits a private claim before the only transport call and exposes only a masked destination", async () => {
    mock.send.mockImplementation(async () => {
      expect((await pool.query("SELECT status,actor_name,destination FROM voucher_notification_requests")).rows).toEqual([{ status: "dispatching",actor_name: "Operador",destination: "11987654321" }]);
      const audit = (await pool.query("SELECT origem,acao,descricao,motivo,usuario_nome,detalhes_json FROM edicoes_log")).rows;
      expect(audit).toHaveLength(1);
      expect(audit[0]).toMatchObject({ origem: "voucher",acao: "whatsapp_request",descricao: "Solicitação de envio de vouchers por WhatsApp registrada.",motivo: "Destino conferido pelo operador",usuario_nome: "Operador" });
      expect(JSON.parse(audit[0].detalhes_json)).toEqual({ requestId: expect.any(String),voucherIds: [100,101],destinationMasked: "••••••4321" });
      expect(JSON.stringify(audit)).not.toMatch(/11987654321|52998224725/);
      return { status: "sent",purchaseId: 1,sentVoucherIds: [100,101] };
    });
    const response = await sendOperationalVoucherWhatsapp(1,input(),actor);
    expect(response).toMatchObject({ status: "accepted",destinationMasked: "••••••4321",voucherIds: [100,101] });
    expect(response.message).toContain("não foi confirmada");
    expect(JSON.stringify(response)).not.toMatch(/11987654321|52998224725|material_snapshot|request_hash/);
    expect(mock.send).toHaveBeenCalledOnce(); expect(fetch).not.toHaveBeenCalled();
  });
  it("returns queued for 202 and replays it after purchase changes or configuration disappears", async () => {
    mock.send.mockResolvedValue({ status: "sent",purchaseId: 1,sentVoucherIds: [100,101],deliveryStatus: "queued",upstreamStatus: 202 });
    const first = await sendOperationalVoucherWhatsapp(1,input(),actor);
    expect(first.status).toBe("queued");
    await pool.query("UPDATE compra SET stcompra='canc' WHERE idcompra=1; UPDATE voucher SET stusado='inv' WHERE idcompra=1");
    vi.stubEnv("TICKETS_API_BASE_URL",""); vi.stubEnv("INGRESSO_TICKET_API_BASE_URL","");
    expect(await sendOperationalVoucherWhatsapp(1,{ ...input(),voucherIds: [101,100],phoneNumber: "(11) 98765-4321" },{ name: "Nome atualizado",cpf: actor.cpf })).toEqual(first);
    expect(mock.send).toHaveBeenCalledOnce();
  });
  it("rejects a different destination, selection or purchase for the same key without dispatch", async () => {
    await sendOperationalVoucherWhatsapp(1,input(),actor);
    for (const [purchaseId,body] of [[1,{ ...input(),phoneNumber: "11999999999" }],[1,{ ...input(),voucherIds: [100] }],[2,input()]] as const) {
      await expect(sendOperationalVoucherWhatsapp(purchaseId,body,actor)).rejects.toMatchObject({ code: "whatsapp_idempotency_conflict" });
    }
    expect(mock.send).toHaveBeenCalledOnce(); expect(await count()).toBe(1);
  });
  it("does not reveal a stored request to a new operator using the same browser storage", async () => {
    await sendOperationalVoucherWhatsapp(1,input(),actor);
    await expect(sendOperationalVoucherWhatsapp(1,input(),{ name: "Outro",cpf: "11144477735" })).rejects.toMatchObject({ code: "whatsapp_request_forbidden",status: 403 });
    await expect(sendOperationalVoucherWhatsapp(1,input("other"),{ name: "Sem CPF",cpf: null })).rejects.toMatchObject({ code: "whatsapp_actor_unavailable",status: 403 });
    expect(mock.send).toHaveBeenCalledOnce(); expect(await count()).toBe(1);
  });
  it("serializes simultaneous same-key requests, returning the committed dispatching state without a second send", async () => {
    let release!: (value: unknown) => void;
    let entered!: () => void;
    const started = new Promise<void>(resolve => { entered = resolve; });
    mock.send.mockImplementation(() => { entered(); return new Promise(resolve => { release = resolve; }); });
    const first = sendOperationalVoucherWhatsapp(1,input(),actor);
    await started;
    const replay = await sendOperationalVoucherWhatsapp(1,input(),actor);
    expect(replay.status).toBe("dispatching"); expect(mock.send).toHaveBeenCalledOnce();
    release({ status: "sent",purchaseId: 1,sentVoucherIds: [100,101] });
    expect((await first).requestId).toBe(replay.requestId); expect(await count()).toBe(1);
  });
  it("deduplicates two requests started before either claim exists", async () => {
    const [first,second] = await Promise.all([sendOperationalVoucherWhatsapp(1,input(),actor),sendOperationalVoucherWhatsapp(1,input(),actor)]);
    expect(first.requestId).toBe(second.requestId); expect(mock.send).toHaveBeenCalledOnce(); expect(await count()).toBe(1);
    expect((await pool.query("SELECT COUNT(*) FROM edicoes_log")).rows[0].count).toBe("1");
  });
  it("rolls back the claim if its audit cannot be recorded, without starting the transport", async () => {
    await pool.query(`CREATE FUNCTION fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'audit unavailable'; END $$;
      CREATE TRIGGER fail_audit BEFORE INSERT ON edicoes_log FOR EACH ROW EXECUTE FUNCTION fail_audit();`);
    try {
      await expect(sendOperationalVoucherWhatsapp(1,input(),actor)).rejects.toThrow("audit unavailable");
      expect(await count()).toBe(0); expect(mock.send).not.toHaveBeenCalled();
    } finally { await pool.query("DROP TRIGGER fail_audit ON edicoes_log; DROP FUNCTION fail_audit()"); }
  });
  it("never reclaims an expired dispatch even if the original transport later reports success", async () => {
    let release!: (value: unknown) => void, entered!: () => void;
    const started = new Promise<void>(resolve => { entered = resolve; });
    mock.send.mockImplementation(() => { entered(); return new Promise(resolve => { release = resolve; }); });
    const first = sendOperationalVoucherWhatsapp(1,input(),actor); await started;
    await pool.query("UPDATE voucher_notification_requests SET lease_expires_at=clock_timestamp()-INTERVAL '1 second'");
    expect((await sendOperationalVoucherWhatsapp(1,input(),actor)).status).toBe("unknown");
    release({ status: "sent",purchaseId: 1,sentVoucherIds: [100,101] });
    expect((await first).status).toBe("unknown"); expect(mock.send).toHaveBeenCalledOnce();
  });
  it("makes timeout unknown without cancelling or retrying the underlying helper", async () => {
    let entered!: () => void, release!: (value: unknown) => void;
    const started = new Promise<void>(resolve => { entered = resolve; });
    mock.send.mockImplementation(() => {
      vi.useFakeTimers({ toFake: ["setTimeout","clearTimeout"] });
      entered(); return new Promise(resolve => { release = resolve; });
    });
    const sending = sendOperationalVoucherWhatsapp(1,input(),actor); await started;
    await vi.advanceTimersByTimeAsync(25_001); vi.useRealTimers();
    const uncertain = await sending; expect(uncertain.status).toBe("unknown");
    release({ status: "sent",purchaseId: 1,sentVoucherIds: [100,101] });
    expect(await sendOperationalVoucherWhatsapp(1,input(),actor)).toEqual(uncertain); expect(mock.send).toHaveBeenCalledOnce();
  });
  it.each(["network timeout after accept","ticket_api_error_500"])("keeps %s unknown and never leaks the raw error", async (message) => {
    mock.send.mockRejectedValue(new Error(`${message}: phone 11987654321`));
    const first = await sendOperationalVoucherWhatsapp(1,input(),actor);
    expect(first.status).toBe("unknown"); expect(JSON.stringify(first)).not.toContain("11987654321");
    expect(await sendOperationalVoucherWhatsapp(1,input(),actor)).toEqual(first); expect(mock.send).toHaveBeenCalledOnce();
  });
  it("marks a changed/partial transport selection unknown instead of claiming full success", async () => {
    mock.send.mockResolvedValue({ status: "sent",purchaseId: 1,sentVoucherIds: [100] });
    expect((await sendOperationalVoucherWhatsapp(1,input(),actor)).status).toBe("unknown");
    expect((await sendOperationalVoucherWhatsapp(1,input(),actor)).status).toBe("unknown"); expect(mock.send).toHaveBeenCalledOnce();
  });
  it.each(["purchase_not_confirmed","invalid_phone_number","phone_not_allowed_for_testing"])("records helper refusal %s as durable failed, never a correctable 400 after claim", async skippedReason => {
    mock.send.mockResolvedValue({ status: "skipped",purchaseId: 1,sentVoucherIds: [],skippedReason });
    expect((await sendOperationalVoucherWhatsapp(1,input(),actor)).status).toBe("failed");
    await sendOperationalVoucherWhatsapp(1,input(),actor); expect(mock.send).toHaveBeenCalledOnce();
  });
  it.each([[100,200],[100,999]])("rejects the entire cross-purchase or missing selection %j before persistence", async (...voucherIds) => {
    await expect(sendOperationalVoucherWhatsapp(1,{ ...input(),voucherIds },actor)).rejects.toMatchObject({ code: "voucher_selection_unavailable" });
    expect(await count()).toBe(0); expect(mock.send).not.toHaveBeenCalled();
  });
  it("rejects explicit other parks and invalid vouchers without silently sending a subset", async () => {
    await pool.query("UPDATE voucher SET parque_operacional='estancia' WHERE idvoucher=101");
    await expect(sendOperationalVoucherWhatsapp(1,input(),actor)).rejects.toMatchObject({ code: "voucher_selection_unavailable" });
    await pool.query("UPDATE voucher SET parque_operacional=NULL,stusado='inv' WHERE idvoucher=101");
    await expect(sendOperationalVoucherWhatsapp(1,input(),actor)).rejects.toMatchObject({ code: "voucher_selection_unavailable" });
    expect(await count()).toBe(0); expect(mock.send).not.toHaveBeenCalled();
  });
  it("rejects canceled purchases, online holds, school holds and pending initial school delivery", async () => {
    await pool.query("UPDATE compra SET stcompra='canc' WHERE idcompra=1");
    await expect(sendOperationalVoucherWhatsapp(1,input(),actor)).rejects.toMatchObject({ code: "purchase_not_confirmed" });
    await pool.query("UPDATE compra SET stcompra='conc'; INSERT INTO online_capacity_reservations VALUES (1,true)");
    await expect(sendOperationalVoucherWhatsapp(1,input(),actor)).rejects.toMatchObject({ code: "voucher_delivery_held" });
    await pool.query("DELETE FROM online_capacity_reservations; INSERT INTO commerce_school_payment_hold VALUES (1,'held','site')");
    await expect(sendOperationalVoucherWhatsapp(1,input(),actor)).rejects.toMatchObject({ code: "voucher_delivery_held" });
    await pool.query("UPDATE commerce_school_payment_hold SET status='released'; UPDATE voucher SET voucherenviado='n' WHERE idvoucher=101");
    await expect(sendOperationalVoucherWhatsapp(1,input(),actor)).rejects.toMatchObject({ code: "voucher_delivery_held" });
    expect(await count()).toBe(0); expect(mock.send).not.toHaveBeenCalled();
  });
  it("does not bypass a managed school purchase with a missing hold", async () => {
    await pool.query("UPDATE compra SET checkout_school_site_context='{}' WHERE idcompra=1");
    await expect(sendOperationalVoucherWhatsapp(1,input(),actor)).rejects.toMatchObject({ code: "voucher_delivery_held" });
    expect(await count()).toBe(0);
  });
  it("checks explicit configuration and test destination before claiming", async () => {
    vi.stubEnv("TICKETS_API_BASE_URL",""); vi.stubEnv("INGRESSO_TICKET_API_BASE_URL","");
    await expect(sendOperationalVoucherWhatsapp(1,input(),actor)).rejects.toMatchObject({ code: "whatsapp_not_configured" });
    vi.stubEnv("TICKETS_API_BASE_URL","http://127.0.0.1:1"); vi.stubEnv("INGRESSO_TICKET_API_WHATSAPP_TESTING","true"); vi.stubEnv("INGRESSO_TICKET_API_WHATSAPP_ALLOWED_NUMBERS","11900000000");
    await expect(sendOperationalVoucherWhatsapp(1,input(),actor)).rejects.toMatchObject({ code: "whatsapp_invalid_input",status: 400 });
    expect(await count()).toBe(0); expect(mock.send).not.toHaveBeenCalled();
  });
  it("preflight waits for a parent writer and observes its newly committed hold", async () => {
    const writer = await pool.connect();
    try {
      await writer.query("BEGIN; SELECT idcompra FROM compra WHERE idcompra=1 FOR UPDATE");
      const sending = sendOperationalVoucherWhatsapp(1,input(),actor);
      await writer.query("INSERT INTO online_capacity_reservations VALUES (1,true); COMMIT");
      await expect(sending).rejects.toMatchObject({ code: "voucher_delivery_held" });
    } finally { await writer.query("ROLLBACK"); writer.release(); }
    expect(await count()).toBe(0); expect(mock.send).not.toHaveBeenCalled();
  });
  it("lost result persistence leaves a durable claim that consults unknown, never a second transport call", async () => {
    await pool.query(`CREATE FUNCTION fail_result() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.status='accepted' THEN RAISE EXCEPTION 'result write failure'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER fail_result BEFORE UPDATE ON voucher_notification_requests FOR EACH ROW EXECUTE FUNCTION fail_result();`);
    try {
      await expect(sendOperationalVoucherWhatsapp(1,input(),actor)).rejects.toThrow("result write failure");
      expect((await sendOperationalVoucherWhatsapp(1,input(),actor)).status).toBe("dispatching");
      await pool.query("UPDATE voucher_notification_requests SET lease_expires_at=clock_timestamp()-INTERVAL '1 second'");
      expect((await sendOperationalVoucherWhatsapp(1,input(),actor)).status).toBe("unknown"); expect(mock.send).toHaveBeenCalledOnce();
    } finally { await pool.query("DROP TRIGGER fail_result ON voucher_notification_requests; DROP FUNCTION fail_result()"); }
  });
});
