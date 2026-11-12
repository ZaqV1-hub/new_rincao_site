import { randomBytes } from "node:crypto";
import { Pool } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { loadOperationalDayOffer } from "@/lib/operational-day-offer";
import type { PurchaseAgendaDetail } from "@/lib/purchase-contracts";
const mock = vi.hoisted(() => ({ pool: null as Pool | null }));
vi.mock("@/lib/ingresso-db", () => ({ getIngressoSistemaDbPool: () => mock.pool }));
const connectionString = process.env.PANEL_TEST_DATABASE_URL;
if (connectionString) {
  const url = new URL(connectionString);
  if (!["postgres:", "postgresql:"].includes(url.protocol) || url.hostname !== "127.0.0.1" ||
      url.pathname !== "/chargeback_test_painel" || url.search || url.hash) {
    throw new Error("PANEL_TEST_DATABASE_URL must target the authorized local scratch database without URL options");
  }
}
const agenda: Pick<PurchaseAgendaDetail, "id" | "date" | "priceTable"> = {
  id: 12, date: "2099-01-31", priceTable: { id: 7, name: "Dia", normal: "110.00", child: "80.00", gateNormal: "120.00", gateChild: "90.00" },
};

describe.skipIf(!connectionString)("operational offer with PostgreSQL", () => {
  const schema = `operational_offer_it_${randomBytes(8).toString("hex")}`;
  let admin: Pool;
  let pool: Pool;
  let created = false;
  beforeAll(async () => {
    admin = new Pool({ connectionString, connectionTimeoutMillis: 2000 });
    await admin.query(`CREATE SCHEMA ${schema}`); created = true;
    pool = new Pool({ connectionString, options: `-c search_path=${schema}`, connectionTimeoutMillis: 2000 });
    mock.pool = pool;
    await pool.query(`
      CREATE TABLE operacao_dias (parque TEXT, data DATE, day_use_agenda_id INTEGER, tabela_preco_id INTEGER,
        validade TEXT, tipos_ingresso JSONB, estado TEXT, PRIMARY KEY (parque,data));
      CREATE TABLE servicos_adicionais (id BIGINT PRIMARY KEY, parque TEXT, nome TEXT, descricao TEXT,
        preco_site NUMERIC(12,2), preco_bilheteria NUMERIC(12,2), ativo BOOLEAN);
      CREATE TABLE servico_datas (parque TEXT, data DATE, servico_id BIGINT, PRIMARY KEY (parque,data,servico_id));
    `);
  });
  afterAll(async () => {
    try { await pool?.end(); if (created) await admin.query(`DROP SCHEMA ${schema} CASCADE`); }
    finally { await admin?.end(); }
  });
  beforeEach(async () => {
    vi.stubEnv("OPERATIONAL_PARK_ID", "rincao");
    await pool.query(`TRUNCATE operacao_dias,servicos_adicionais,servico_datas;
      INSERT INTO operacao_dias VALUES ('rincao','2099-01-31',12,7,'7_days','["norma","isent"]','open'),
        ('estancia','2099-01-31',12,7,'day','["infan"]','open');
      INSERT INTO servicos_adicionais VALUES
        (1,'rincao','Armário','Guarde seus pertences',12.50,15,TRUE),
        (2,'rincao','Inativo','Não oferecer',20,20,FALSE),
        (3,'rincao','Só bilheteria','Não oferecer online',NULL,20,TRUE),
        (4,'rincao','Gratuito','Serviço sem cobrança',0,0,TRUE),
        (5,'estancia','Outro parque','Exclusivo Estância',15,20,TRUE),
        (6,'rincao','Sem atribuição','Não oferecer nesta data',30,35,TRUE),
        (7,'rincao','Outra data','Não oferecer nesta data',40,45,TRUE);
      INSERT INTO servico_datas VALUES ('rincao','2099-01-31',1),('rincao','2099-01-31',2),('rincao','2099-01-31',3),
        ('rincao','2099-01-31',4),('estancia','2099-01-31',5),('rincao','2099-02-01',7);
    `);
  });
  afterEach(() => vi.unstubAllEnvs());
  it("offers only enabled entries and active assigned services with a non-null site price", async () => {
    const offer = await loadOperationalDayOffer(agenda);
    expect(offer.products.map(({ id }) => id)).toEqual(["ingresso-adulto", "ingresso-isento", "servico:1", "servico:4"]);
    expect(offer.products.at(-1)?.sitePrice).toBe("0.00");
    expect(offer.validity).toEqual({ validFrom: "2099-01-31", validUntil: "2099-02-06" });
    vi.stubEnv("OPERATIONAL_PARK_ID", "estancia");
    expect((await loadOperationalDayOffer(agenda)).products.map(({ id }) => id)).toEqual(["ingresso-crianca", "servico:5"]);
  });
  it("preserves an empty allowed-ticket array and legacy dates without using date-unassigned services", async () => {
    await pool.query("UPDATE operacao_dias SET tipos_ingresso='[]' WHERE parque='rincao'");
    expect((await loadOperationalDayOffer(agenda)).products.map(({ type }) => type)).toEqual(["addon", "addon"]);
    await pool.query("DELETE FROM operacao_dias WHERE parque='rincao'");
    const legacy = await loadOperationalDayOffer(agenda);
    expect(legacy.products.map(({ type }) => type)).toEqual(["passport", "passport", "passport"]);
    expect(legacy.validity).toBeNull();
  });
  it("locks service prices until the purchase transaction completes", async () => {
    const purchase = await pool.connect();
    const editor = await pool.connect();
    try {
      await purchase.query("BEGIN");
      expect((await loadOperationalDayOffer(agenda, purchase)).products.find(({ id }) => id === "servico:1")?.sitePrice).toBe("12.50");
      await editor.query("SET lock_timeout='100ms'");
      await expect(editor.query("UPDATE servicos_adicionais SET preco_site=19 WHERE id=1")).rejects.toMatchObject({ code: "55P03" });
      await purchase.query("COMMIT");
      await editor.query("UPDATE servicos_adicionais SET preco_site=19 WHERE id=1");
      expect((await loadOperationalDayOffer(agenda)).products.find(({ id }) => id === "servico:1")?.sitePrice).toBe("19.00");
    } finally {
      await purchase.query("ROLLBACK"); await editor.query("RESET lock_timeout");
      purchase.release(); editor.release();
    }
  });
});
