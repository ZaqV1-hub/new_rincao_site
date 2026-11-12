import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool, type PoolClient } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createOnlinePurchase } from "@/lib/purchase-repository";
import { beginOnlinePaymentAttempt, getOnlineCapacityOccupied, lockOnlinePurchaseCapacity, assertOnlineCapacityReleased } from "@/lib/online-capacity";
import { applyPaymentReconciliationRecord } from "@/lib/payment-reconciliation-writer";
import { normalizePaymentReconciliationPayload } from "@/lib/payment-reconciliation-payload";
import { lockOperationalDay } from "@/lib/operational-day";

const mock = vi.hoisted(() => ({ pool: null as Pool | null }));
vi.mock("@/lib/ingresso-db", () => ({ getIngressoSistemaDbPool: () => mock.pool }));
const connectionString = process.env.PANEL_TEST_DATABASE_URL;
if (connectionString) {
  const url = new URL(connectionString);
  if (!["postgres:", "postgresql:"].includes(url.protocol) || url.hostname !== "127.0.0.1" ||
      url.pathname !== "/chargeback_test_painel" || url.search || url.hash) {
    throw new Error("PANEL_TEST_DATABASE_URL must target chargeback_test_painel on 127.0.0.1 without URL options");
  }
}
const date = "2099-07-20";
const adult = { lineItems: [{ productId: "ingresso-adulto", quantity: 1 }] };

