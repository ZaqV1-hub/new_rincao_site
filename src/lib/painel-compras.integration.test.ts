import { randomBytes } from "node:crypto";
import { Pool } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getPainelPurchaseDetail } from "./painel-compras";

const state = vi.hoisted(() => ({ pool: null as Pool | null, afterPurchaseRead: null as (() => Promise<void>) | null }));
vi.mock("@/lib/ingresso-db", () => ({
  getIngressoSistemaDbPool: () => ({
    connect: async () => {
      const client = await state.pool!.connect();
      return {
        query: async (sql: string, values?: unknown[]) => {
          const result = await client.query(sql, values);
          if (sql.includes("LEFT JOIN LATERAL") && state.afterPurchaseRead) {
            const hook = state.afterPurchaseRead; state.afterPurchaseRead = null; await hook();
          }
          return result;
        },
        release: () => client.release(),
      };
    },
  }),
}));
vi.mock("@/lib/cielo-ecommerce", () => ({ getNativeCieloCheckoutStatus: vi.fn(), isCieloEcommerceConfigured: () => false }));
vi.mock("@/lib/payment-reconciliation", () => ({ normalizePaymentReconciliationPayload: vi.fn() }));

const connectionString = process.env.PANEL_TEST_DATABASE_URL;
if (connectionString) {
  const url = new URL(connectionString);
  if (!["postgres:", "postgresql:"].includes(url.protocol) || url.hostname !== "127.0.0.1" || url.pathname !== "/chargeback_test_painel" || url.search || url.hash) {
    throw new Error("PANEL_TEST_DATABASE_URL must target the local chargeback_test_painel scratch database without options");
  }
}

