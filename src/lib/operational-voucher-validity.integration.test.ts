import { randomBytes } from "node:crypto";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { expireUnusedVouchers, rescheduleUserVoucher, resetVoucherLifecycleSchemaForTests } from "@/lib/voucher-repository";
import { markVoucherUsed } from "@/lib/ops-voucher-validation-shared";

const mock = vi.hoisted(() => ({ pool: null as Pool | null }));
vi.mock("@/lib/ingresso-db", () => ({ getIngressoSistemaDbPool: () => mock.pool, getIngressoSistemaDbDialect: () => "postgres" }));
vi.mock("@/lib/school-payment-eligibility", () => ({ getSchoolPaymentHold: async () => null }));
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
      CREATE TABLE compra (idcompra INT PRIMARY KEY, cpf TEXT, dtcompra DATE, stcompra TEXT);
      CREATE TABLE agenda (idagenda INT PRIMARY KEY, dtagenda DATE, tpagenda TEXT, stagenda TEXT);
      CREATE TABLE voucher (idvoucher INT PRIMARY KEY, idcompra INT REFERENCES compra, idagenda INT REFERENCES agenda,
        stusado TEXT DEFAULT 'n', stvoucher TEXT DEFAULT 'ativo', flreagendado CHAR(1) DEFAULT 'n',
        dtinicio_validade DATE, dtvalidade DATE, parque_operacional TEXT, dtuso DATE, hruso TIME);
      CREATE TABLE online_capacity_reservations (idcompra INT PRIMARY KEY, delivery_hold BOOLEAN DEFAULT false);
      CREATE TABLE operacao_dias (parque TEXT, data DATE, estado TEXT, PRIMARY KEY (parque,data));
    `);
    today = (await pool.query("SELECT to_char((NOW() AT TIME ZONE 'America/Sao_Paulo')::date,'YYYY-MM-DD') AS today")).rows[0].today;
  });
  afterAll(async () => {
    try { await pool?.end(); if (created) await admin.query(`DROP SCHEMA ${schema} CASCADE`); }
    finally { await admin?.end(); vi.unstubAllEnvs(); }
  });
  beforeEach(async () => {
    vi.stubEnv("OPERATIONAL_PARK_ID", "rincao"); resetVoucherLifecycleSchemaForTests();
    await pool.query("TRUNCATE voucher, compra, agenda, operacao_dias, online_capacity_reservations CASCADE");
    await pool.query(`INSERT INTO compra VALUES (1,'52998224725',$1::date-10,'conc');
      `, [today]);
    await pool.query("INSERT INTO agenda VALUES (1,$1::date-5,'padra','abe'),(2,$1,'promo','abe')", [today]);
    await pool.query(`INSERT INTO voucher (idvoucher,idcompra,idagenda,dtinicio_validade,dtvalidade,parque_operacional)
      VALUES (1,1,1,$1::date-5,$1,'rincao'), (2,1,1,$1::date-5,$1::date-1,'rincao'),(3,1,1,NULL,$1::date-1,NULL)`, [today]);
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

  async function validate() {
    const client = await pool.connect();
    try { await client.query("BEGIN"); await markVoucherUsed(client, 1, today, "12:00:00"); await client.query("COMMIT"); }
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
    const results = await Promise.allSettled([validate(), validate()]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.find((result) => result.status === "rejected")).toMatchObject({ reason: { code: "voucher_already_used" } });
  });
  it.each(["closed", "no_agenda", "school_only", "closed_agenda"])("rejects day use %s", async (state) => {
    if (state === "closed") await pool.query("INSERT INTO operacao_dias VALUES ('rincao',$1,'closed')", [today]);
    if (state === "no_agenda") await pool.query("DELETE FROM agenda WHERE idagenda=2");
    if (state === "school_only") await pool.query("UPDATE agenda SET tpagenda='escol' WHERE idagenda=2");
    if (state === "closed_agenda") await pool.query("UPDATE agenda SET stagenda='fec' WHERE idagenda=2");
    await expect(validate()).rejects.toMatchObject({ code: "voucher_day_closed" });
    expect((await pool.query("SELECT stusado FROM voucher WHERE idvoucher=1")).rows[0].stusado).toBe("n");
  });
});