describe.skipIf(!connectionString)("online capacity with PostgreSQL", () => {
  const schema = `online_capacity_it_${randomBytes(8).toString("hex")}`;
  let admin: Pool;
  let pool: Pool;
  let created = false;
  async function transaction<T>(run: (client: PoolClient) => Promise<T>) {
    const client = await pool.connect();
    try { await client.query("BEGIN"); const result = await run(client); await client.query("COMMIT"); return result; }
    catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  }
  async function reconcile(purchaseId: number, status: number, amount = "100.00", installments = 1) {
    const record = normalizePaymentReconciliationPayload({ dados: { code: `payment-${purchaseId}`, reference: String(purchaseId), status,
      grossAmount: amount, netAmount: amount, installmentCount: installments } }, purchaseId);
    return transaction((client) => applyPaymentReconciliationRecord(client, record));
  }
  beforeAll(async () => {
    admin = new Pool({ connectionString, connectionTimeoutMillis: 2000 });
    await admin.query(`CREATE SCHEMA ${schema}`); created = true;
    pool = new Pool({ connectionString, options: `-c search_path=${schema}`, connectionTimeoutMillis: 2000 });
    mock.pool = pool;
    await pool.query(`
      CREATE TABLE tabpreco (idtabpreco INTEGER PRIMARY KEY, nmtabpreco TEXT, sttabpreco TEXT,
        vlnormal NUMERIC, vlinfant NUMERIC, vlnormalbil NUMERIC, vlinfantbil NUMERIC);
      CREATE TABLE informacao (idinformacao INTEGER PRIMARY KEY, texto TEXT);
      CREATE TABLE agenda (idagenda INTEGER PRIMARY KEY, dtagenda DATE, tpagenda TEXT, stagenda TEXT,
        nmpromocional TEXT, dspromocional TEXT, idtabpreco INTEGER REFERENCES tabpreco, idinformacao INTEGER REFERENCES informacao);
      CREATE TABLE convenio (idconvenio INTEGER PRIMARY KEY, nmconvenio TEXT, stconvenio TEXT, idtabpreco INTEGER);
      CREATE TABLE conveniado (cpf TEXT, idconvenio INTEGER, stconveniado TEXT, qtcompradia INTEGER);
      CREATE TABLE socio (cpf TEXT, stsocio TEXT, qtcompradia INTEGER, idsociocateg INTEGER);
      CREATE TABLE sociocateg (idsociocateg INTEGER, idtabpreco INTEGER);
      CREATE TABLE compra (idcompra SERIAL PRIMARY KEY, cpf TEXT, tpcompra TEXT, dtcompra DATE, hrcompra TIME, formapag TEXT,
        vltotcompra NUMERIC, vltotdesc NUMERIC, codindica TEXT, stcompra TEXT, flenvio TEXT, origem_checkout TEXT,
        dtpagamento DATE, hrpagamento TIME, checkout_session_id TEXT, checkout_school_site_context JSONB);
      CREATE TABLE voucher (idvoucher SERIAL PRIMARY KEY, idcompra INTEGER REFERENCES compra, numvoucher TEXT UNIQUE, idagenda INTEGER REFERENCES agenda,
        tpvoucher TEXT, vlunicompra NUMERIC, vldesc NUMERIC, codindica TEXT, stusado TEXT, fldesconto TEXT, dtvalidade DATE, descricao TEXT,
        stvoucher TEXT, tpparticipante TEXT);
      CREATE TABLE pagpagseguro (idcompra INTEGER PRIMARY KEY, idpagseguro TEXT, date TIMESTAMPTZ, reference TEXT, status INTEGER,
        "cancellationSource" TEXT, "lastEventDate" TIMESTAMPTZ, paymentmethodtype INTEGER, "paymentMethodCode" INTEGER,
        "grossAmount" NUMERIC, "discountAmount" NUMERIC, "feeAmount" NUMERIC, "netAmount" NUMERIC, "extraAmount" NUMERIC,
        "installmentCount" INTEGER, "senderEmail" TEXT, "senderName" TEXT, "senderPhoneAreaCode" TEXT, "senderPhoneNumber" TEXT,
        "shippingType" INTEGER, "shippingCost" NUMERIC, "shippingAdressStreet" TEXT, "shippingAdressNumber" TEXT,
        "shippingAdressDistrict" TEXT, "shippingAdressCity" TEXT, "shippingAdressState" TEXT, "shippingAdressCountry" TEXT,
        "shippingAdressPostalCode" TEXT, "xmlRequisicao" TEXT);
      CREATE TABLE checkout_installment_quotes (idcompra INTEGER, base_amount NUMERIC, charged_amount NUMERIC, installments INTEGER);
      CREATE TABLE edicoes_log (id SERIAL PRIMARY KEY, origem VARCHAR(30), acao VARCHAR(30), compra_id INTEGER,
        movimentacao_id INTEGER, movimentacao_tipo VARCHAR(20), periodo_id INTEGER, folha_id INTEGER,
        descricao TEXT, motivo TEXT, usuario_nome VARCHAR(255), detalhes_json TEXT, created_at TIMESTAMPTZ DEFAULT NOW());
    `);
    for (const filename of ["2026-11-12-operational-panel-foundation.sql", "2026-11-12-operational-voucher-validity.sql", "2026-11-12-online-capacity.sql"]) {
      await pool.query(await readFile(new URL(`../../docs/sql/${filename}`, import.meta.url), "utf8"));
    }
  });
  afterAll(async () => {
    try { await pool?.end(); if (created) await admin.query(`DROP SCHEMA ${schema} CASCADE`); }
    finally { await admin?.end(); }
  });
  beforeEach(async () => {
    vi.stubEnv("OPERATIONAL_PARK_ID", "rincao");
    vi.stubEnv("SCHOOL_ADMISSION_PROVIDER", "legacy");
    await pool.query(`TRUNCATE online_capacity_reservations, voucher, compra, pagpagseguro, checkout_installment_quotes,
      operacao_dias, servico_datas, agenda, tabpreco, edicoes_log RESTART IDENTITY;
      INSERT INTO tabpreco VALUES (1,'Tarifa','ati',100,70,120,80),(2,'Nova tarifa','ati',200,150,220,170);
      INSERT INTO agenda (idagenda,dtagenda,tpagenda,stagenda,idtabpreco) VALUES (1,'${date}','padra','abe',1);
      INSERT INTO operacao_dias (parque,data,tabela_preco_id,day_use_agenda_id,validade,limite_online)
      VALUES ('rincao','${date}',1,1,'7_days',1);`);
  });
  afterEach(() => vi.unstubAllEnvs());

  it("serializes two real purchases competing for the last seat without orphans", async () => {
    const results = await Promise.allSettled([createOnlinePurchase("11111111111", 1, adult), createOnlinePurchase("22222222222", 1, adult)]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.find((result) => result.status === "rejected")).toMatchObject({ reason: { code: "online_capacity_exceeded" } });
    for (const table of ["compra", "voucher", "online_capacity_reservations"]) expect((await pool.query(`SELECT COUNT(*)::int AS count FROM ${table}`)).rows[0].count).toBe(1);
    expect(await getOnlineCapacityOccupied(pool, "rincao", date)).toBe(1);
  });

  it("counts exempt tickets, stores a civil validity snapshot, and rolls back an unavailable type", async () => {
    await pool.query("UPDATE operacao_dias SET limite_online=2");
    const purchase = await createOnlinePurchase("11111111111", 1, { normal: 1, child: 0, discountedNormal: 0, discountedChild: 0, exempt: 1 });
    expect(await getOnlineCapacityOccupied(pool, "rincao", date)).toBe(2);
    expect((await pool.query('SELECT dtinicio_validade::text,dtvalidade::text,parque_operacional FROM voucher WHERE idcompra=$1', [purchase.purchaseId])).rows)
      .toEqual(Array(2).fill({ dtinicio_validade: date, dtvalidade: "2099-07-26", parque_operacional: "rincao" }));
    await pool.query(`UPDATE operacao_dias SET tipos_ingresso='["norma"]',limite_online=NULL`);
    await expect(createOnlinePurchase("22222222222", 1, { lineItems: [{ productId: "ingresso-adulto", quantity: 1 }, { productId: "ingresso-isento", quantity: 1 }] })).rejects.toMatchObject({ code: "ticket_type_unavailable" });
    expect((await pool.query("SELECT COUNT(*)::int AS count FROM compra")).rows[0].count).toBe(1);
  });

  it("re-reads updated agenda price under the day lock and retains already sold totals", async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN"); await lockOperationalDay(client, "rincao", date);
      await client.query("UPDATE agenda SET idtabpreco=2; UPDATE operacao_dias SET tabela_preco_id=2");
      const pending = createOnlinePurchase("11111111111", 1, adult);
      await client.query("COMMIT");
      const purchase = await pending;
      expect(purchase.totalValue).toBe("200.00");
      await pool.query("UPDATE agenda SET idtabpreco=1; UPDATE operacao_dias SET tabela_preco_id=1,validade='day'");
      expect((await pool.query("SELECT vltotcompra::text FROM compra WHERE idcompra=$1", [purchase.purchaseId])).rows[0].vltotcompra).toBe("200.00");
      expect((await pool.query("SELECT dtvalidade::text FROM voucher WHERE idcompra=$1", [purchase.purchaseId])).rows[0].dtvalidade).toBe("2099-07-26");
    } finally { client.release(); }
  });

  it("releases abandoned/cancelled reservations while uncertain attempts and paid used tickets stay counted", async () => {
    const purchase = await createOnlinePurchase("11111111111", 1, adult);
    await pool.query("UPDATE online_capacity_reservations SET expires_at=NOW()-INTERVAL '1 second'");
    expect(await getOnlineCapacityOccupied(pool, "rincao", date)).toBe(0);
    const client = await pool.connect();
    try { await expect(beginOnlinePaymentAttempt(client, purchase.purchaseId)).rejects.toMatchObject({ code: "online_capacity_expired" }); }
    finally { client.release(); }
    await pool.query("UPDATE online_capacity_reservations SET attempt_started_at=NOW()");
    expect(await getOnlineCapacityOccupied(pool, "rincao", date)).toBe(1);
    await reconcile(purchase.purchaseId, 3);
    await pool.query("UPDATE voucher SET stusado='s',stvoucher='vencido'");
    expect(await getOnlineCapacityOccupied(pool, "rincao", date)).toBe(1);
    await reconcile(purchase.purchaseId, 7);
    expect(await getOnlineCapacityOccupied(pool, "rincao", date)).toBe(0);
  });

  it("records late quoted payment once and holds delivery without overselling or hiding financial truth", async () => {
    const late = await createOnlinePurchase("11111111111", 1, adult);
    await pool.query("UPDATE online_capacity_reservations SET expires_at=NOW()-INTERVAL '1 second'");
    const current = await createOnlinePurchase("22222222222", 1, adult);
    await pool.query("INSERT INTO checkout_installment_quotes VALUES ($1,100,110,3)", [late.purchaseId]);
    const first = await reconcile(late.purchaseId, 3, "110.00", 3);
    expect(first).toMatchObject({ purchaseStatus: "conc", deliveryHold: true });
    await reconcile(late.purchaseId, 3, "110.00", 3);
    expect((await pool.query('SELECT "grossAmount"::text FROM pagpagseguro WHERE idcompra=$1', [late.purchaseId])).rows[0].grossAmount).toBe("110.00");
    expect((await pool.query("SELECT stcompra FROM compra WHERE idcompra=$1", [late.purchaseId])).rows[0].stcompra).toBe("conc");
    expect((await pool.query("SELECT COUNT(*)::int AS count FROM edicoes_log WHERE compra_id=$1", [late.purchaseId])).rows[0].count).toBe(1);
    expect(await getOnlineCapacityOccupied(pool, "rincao", date)).toBe(1);
    await expect(assertOnlineCapacityReleased(pool, late.purchaseId)).rejects.toThrow("online_capacity_delivery_hold");
    await expect(assertOnlineCapacityReleased(pool, current.purchaseId)).resolves.toBeUndefined();
  });

  it("reacquires an expired reservation when free and leaves no residue after a voucher insert fails", async () => {
    const purchase = await createOnlinePurchase("11111111111", 1, adult);
    await pool.query("UPDATE online_capacity_reservations SET expires_at=NOW()-INTERVAL '1 second'");
    expect(await reconcile(purchase.purchaseId, 3)).not.toHaveProperty("deliveryHold");
    await pool.query("UPDATE operacao_dias SET limite_online=NULL; ALTER TABLE voucher ADD CONSTRAINT fail_insert CHECK (idcompra=1)");
    try { await expect(createOnlinePurchase("22222222222", 1, adult)).rejects.toThrow(); }
    finally { await pool.query("ALTER TABLE voucher DROP CONSTRAINT fail_insert"); }
    expect((await pool.query("SELECT COUNT(*)::int AS count FROM compra")).rows[0].count).toBe(1);
    expect((await pool.query("SELECT COUNT(*)::int AS count FROM online_capacity_reservations")).rows[0].count).toBe(1);
  });

  it("keeps school and legacy purchases outside day-use reservations", async () => {
    await pool.query("INSERT INTO compra (tpcompra,stcompra,vltotcompra) VALUES ('ponli','conc',100)");
    await pool.query("INSERT INTO voucher (idcompra,idagenda,tpvoucher) VALUES (1,1,'escol')");
    expect(await getOnlineCapacityOccupied(pool, "rincao", date)).toBe(0);
    expect(await transaction((client) => lockOnlinePurchaseCapacity(client, 1))).toBeNull();
    await pool.query("DELETE FROM operacao_dias");
    const legacy = await createOnlinePurchase("11111111111", 1, adult);
    expect((await pool.query("SELECT dtinicio_validade,parque_operacional FROM voucher WHERE idcompra=$1", [legacy.purchaseId])).rows)
      .toEqual([{ dtinicio_validade: null, parque_operacional: null }]);
    expect((await pool.query("SELECT COUNT(*)::int AS count FROM online_capacity_reservations")).rows[0].count).toBe(0);
  });
});
