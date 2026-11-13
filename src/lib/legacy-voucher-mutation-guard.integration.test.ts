import { randomBytes } from "node:crypto";
import { Pool } from "pg";
import { beforeAll, beforeEach, afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { lockLegacyVoucherMutation } from "./legacy-voucher-mutation-guard";
import { rescheduleUserVoucher, cancelReservationPurchase } from "./voucher-repository";
import { getOnlineCapacityOccupied } from "./online-capacity";
import { updatePainelTripVoucherStudent } from "./painel-clientes";

const state = vi.hoisted(() => ({ pool: null as Pool | null, onDay: null as (() => Promise<void>) | null, hold: vi.fn() }));
vi.mock("@/lib/ingresso-db", () => ({ getIngressoSistemaDbPool: () => state.pool, getIngressoDbPool: () => state.pool, getIngressoSistemaDbDialect: () => "postgres" }));
vi.mock("@/lib/school-payment-eligibility", () => ({ getSchoolPaymentHold: state.hold }));
vi.mock("@/lib/operational-day-lock", async (original) => {
  const actual = await original<typeof import("./operational-day-lock")>();
  return { lockOperationalDay: async (...args: Parameters<typeof actual.lockOperationalDay>) => {
    await state.onDay?.(); return actual.lockOperationalDay(...args);
  } };
});
const connectionString = process.env.PANEL_TEST_DATABASE_URL;
if (connectionString) {
  const url = new URL(connectionString);
  if (!["postgres:", "postgresql:"].includes(url.protocol) || url.hostname !== "127.0.0.1" || url.pathname !== "/chargeback_test_painel" || url.search || url.hash) throw new Error("Only the local scratch database without URL options is allowed");
}
const cpf = "52998224725";
const student = () => updatePainelTripVoucherStudent({ voucherId: 11, values: {
  purchaseId: 1, studentName: "Aluno Teste", schoolId: 1, agendaId: 2,
  educationType: "fund1", educationYear: "1", classLetter: "A", purchaseStatus: "conc", value: "70,00",
} });
describe.skipIf(!connectionString)("legacy writers use operational locks and fresh financial context", () => {
  const schema = `legacy_guard_${randomBytes(8).toString("hex")}`;
  let admin: Pool; let pool: Pool; let created = false;
  beforeAll(async () => {
    admin = new Pool({ connectionString, connectionTimeoutMillis: 2000 });
    await admin.query(`CREATE SCHEMA ${schema}`); created = true;
    pool = new Pool({ connectionString, options: `-c search_path=${schema} -c statement_timeout=10000 -c lock_timeout=7000`, max: 5 }); state.pool = pool;
    await pool.query(`
      CREATE TABLE agenda(idagenda integer PRIMARY KEY,dtagenda date,tpagenda text,stagenda text);
      CREATE TABLE agenda_extras(idagenda integer,idcliente integer);
      CREATE TABLE compra(idcompra integer PRIMARY KEY,cpf text,caixa_periodo_id integer,stcompra text,dtcompra date,vltotcompra numeric,tpcompra text DEFAULT 'reser',dtpagamento date);
      CREATE TABLE voucher(idvoucher integer PRIMARY KEY,idcompra integer REFERENCES compra,idagenda integer REFERENCES agenda,
        parque_operacional text,dtinicio_validade date,dtvalidade date,dtuso date,closed_at timestamptz,periodo_id integer,
        validacao_periodo_id integer,stusado text,stvoucher text,flreagendado text,tpvoucher text,tpparticipante text,
        nomealuno text,ensino_tipo text,ensino_ano text,turma_letra text,turma text,periodo text,idescola integer,vlunicompra numeric);
      CREATE TABLE compra_pagamentos(idcompra integer REFERENCES compra,periodo_id integer);
      CREATE TABLE caixa_periodos(id integer PRIMARY KEY,parque text,data_operacional date,fechado_em timestamptz,folha_id integer);
      CREATE TABLE caixa_fechamentos(periodo_id integer);
      CREATE TABLE operacao_dias(parque text,data date,estado text,PRIMARY KEY(parque,data));
      CREATE TABLE online_capacity_reservations(idcompra integer PRIMARY KEY REFERENCES compra,parque text DEFAULT 'rincao',data date DEFAULT CURRENT_DATE,
        quantidade integer DEFAULT 1,expires_at timestamptz DEFAULT now()+interval '12 hours',attempt_started_at timestamptz,delivery_hold boolean DEFAULT false);
    `);
  });
  beforeEach(async () => {
    vi.stubEnv("OPERATIONAL_PARK_ID", "rincao"); state.onDay = null; state.hold.mockResolvedValue(null);
    await pool.query(`TRUNCATE voucher,compra_pagamentos,online_capacity_reservations,compra,agenda_extras,agenda,caixa_periodos,caixa_fechamentos,operacao_dias CASCADE;
      INSERT INTO agenda VALUES (1,CURRENT_DATE,'escol','abe'),(2,CURRENT_DATE+1,'padra','abe'),(3,CURRENT_DATE+2,'padra','abe');
      INSERT INTO agenda_extras VALUES(2,1);
      INSERT INTO compra(idcompra,cpf,caixa_periodo_id,stcompra,dtcompra,vltotcompra) VALUES(1,'52998224725',NULL,'conc',CURRENT_DATE,50);
      INSERT INTO voucher(idvoucher,idcompra,idagenda,stusado,stvoucher,tpvoucher,vlunicompra) VALUES(11,1,1,'n','ativo','escol',50);
      INSERT INTO operacao_dias SELECT 'rincao',dtagenda,'open' FROM agenda;
      INSERT INTO caixa_periodos VALUES(5,'rincao',CURRENT_DATE,NULL,NULL);
    `);
  });
  afterEach(() => { state.onDay = null; vi.unstubAllEnvs(); });
  afterAll(async () => { await pool?.end(); if (created) await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin?.end(); });
  async function snapshot() { return (await pool.query("SELECT idagenda,vlunicompra::text,flreagendado,nomealuno FROM voucher WHERE idvoucher=11")).rows[0]; }
  async function guard() {
    const client = await pool.connect();
    try { await client.query("BEGIN"); await lockLegacyVoucherMutation(client, { voucherId: 11, targetAgendaId: 2, cpf }); await client.query("COMMIT"); }
    catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  }
  it("keeps supported legacy student edits and rescheduling working", async () => {
    await expect(student()).resolves.toMatchObject({ voucherId: 11, purchaseId: 1 });
    expect(await snapshot()).toMatchObject({ idagenda: 2, vlunicompra: "70", nomealuno: "Aluno Teste" });
    await expect(rescheduleUserVoucher(cpf,11,3)).resolves.toBe(11);
    expect(await snapshot()).toMatchObject({ idagenda: 3, flreagendado: "s", vlunicompra: "70" });
  });
  it.each([
    ["UPDATE operacao_dias SET estado='closed' WHERE data=CURRENT_DATE", "voucher_day_closed"],
    ["UPDATE operacao_dias SET estado='closed' WHERE data=CURRENT_DATE+1", "voucher_day_closed"],
    ["UPDATE voucher SET parque_operacional='estancia'", "voucher_park_mismatch"],
    ["UPDATE voucher SET closed_at=now()", "purchase_financial_adjustment_required"],
    ["UPDATE compra SET caixa_periodo_id=5", "purchase_financial_adjustment_required"],
    ["INSERT INTO compra_pagamentos VALUES(1,5)", "purchase_financial_adjustment_required"],
    ["UPDATE voucher SET validacao_periodo_id=5", "purchase_financial_adjustment_required"],
    ["UPDATE voucher SET periodo_id=5; UPDATE caixa_periodos SET fechado_em=now()", "voucher_cash_closed"],
    ["UPDATE voucher SET periodo_id=5; INSERT INTO caixa_fechamentos VALUES(5)", "voucher_cash_closed"],
    ["INSERT INTO online_capacity_reservations(idcompra) VALUES(1)", "voucher_operational_change_required"],
    ["UPDATE voucher SET dtinicio_validade=CURRENT_DATE", "voucher_operational_change_required"],
    ["UPDATE voucher SET stusado='s'", "voucher_operational_change_required"],
  ])("blocks both writers without altering values: %s", async (sql, code) => {
    await pool.query(sql); const before = await snapshot();
    await expect(student()).rejects.toMatchObject({ code, status: 409 });
    await expect(rescheduleUserVoucher(cpf,11,2)).resolves.toBeNull();
    expect(await snapshot()).toEqual(before);
  });
  it("rejects foreign ownership and holds", async () => {
    await expect(rescheduleUserVoucher("11111111111",11,2)).resolves.toBeNull();
    state.hold.mockResolvedValue({ status: "held" });
    await expect(student()).rejects.toMatchObject({ code: "school_payment_held" });
  });
  it.each(["student", "reschedule"])("%s sees a financial link committed after discovery", async (writer) => {
    const concurrent = await pool.connect();
    try {
      await concurrent.query("BEGIN");
      await concurrent.query("SELECT pg_advisory_xact_lock(hashtextextended('operational-day:rincao:' || CURRENT_DATE::text,0))");
      await concurrent.query("SELECT idcompra FROM compra WHERE idcompra=1 FOR UPDATE");
      await concurrent.query("INSERT INTO compra_pagamentos VALUES(1,5); UPDATE caixa_periodos SET fechado_em=now()");
      let discovered!: () => void; const discovery = new Promise<void>((resolve) => { discovered = resolve; });
      state.onDay = async () => { discovered(); };
      const result = (writer === "student" ? student() : rescheduleUserVoucher(cpf,11,2)).then((value) => ({ value }), (error: unknown) => ({ error }));
      await discovery; await concurrent.query("COMMIT");
      const outcome = await result;
      if (writer === "student") expect(outcome).toMatchObject({ error: { code: "purchase_financial_adjustment_required" } });
      else expect(outcome).toEqual({ value: null });
      expect(await snapshot()).toMatchObject({ idagenda: 1, vlunicompra: "50", nomealuno: null });
    } finally { await concurrent.query("ROLLBACK"); concurrent.release(); }
  });
  it("rejects changed context after discovery instead of acquiring another day lock", async () => {
    let release!: () => void; let discovered!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const discovery = new Promise<void>((resolve) => { discovered = resolve; });
    let calls = 0;
    state.onDay = async () => { calls++; if (calls === 1) { discovered(); await gate; } };
    const result = guard().then(() => null, (error: unknown) => error);
    await discovery; await pool.query("UPDATE voucher SET idagenda=3 WHERE idvoucher=11"); release();
    expect(await result).toMatchObject({ code: "voucher_context_changed" });
    expect(calls).toBe(2); expect(await snapshot()).toMatchObject({ idagenda: 3, vlunicompra: "50" });
  });
  it.each([false, true])("cancels an eligible reservation and releases capacity without erasing it (quota=%s)", async (quota) => {
    await pool.query("UPDATE compra SET stcompra='pend'; UPDATE voucher SET dtinicio_validade=CURRENT_DATE");
    if (quota) await pool.query("INSERT INTO online_capacity_reservations(idcompra,quantidade) VALUES(1,3)");
    const day = (await pool.query("SELECT CURRENT_DATE::text AS date")).rows[0].date;
    expect(await getOnlineCapacityOccupied(pool,"rincao",day)).toBe(quota ? 3 : 0);
    const before = await snapshot();
    await expect(cancelReservationPurchase(cpf,1)).resolves.toBe(1);
    expect((await pool.query("SELECT stcompra FROM compra WHERE idcompra=1")).rows[0].stcompra).toBe("canc");
    expect(await snapshot()).toEqual(before);
    expect(await getOnlineCapacityOccupied(pool,"rincao",day)).toBe(0);
    expect((await pool.query("SELECT quantidade FROM online_capacity_reservations WHERE idcompra=1")).rows).toEqual(quota ? [{ quantidade: 3 }] : []);
    await expect(cancelReservationPurchase(cpf,1)).resolves.toBeNull();
  });
  it("never cancels a confirmed reservation even if its legacy receipt fields are missing", async () => {
    await expect(cancelReservationPurchase(cpf,1)).resolves.toBeNull();
    expect((await pool.query("SELECT stcompra FROM compra WHERE idcompra=1")).rows[0].stcompra).toBe("conc");
  });
  it.each([
    "UPDATE compra SET caixa_periodo_id=5",
    "INSERT INTO compra_pagamentos VALUES(1,5); UPDATE caixa_periodos SET fechado_em=now()",
    "INSERT INTO compra_pagamentos VALUES(1,NULL)",
    "UPDATE compra SET dtpagamento=CURRENT_DATE",
    "UPDATE voucher SET validacao_periodo_id=5; INSERT INTO caixa_fechamentos VALUES(5)",
    "UPDATE voucher SET closed_at=now()",
    "UPDATE voucher SET stusado='s'",
    "UPDATE voucher SET parque_operacional='estancia'",
    "UPDATE operacao_dias SET estado='closed' WHERE data=CURRENT_DATE",
    "UPDATE compra SET tpcompra='ponli'",
  ])("does not cancel protected reservations: %s", async (sql) => {
    await pool.query("UPDATE compra SET stcompra='pend'");
    await pool.query(sql); const before = await snapshot();
    await expect(cancelReservationPurchase(cpf,1)).resolves.toBeNull();
    expect((await pool.query("SELECT stcompra FROM compra WHERE idcompra=1")).rows[0].stcompra).toBe("pend");
    expect(await snapshot()).toEqual(before);
  });
  it("checks CPF and does not acquire another park's capacity lock", async () => {
    await expect(cancelReservationPurchase("11111111111",1)).resolves.toBeNull();
    await pool.query("INSERT INTO online_capacity_reservations(idcompra,parque) VALUES(1,'estancia')");
    await expect(cancelReservationPurchase(cpf,1)).resolves.toBeNull();
  });
  it("cancellation sees receipt committed after discovery and preserves its payment", async () => {
    await pool.query("UPDATE compra SET stcompra='pend'");
    const writer = await pool.connect();
    try {
      await writer.query("BEGIN");
      await writer.query("SELECT pg_advisory_xact_lock(hashtextextended('operational-day:rincao:' || CURRENT_DATE::text,0))");
      await writer.query("SELECT idcompra FROM compra WHERE idcompra=1 FOR UPDATE");
      await writer.query("INSERT INTO compra_pagamentos VALUES(1,5); UPDATE compra SET dtpagamento=CURRENT_DATE,stcompra='conc'");
      let discovered!: () => void; const discovery = new Promise<void>((resolve) => { discovered = resolve; });
      state.onDay = async () => { discovered(); };
      const cancelling = cancelReservationPurchase(cpf,1);
      await discovery; await writer.query("COMMIT");
      await expect(cancelling).resolves.toBeNull();
      expect((await pool.query("SELECT stcompra FROM compra WHERE idcompra=1")).rows[0].stcompra).toBe("conc");
      expect((await pool.query("SELECT periodo_id FROM compra_pagamentos")).rows).toEqual([{ periodo_id: 5 }]);
    } finally { await writer.query("ROLLBACK"); writer.release(); }
  });
  it("rejects a capacity date changed after discovery without releasing the new date's quota", async () => {
    await pool.query("UPDATE compra SET stcompra='pend'; INSERT INTO online_capacity_reservations(idcompra) VALUES(1)");
    let release!: () => void; let discovered!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const discovery = new Promise<void>((resolve) => { discovered = resolve; });
    let calls = 0; state.onDay = async () => { calls++; if (calls === 1) { discovered(); await gate; } };
    const cancelling = cancelReservationPurchase(cpf,1);
    await discovery; await pool.query("UPDATE online_capacity_reservations SET data=CURRENT_DATE+2 WHERE idcompra=1"); release();
    await expect(cancelling).resolves.toBeNull(); expect(calls).toBe(1);
    expect((await pool.query("SELECT stcompra FROM compra WHERE idcompra=1")).rows[0].stcompra).toBe("pend");
  });
});