describe.skipIf(!connectionString)("purchase detail PostgreSQL", () => {
  const schema = `purchase_detail_it_${randomBytes(8).toString("hex")}`;
  let admin: Pool;
  let pool: Pool;
  let created = false;
  beforeAll(async () => {
    admin = new Pool({ connectionString, connectionTimeoutMillis: 2000 });
    await admin.query(`CREATE SCHEMA ${schema}`); created = true;
    pool = new Pool({ connectionString, options: `-c search_path=${schema}`, connectionTimeoutMillis: 2000, max: 3 });
    state.pool = pool;
    await pool.query(`
      CREATE TABLE compra (idcompra BIGINT PRIMARY KEY,dtcompra DATE,hrcompra TIME,tpcompra TEXT,stcompra TEXT,formapag TEXT,
        vltotcompra NUMERIC,dtpagamento DATE,hrpagamento TIME,cpf TEXT,codindica TEXT,origem_checkout TEXT);
      CREATE TABLE usuario (cpf TEXT PRIMARY KEY,nmusuario TEXT);
      CREATE TABLE agenda (idagenda INT PRIMARY KEY,dtagenda DATE);
      CREATE TABLE clientes (idcliente INT PRIMARY KEY,nome TEXT);
      CREATE TABLE caixa_periodos (id INT PRIMARY KEY,local_nome TEXT);
      CREATE TABLE pagpagseguro (idpagseguro BIGINT PRIMARY KEY,idcompra BIGINT,paymentmethodtype TEXT,status TEXT,"cancellationSource" TEXT);
      CREATE TABLE voucher (idvoucher BIGINT PRIMARY KEY,idcompra BIGINT,numvoucher TEXT,tpvoucher TEXT,descricao TEXT,idagenda INT,
        idescola INT,nomealuno TEXT,turma TEXT,periodo TEXT,vlunicompra NUMERIC,stusado TEXT,dtuso DATE,hruso TIME,
        servico_id BIGINT,dtinicio_validade DATE,dtvalidade DATE,parque_operacional TEXT,validacao_periodo_id INT,
        validado_em TIMESTAMPTZ,validado_por_nome TEXT);
      CREATE TABLE compra_pagamentos (id BIGINT PRIMARY KEY,idcompra BIGINT,forma_pagamento CHAR(10),valor NUMERIC,periodo_id INT,recebido_em TIMESTAMPTZ);
      CREATE TABLE edicoes_log (id BIGINT PRIMARY KEY,compra_id BIGINT,created_at TIMESTAMPTZ,origem TEXT,acao TEXT,
        descricao TEXT,motivo TEXT,usuario_nome TEXT,detalhes_json TEXT);
    `);
  });
  afterAll(async () => { try { await pool?.end(); if (created) await admin.query(`DROP SCHEMA ${schema} CASCADE`); } finally { await admin?.end(); } });
  afterEach(() => { state.afterPurchaseRead = null; vi.unstubAllEnvs(); });
  beforeEach(async () => {
    vi.stubEnv("OPERATIONAL_PARK_ID", "rincao");
    await pool.query(`TRUNCATE edicoes_log,compra_pagamentos,voucher,pagpagseguro,caixa_periodos,clientes,agenda,usuario,compra;
      INSERT INTO compra VALUES (1,'2099-11-01','12:00','ponli','conc','pgseg',25.10,'2099-11-02','14:00','529.982.247-25',NULL,'site');
      INSERT INTO usuario VALUES ('529.982.247-25','Cliente');
      INSERT INTO agenda VALUES (10,'2099-11-10');
      INSERT INTO clientes VALUES (20,'Escola');
      INSERT INTO caixa_periodos VALUES (30,'Portaria');
      INSERT INTO voucher (idvoucher,idcompra,numvoucher,tpvoucher,idagenda,idescola,vlunicompra,stusado,dtvalidade)
        VALUES (100,1,'A100','norma',10,NULL,25.10,'n','2100-05-01');
      INSERT INTO pagpagseguro VALUES (1,1,'1','3',NULL),(2,1,'1','3',NULL);`);
  });

  it("preserves legacy display and exposes raw identities without inventing validity start or online cash receipts", async () => {
    const detail = await getPainelPurchaseDetail(1);
    expect(detail).toMatchObject({ purchaseId: 1, purchaseDate: "01/11/2099", totalValue: "25,10", gatewayPaymentId: "2", vouchers: [{ voucherId: 100 }] });
    expect(detail.operational).toEqual({ park: "rincao", purchasedOn: "2099-11-01", totalCents: 2510, origin: "site", customerCpf: "52998224725",
      vouchers: [{ purchaseId: 1,voucherId: 100,agendaId: 10,schoolId: null,serviceId: null,visitDate: "2099-11-10",
        validFrom: null,validUntil: "2100-05-01",validityMode: "legacy",unitAmountCents: 2510,validation: null }], payments: [], history: [] });
  });
  it("reads operational visit dates, services and validation cash/actor separately from the legacy formatted DTO", async () => {
    await pool.query(`UPDATE voucher SET tpvoucher='espec',servico_id=5,dtinicio_validade='2099-11-12',dtvalidade='2099-11-18',parque_operacional='rincao',
      stusado='s',dtuso='2099-11-15',hruso='10:20:30',validacao_periodo_id=30,validado_em='2099-11-15T13:20:30Z',validado_por_nome='Operador';`);
    const detail = await getPainelPurchaseDetail(1);
    expect(detail.vouchers[0].visitDate).toBe("10/11/2099");
    expect(detail.operational.vouchers[0]).toMatchObject({ serviceId: 5,visitDate: "2099-11-12",validFrom: "2099-11-12",validUntil: "2099-11-18",validityMode: "operational",
      validation: { periodId: 30,locationName: "Portaria",validatedAt: "2099-11-15T13:20:30.000Z",usedDate: "2099-11-15",usedTime: "10:20:30",actorName: "Operador" } });
  });
  it("retains legacy admission time without inferring a cash session", async () => {
    await pool.query("UPDATE voucher SET stusado='s',dtuso='2099-11-11',hruso='09:15'");
    expect((await getPainelPurchaseDetail(1)).operational.vouchers[0].validation).toEqual({ periodId: null,locationName: null,validatedAt: null,usedDate: "2099-11-11",usedTime: "09:15:00",actorName: null });
  });
  it("normalizes padded CHAR payment methods and returns only actual split payments without inventing receipt times", async () => {
    await pool.query(`INSERT INTO compra_pagamentos VALUES (1,1,'dinheiro',10.10,30,'2099-11-02T14:00:00Z'),(2,1,'pix',15,NULL,NULL),(3,2,'pix',999,NULL,NULL);`);
    expect((await pool.query("SELECT forma_pagamento FROM compra_pagamentos WHERE id=2")).rows[0].forma_pagamento).toBe("pix       ");
    expect((await getPainelPurchaseDetail(1)).operational.payments).toEqual([
      { id: 1,method: "dinheiro",amountCents: 1010,periodId: 30,receivedAt: "2099-11-02T14:00:00.000Z" },
      { id: 2,method: "pix",amountCents: 1500,periodId: null,receivedAt: null },
    ]);
  });
  it("shows a WhatsApp request without treating it as delivery or exposing its destination", async () => {
    await pool.query(`INSERT INTO edicoes_log VALUES (8,1,NOW(),'voucher','whatsapp_request','private destination 11987654321','Destino conferido pelo operador','Ana','{"phone":"11987654321"}');`);
    const history = (await getPainelPurchaseDetail(1)).operational.history;
    expect(history).toMatchObject([{ action: "whatsapp_request", description: "Envio de vouchers solicitado", reason: "Destino conferido pelo operador" }]);
    expect(JSON.stringify(history)).not.toMatch(/11987654321|entregue/);
  });
  it("projects whitelisted history without raw descriptions, JSON, telephone or CPF, keeping dates and normal amounts", async () => {
    await pool.query(`INSERT INTO edicoes_log VALUES
      (1,1,'2099-11-02T14:00:00Z','compra','editar','secret-token; telefone 11987654321','Chuva em 12/11/2099; ajuste R$ 10,25; contato +55 (11) 98765-4321','Ana (529.982.247-25)','{"phone":"11911112222","token":"secret-json"}'),
      (2,1,'2099-11-02T14:00:00Z','unknown','editar','secret-unknown','secret-unknown','secret',NULL),
      (3,2,'2099-11-02T14:00:00Z','compra','editar','outro','outro','outro',NULL);`);
    const history = (await getPainelPurchaseDetail(1)).operational.history;
    expect(history).toEqual([{ id: 1,occurredAt: "2099-11-02T14:00:00.000Z",action: "editar",description: "Compra atualizada",
      reason: "Chuva em 12/11/2099; ajuste R$ 10,25; contato [dado pessoal omitido]",actorName: "Ana ([dado pessoal omitido])" }]);
    expect(JSON.stringify(history)).not.toMatch(/secret|11987654321|11911112222|529\.982/);
  });
  it("rejects the whole purchase when any voucher has a different explicit park", async () => {
    await pool.query(`INSERT INTO voucher (idvoucher,idcompra,tpvoucher,idagenda,vlunicompra,parque_operacional) VALUES (101,1,'norma',10,0,'estancia');`);
    await expect(getPainelPurchaseDetail(1)).rejects.toMatchObject({ code: "purchase_not_found", status: 404 });
  });
  it("supports another configured park while retaining the legacy-null policy", async () => {
    vi.stubEnv("OPERATIONAL_PARK_ID", "estancia");
    expect((await getPainelPurchaseDetail(1)).operational.park).toBe("estancia");
    await pool.query("UPDATE voucher SET parque_operacional='estancia'");
    expect((await getPainelPurchaseDetail(1)).operational.park).toBe("estancia");
  });
  it.each([null, "-1", "1.005", "90071992547409.92", "NaN"])("rejects invalid purchase total %s", async (amount) => {
    await pool.query("UPDATE compra SET vltotcompra=$1", [amount]);
    await expect(getPainelPurchaseDetail(1)).rejects.toMatchObject({ code: "invalid_purchase_data" });
  });
  it("rejects invalid item and payment amounts and releases the transaction after errors", async () => {
    await pool.query("UPDATE voucher SET vlunicompra=1.001");
    await expect(getPainelPurchaseDetail(1)).rejects.toMatchObject({ code: "invalid_purchase_data" });
    await pool.query("UPDATE voucher SET vlunicompra=25.10; INSERT INTO compra_pagamentos VALUES (1,1,'pix',-1,NULL,NULL)");
    await expect(getPainelPurchaseDetail(1)).rejects.toMatchObject({ code: "invalid_purchase_data" });
    await pool.query("UPDATE compra_pagamentos SET valor=0");
    expect((await getPainelPurchaseDetail(1)).operational.payments[0].amountCents).toBe(0);
  });
  it("does not round unsafe service identifiers", async () => {
    await pool.query("UPDATE voucher SET servico_id=9007199254740992");
    await expect(getPainelPurchaseDetail(1)).rejects.toMatchObject({ code: "invalid_purchase_data" });
  });
  it("returns not found and leaves subsequent reads usable", async () => {
    await expect(getPainelPurchaseDetail(99)).rejects.toMatchObject({ code: "purchase_not_found" });
    expect((await getPainelPurchaseDetail(1)).operational.totalCents).toBe(2510);
  });
  it("keeps one repeatable-read snapshot if vouchers, payments, history and purchase change after its first read", async () => {
    state.afterPurchaseRead = async () => {
      await pool.query(`BEGIN; UPDATE compra SET vltotcompra=99; UPDATE voucher SET vlunicompra=99,dtvalidade='2101-01-01';
        INSERT INTO compra_pagamentos VALUES (1,1,'pix',99,NULL,NULL);
        INSERT INTO edicoes_log VALUES (1,1,NOW(),'compra','editar','update','update','Op',NULL); COMMIT;`);
    };
    const first = await getPainelPurchaseDetail(1);
    expect(first.operational).toMatchObject({ totalCents: 2510,payments: [],history: [],vouchers: [{ unitAmountCents: 2510,validUntil: "2100-05-01" }] });
    expect((await getPainelPurchaseDetail(1)).operational).toMatchObject({ totalCents: 9900,payments: [{ amountCents: 9900 }],history: [{ action: "editar" }] });
  });
});
