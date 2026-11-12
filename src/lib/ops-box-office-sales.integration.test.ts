import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createOperationalBoxOfficeSale } from "./ops-box-office-sales";
import { payPainelBilheteriaReservation } from "./painel-bilheteria";
import { cancelOperationalPurchase, updateOperationalPurchase } from "./ops-purchase-management";
import { closeCashSession, getCashSession, openCashSession } from "./operational-cash-session";
import { getSaoPauloToday, voucherValidityRange } from "./operational-date";
const mock = vi.hoisted(() => ({ pool: null as Pool | null, send: vi.fn(), email: vi.fn(), sync: vi.fn() }));
vi.mock("@/lib/ingresso-db", () => ({ getIngressoSistemaDbPool: () => mock.pool, getIngressoDbPool: () => mock.pool, getIngressoSistemaDbDialect: () => "postgres" }));
vi.mock("@/lib/ticket-service", () => ({ processConfirmedPurchaseTickets: mock.send, sendPurchaseTicketsWhatsApp: vi.fn(), syncTicketValidation: mock.sync }));
vi.mock("@/lib/purchase-confirmation-email", () => ({ queuePurchaseConfirmationEmail: mock.email }));
const connectionString = process.env.PANEL_TEST_DATABASE_URL;
if (connectionString) {
  const url = new URL(connectionString);
  if (!["postgres:", "postgresql:"].includes(url.protocol) || url.hostname !== "127.0.0.1" || url.pathname !== "/chargeback_test_painel" || url.search || url.hash) throw new Error("Use only the local scratch database without URL options");
}
const actor = { name: "Operador", cpf: "52998224725" };
const today = getSaoPauloToday();
const input = (periodId: number, key = "sale-test-key") => ({ agendaId: 1, periodId, cpf: "52998224725", idempotencyKey: key, items: [{ type: "norma", quantity: 1 }], payments: [{ method: "dinhe", value: "100.00" }], actor });
describe.skipIf(!connectionString)("cash scoped sales and reservation payments with PostgreSQL", () => {
  const schema = `cash_sales_it_${randomBytes(8).toString("hex")}`;
  let admin: Pool; let pool: Pool; let created = false;
  beforeAll(async () => {
    admin = new Pool({ connectionString, connectionTimeoutMillis: 2000 }); await admin.query(`CREATE SCHEMA ${schema}`); created = true;
    pool = new Pool({ connectionString, options: `-c search_path=${schema} -c statement_timeout=15000 -c lock_timeout=10000`, connectionTimeoutMillis: 2000, max: 8 }); mock.pool = pool;
    await pool.query(`
      CREATE TABLE tabpreco(idtabpreco INTEGER PRIMARY KEY,vlnormalbil NUMERIC(10,2),vlinfantbil NUMERIC(10,2));
      CREATE TABLE agenda(idagenda INTEGER PRIMARY KEY,idtabpreco INTEGER REFERENCES tabpreco,dtagenda DATE,tpagenda TEXT,stagenda TEXT);
      CREATE TABLE agenda_extras(idagenda INTEGER);
      CREATE TABLE descontos(id INTEGER PRIMARY KEY,nome TEXT,tipo_aplicacao TEXT,valor NUMERIC(10,2));
      CREATE TABLE cortesias(id INTEGER PRIMARY KEY,nome TEXT);
      CREATE TABLE compra(idcompra SERIAL PRIMARY KEY,cpf TEXT,tpcompra TEXT,dtcompra DATE,hrcompra TIME,dtpagamento DATE,hrpagamento TIME,formapag TEXT,vltotcompra NUMERIC(10,2),vltotdesc NUMERIC(10,2),stcompra TEXT,flenvio TEXT);
      CREATE TABLE compra_pagamentos(id SERIAL PRIMARY KEY,idcompra INTEGER REFERENCES compra,forma_pagamento CHAR(5),valor NUMERIC(10,2) NOT NULL CHECK(valor>0),created_at TIMESTAMP DEFAULT now());
      CREATE TABLE voucher(idvoucher SERIAL PRIMARY KEY,idcompra INTEGER REFERENCES compra,numvoucher TEXT UNIQUE,idagenda INTEGER REFERENCES agenda,tpvoucher TEXT,vlunicompra NUMERIC(8,2),vldesc NUMERIC(10,2),fldesconto TEXT,dtvalidade DATE,desconto_id INTEGER,descricao TEXT,identificacao VARCHAR(80),autorizado_por_id INTEGER,stusado TEXT,idescola INTEGER,item_id INTEGER,periodo_id INTEGER,closed_at TIMESTAMP,dtuso DATE,hruso TIME);
      CREATE TABLE caixa_periodos(id SERIAL PRIMARY KEY,aberto_em TIMESTAMPTZ NOT NULL DEFAULT now(),fechado_em TIMESTAMPTZ,operador VARCHAR(120),fechamento_auto BOOLEAN NOT NULL DEFAULT false,folha_id INTEGER,created_at TIMESTAMPTZ NOT NULL DEFAULT now());
      CREATE TABLE caixa_fechamentos(id SERIAL PRIMARY KEY,snapshot_json JSONB NOT NULL,totals_dinheiro NUMERIC(12,2) NOT NULL DEFAULT 0,totals_fundo NUMERIC(12,2) NOT NULL DEFAULT 0,totals_geral NUMERIC(12,2) NOT NULL DEFAULT 0,created_at TIMESTAMPTZ NOT NULL DEFAULT now(),periodo_id INTEGER);
      CREATE TABLE movimentacao_caixa(id SERIAL PRIMARY KEY,tipo VARCHAR(10) NOT NULL,responsavel VARCHAR(100) NOT NULL,valor NUMERIC(10,2) NOT NULL CHECK(valor>=0),data_hora TIMESTAMP NOT NULL DEFAULT now(),created_at TIMESTAMPTZ DEFAULT now());
      CREATE TABLE edicoes_log(id SERIAL PRIMARY KEY,origem VARCHAR(30) NOT NULL,acao VARCHAR(30) NOT NULL,compra_id INTEGER,movimentacao_id INTEGER,movimentacao_tipo VARCHAR(20),periodo_id INTEGER,folha_id INTEGER,descricao TEXT NOT NULL,motivo TEXT NOT NULL,usuario_nome VARCHAR(255) CHECK(usuario_nome<>'Audit failure'),detalhes_json TEXT,created_at TIMESTAMPTZ DEFAULT now());
    `);
    for (const migration of ["operational-panel-foundation", "operational-voucher-validity", "operational-service-vouchers", "cash-sessions"]) await pool.query(await readFile(new URL(`../../docs/sql/2026-11-12-${migration}.sql`, import.meta.url), "utf8"));
  });
  beforeEach(async () => {
    vi.clearAllMocks(); vi.stubEnv("OPERATIONAL_PARK_ID", "rincao"); mock.send.mockResolvedValue({ status: "sent" }); mock.email.mockResolvedValue({ status: "queued" });
    await pool.query(`TRUNCATE caixa_operacoes,edicoes_log,movimentacao_caixa,voucher,compra_pagamentos,compra,caixa_fechamentos,caixa_periodos,caixa_locais,servico_datas,servicos_adicionais,operacao_dias,agenda_extras,agenda,tabpreco,descontos,cortesias RESTART IDENTITY CASCADE;
      INSERT INTO tabpreco VALUES (1,100,70); INSERT INTO agenda VALUES (1,1,(now() AT TIME ZONE 'America/Sao_Paulo')::date,'padra','lot');
      INSERT INTO operacao_dias(parque,data,tabela_preco_id,day_use_agenda_id,validade,limite_online) VALUES ('rincao',(now() AT TIME ZONE 'America/Sao_Paulo')::date,1,1,'7_days',0);
      INSERT INTO caixa_locais(parque,nome,tipo) VALUES ('rincao','Portaria','sales'),('rincao','Piscina','sales'),('rincao','Passeios','trips');
      INSERT INTO descontos VALUES (7,'Professor','percentual',50); INSERT INTO cortesias VALUES (3,'Diretoria');
      INSERT INTO servicos_adicionais(parque,nome,preco_site,preco_bilheteria) VALUES ('rincao','Armário',NULL,10),('rincao','Gratuito',NULL,0),('rincao','Não escalado',20,20);
      INSERT INTO servico_datas VALUES ('rincao',(now() AT TIME ZONE 'America/Sao_Paulo')::date,1),('rincao',(now() AT TIME ZONE 'America/Sao_Paulo')::date,2);`);
  });
  afterEach(() => { mock.pool = pool; vi.unstubAllEnvs(); });
  afterAll(async () => { try { await pool?.end(); if (created) await admin.query(`DROP SCHEMA ${schema} CASCADE`); } finally { await admin?.end(); } });
  async function open(locationId = 1) { return openCashSession({ date: today, locationId, openingCashCents: 0, idempotencyKey: `open-${locationId}` }, actor); }
  async function reserve(cpf = actor.cpf) {
    return (await pool.query<{ idcompra: number }>("INSERT INTO compra(cpf,tpcompra,dtcompra,stcompra,formapag,vltotcompra) VALUES ($1,'reser',CURRENT_DATE-10,'conc','N/A',100) RETURNING idcompra", [cpf])).rows[0].idcompra;
  }
  it("records exact net cash/change and service snapshots without applying online capacity", async () => {
    const session = await open();
    const result = await createOperationalBoxOfficeSale({ ...input(session.id), items: [{ type: "norma", quantity: 1, discountId: 7 }], services: [{ serviceId: 1, quantity: 1 }], payments: [{ method: "pix", value: "40" }, { method: "dinhe", value: "30" }] });
    expect(result).toMatchObject({ totalCents: 6000, receivedCents: 7000, changeCents: 1000, netPayments: [{ method: "pix", amountCents: 4000 }, { method: "dinhe", amountCents: 2000 }] });
    expect((await pool.query("SELECT caixa_periodo_id,vltotcompra::text,vltotdesc::text FROM compra")).rows).toEqual([{ caixa_periodo_id: session.id, vltotcompra: "60.00", vltotdesc: "50.00" }]);
    const vouchers = (await pool.query("SELECT tpvoucher,vlunicompra::text,dtinicio_validade::text,dtvalidade::text,parque_operacional,servico_id::text FROM voucher ORDER BY idvoucher")).rows;
    expect(vouchers).toEqual([
      { tpvoucher: "norma", vlunicompra: "50.00", dtinicio_validade: today, dtvalidade: voucherValidityRange(today,"7_days").validUntil, parque_operacional: "rincao", servico_id: null },
      { tpvoucher: "espec", vlunicompra: "10.00", dtinicio_validade: today, dtvalidade: voucherValidityRange(today,"7_days").validUntil, parque_operacional: "rincao", servico_id: "1" },
    ]);
    expect((await getCashSession(session.id)).snapshot.expectedCashCents).toBe(2000);
  });
  it("allows a free gate-only service without fake payment rows, rejects inactive/unassigned services and disabled admission", async () => {
    const session = await open();
    expect(await createOperationalBoxOfficeSale({ ...input(session.id), items: [], services: [{ serviceId: 2, quantity: 1 }], payments: [] })).toMatchObject({ totalCents: 0, netPayments: [] });
    expect((await pool.query("SELECT * FROM compra_pagamentos")).rowCount).toBe(0);
    await expect(createOperationalBoxOfficeSale({ ...input(session.id,"unassigned-service"), items: [], services: [{ serviceId: 3, quantity: 1 }], payments: [{ method: "pix", value: "20" }] })).rejects.toMatchObject({ code: "service_unavailable" });
    await pool.query("UPDATE servicos_adicionais SET ativo=false WHERE id=1; UPDATE operacao_dias SET tipos_ingresso='[\"infan\"]'::jsonb");
    await expect(createOperationalBoxOfficeSale(input(session.id,"disabled-ticket"))).rejects.toMatchObject({ code: "ticket_type_disabled" });
    await expect(createOperationalBoxOfficeSale({ ...input(session.id,"inactive-service"), items: [], services: [{ serviceId: 1, quantity: 1 }] })).rejects.toMatchObject({ code: "service_unavailable" });
  });
  it("keeps payable-unit rounding exact and rejects prices outside voucher precision before insertion", async () => {
    const session = await open();
    await pool.query("UPDATE tabpreco SET vlnormalbil=0.01");
    expect(await createOperationalBoxOfficeSale({ ...input(session.id), items: [{ type: "norma", quantity: 1, discountId: 7 }], payments: [{ method: "pix", value: "0.01" }] })).toMatchObject({ totalCents: 1 });
    await pool.query("UPDATE servicos_adicionais SET preco_bilheteria=1000000 WHERE id=1");
    await expect(createOperationalBoxOfficeSale({ ...input(session.id,"price-overflow"), items: [], services: [{ serviceId: 1, quantity: 1 }], payments: [{ method: "pix", value: "1000000" }] })).rejects.toMatchObject({ code: "box_office_price_out_of_range", status: 409 });
    expect((await pool.query("SELECT * FROM compra")).rowCount).toBe(1);
  });
  it("serializes duplicate sales, replays after closure without delivery, and rejects changed request content", async () => {
    const session = await open(); const payload = input(session.id);
    const [first, second] = await Promise.all([createOperationalBoxOfficeSale(payload), createOperationalBoxOfficeSale(payload)]);
    expect(first).toEqual(second); expect(mock.send).toHaveBeenCalledTimes(1); expect((await pool.query("SELECT * FROM compra")).rowCount).toBe(1);
    await closeCashSession({ periodId: session.id, countedCashCents: 10000, reason: "Fim", idempotencyKey: "close-test" }, actor);
    expect(await createOperationalBoxOfficeSale(payload)).toEqual(first); expect(mock.send).toHaveBeenCalledTimes(1);
    await expect(createOperationalBoxOfficeSale({ ...payload, payments: [{ method: "dinhe", value: "110" }] })).rejects.toMatchObject({ code: "idempotency_conflict" });
    await expect(createOperationalBoxOfficeSale(input(session.id,"new-sale-after-close"))).rejects.toMatchObject({ code: "cash_session_closed" });
  });
  it("keeps two cashier locations separate and rejects trip, previous-date or closed-day sessions", async () => {
    const a = await open(1), b = await open(2), trip = await open(3);
    await Promise.all([createOperationalBoxOfficeSale(input(a.id,"sale-location-a")), createOperationalBoxOfficeSale({ ...input(b.id,"sale-location-b"), payments: [{ method: "pix", value: "100" }] })]);
    expect((await getCashSession(a.id)).snapshot.expectedCashCents).toBe(10000); expect((await getCashSession(b.id)).snapshot.expectedCashCents).toBe(0);
    await expect(createOperationalBoxOfficeSale(input(trip.id,"sale-wrong-type"))).rejects.toMatchObject({ code: "cash_type_mismatch" });
    await pool.query("UPDATE caixa_periodos SET data_operacional=data_operacional-1 WHERE id=$1", [b.id]);
    await expect(createOperationalBoxOfficeSale(input(b.id,"sale-yesterday"))).rejects.toMatchObject({ code: "cash_date_not_today" });
    await pool.query("UPDATE operacao_dias SET estado='closed'");
    await expect(createOperationalBoxOfficeSale(input(a.id,"sale-day-closed"))).rejects.toMatchObject({ code: "day_closed" });
  });
  it("rolls back sale, vouchers, receipts and idempotency together when audit fails", async () => {
    const session = await open(); const payload = input(session.id);
    await expect(createOperationalBoxOfficeSale({ ...payload, actor: { ...actor, name: "Audit failure" } })).rejects.toMatchObject({ code: "23514" });
    for (const table of ["compra", "voucher", "compra_pagamentos"]) expect((await pool.query(`SELECT * FROM ${table}`)).rowCount).toBe(0);
    expect((await pool.query("SELECT * FROM caixa_operacoes WHERE acao='sale'")).rowCount).toBe(0); expect(mock.send).not.toHaveBeenCalled();
    expect(await createOperationalBoxOfficeSale(payload)).toMatchObject({ totalCents: 10000 });
  });
  it("receives a prior reservation exactly once in today's explicit cash session and never deletes receipts", async () => {
    const session = await open(); const purchaseId = await reserve();
    const payload = { purchaseId, periodId: session.id, idempotencyKey: "reservation-pay-one", payments: [{ method: "dinhe", value: "120" }], actor };
    const results = await Promise.allSettled([payPainelBilheteriaReservation(payload), payPainelBilheteriaReservation({ ...payload, idempotencyKey: "reservation-pay-two" })]);
    expect(results.filter((entry) => entry.status === "fulfilled")).toHaveLength(1);
    expect(results.find((entry) => entry.status === "rejected")).toMatchObject({ reason: { code: "reservation_already_paid" } });
    expect((await pool.query("SELECT periodo_id,valor::text,recebido_em IS NOT NULL AS received FROM compra_pagamentos")).rows).toEqual([{ periodo_id: session.id, valor: "100.00", received: true }]);
    expect((await pool.query("SELECT caixa_periodo_id FROM compra")).rows[0].caixa_periodo_id).toBeNull(); expect(mock.email).toHaveBeenCalledTimes(1);
    const winnerIndex = results.findIndex((entry) => entry.status === "fulfilled");
    const winnerPayload = winnerIndex === 0 ? payload : { ...payload, idempotencyKey: "reservation-pay-two" };
    await closeCashSession({ periodId: session.id, countedCashCents: 10000, reason: "Fim", idempotencyKey: "reservation-close" }, actor);
    expect(await payPainelBilheteriaReservation(winnerPayload)).toEqual((results[winnerIndex] as PromiseFulfilledResult<unknown>).value); expect(mock.email).toHaveBeenCalledTimes(1);
  });
  it("requires the stored customer CPF and blocks a receipt already present without rewriting it", async () => {
    const session = await open(); const invalidId = await reserve("11111111111"), paidId = await reserve();
    const pay = (purchaseId: number) => payPainelBilheteriaReservation({ purchaseId, periodId: session.id, idempotencyKey: `reservation-pay-${purchaseId}`, payments: [{ method: "pix", value: "100" }], actor });
    await expect(pay(invalidId)).rejects.toMatchObject({ code: "reservation_invalid_cpf" });
    await pool.query("INSERT INTO compra_pagamentos(idcompra,forma_pagamento,valor,periodo_id,recebido_em) VALUES ($1,'pix',100,$2,now())", [paidId, session.id]);
    const before = (await pool.query("SELECT * FROM compra_pagamentos")).rows;
    await expect(pay(paidId)).rejects.toMatchObject({ code: "reservation_already_paid" });
    expect((await pool.query("SELECT * FROM compra_pagamentos")).rows).toEqual(before);
  });
  it("rejects a foreign-park reservation and accepts genuinely unassigned legacy vouchers", async () => {
    const session = await open(); const foreign = await reserve(), legacy = await reserve();
    await pool.query("INSERT INTO voucher(idcompra,idagenda,tpvoucher,stusado,parque_operacional,dtinicio_validade,dtvalidade) VALUES ($1,1,'norma','n','estancia',CURRENT_DATE,CURRENT_DATE),($2,1,'norma','n',NULL,NULL,NULL)", [foreign,legacy]);
    const pay = (purchaseId: number) => payPainelBilheteriaReservation({ purchaseId, periodId: session.id, idempotencyKey: `park-pay-${purchaseId}`, payments: [{ method: "pix", value: "100" }], actor });
    await expect(pay(foreign)).rejects.toMatchObject({ code: "reservation_park_mismatch", status: 409 });
    expect((await pool.query("SELECT * FROM compra_pagamentos WHERE idcompra=$1", [foreign])).rowCount).toBe(0);
    await expect(pay(legacy)).resolves.toMatchObject({ totalCents: 10000 });
    expect((await pool.query("SELECT parque_operacional FROM voucher WHERE idcompra=$1", [legacy])).rows[0].parque_operacional).toBeNull();
  });
  it.each(["sale-before", "sale-final", "reservation-before", "reservation-final"])("rolls back %s when the database date expires after the lock", async (scenario) => {
    const session = await open(); const purchaseId = await reserve(); let checks = 0;
    const originalConnect = pool.connect.bind(pool);
    mock.pool = new Proxy(pool, { get(target, key) {
      if (key === "connect") return async () => {
        const client = await originalConnect(); const query = client.query.bind(client);
        return new Proxy(client, { get(original, field) {
          if (field === "query") return (sql: string, values?: unknown[]) => {
            if (sql.includes('AS "isCurrentCashDate"') && ++checks === (scenario.endsWith("final") ? 2 : 1)) {
              return query(sql.replace("clock_timestamp()", "(clock_timestamp() + interval '1 day')"), values);
            }
            return query(sql, values);
          };
          const value = Reflect.get(original, field); return typeof value === "function" ? value.bind(original) : value;
        } });
      };
      const value = Reflect.get(target, key); return typeof value === "function" ? value.bind(target) : value;
    } });
    const operation = scenario.startsWith("sale") ? createOperationalBoxOfficeSale(input(session.id)) : payPainelBilheteriaReservation({ purchaseId, periodId: session.id, idempotencyKey: "expired-reservation", payments: [{ method: "pix", value: "100" }], actor });
    await expect(operation).rejects.toMatchObject({ code: "cash_date_not_today", status: 409 });
    expect((await pool.query("SELECT * FROM compra WHERE tpcompra='bilhe'")).rowCount).toBe(0);
    expect((await pool.query("SELECT * FROM compra_pagamentos")).rowCount).toBe(0);
    expect((await pool.query("SELECT * FROM caixa_operacoes WHERE acao IN ('sale','reservation_pay')")).rowCount).toBe(0);
    expect((await pool.query("SELECT dtpagamento FROM compra WHERE idcompra=$1", [purchaseId])).rows[0].dtpagamento).toBeNull();
    expect(mock.send).not.toHaveBeenCalled(); expect(mock.email).not.toHaveBeenCalled();
  });
  it.each(["sale", "payment", "admission"])("blocks legacy update and cancel when linked by %s", async (kind) => {
    const session = await open(); const purchaseId = await reserve();
    if (kind === "sale") await pool.query("UPDATE compra SET caixa_periodo_id=$1 WHERE idcompra=$2", [session.id,purchaseId]);
    if (kind === "payment") await pool.query("INSERT INTO compra_pagamentos(idcompra,forma_pagamento,valor,periodo_id,recebido_em) VALUES ($1,'pix',100,$2,now())", [purchaseId,session.id]);
    if (kind === "admission") await pool.query("INSERT INTO voucher(idcompra,idagenda,tpvoucher,stusado,validacao_periodo_id,validado_em) VALUES ($1,1,'norma','s',$2,now())", [purchaseId,session.id]);
    const before = (await pool.query("SELECT * FROM compra WHERE idcompra=$1", [purchaseId])).rows;
    await expect(cancelOperationalPurchase(purchaseId,"Correção",actor)).rejects.toMatchObject({ code: "purchase_financial_adjustment_required" });
    await expect(updateOperationalPurchase({ purchaseId,purchaseDate:today,reason:"Correção",actor })).rejects.toMatchObject({ code: "purchase_financial_adjustment_required" });
    expect((await pool.query("SELECT * FROM compra WHERE idcompra=$1", [purchaseId])).rows).toEqual(before); expect(mock.sync).not.toHaveBeenCalled();
  });
  it.each(["cancel-payment", "update-payment", "cancel-admission", "update-admission"])("refreshes link visibility after waiting for a concurrent %s", async (scenario) => {
    const session = await open(); const purchaseId = await reserve();
    const writer = await pool.connect();
    let mutation: Promise<unknown> | undefined;
    try {
      await writer.query("BEGIN");
      const pid = (await writer.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")).rows[0].pid;
      await writer.query("SELECT idcompra FROM compra WHERE idcompra=$1 FOR UPDATE", [purchaseId]);
      if (scenario.endsWith("payment")) await writer.query("INSERT INTO compra_pagamentos(idcompra,forma_pagamento,valor,periodo_id,recebido_em) VALUES ($1,'pix',100,$2,now())", [purchaseId, session.id]);
      else await writer.query("INSERT INTO voucher(idcompra,idagenda,tpvoucher,stusado,validacao_periodo_id,validado_em) VALUES ($1,1,'norma','s',$2,now())", [purchaseId, session.id]);
      mutation = (scenario.startsWith("cancel") ? cancelOperationalPurchase(purchaseId,"Correção",actor) : updateOperationalPurchase({ purchaseId,purchaseDate:today,reason:"Correção",actor })).then((value) => ({ value }), (error) => ({ error }));
      let blocked = false;
      const deadline = Date.now() + 3000;
      while (Date.now() < deadline) {
        blocked = (await pool.query("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE $1=ANY(pg_blocking_pids(pid))) AS waiting", [pid])).rows[0].waiting;
        if (blocked) break;
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      expect(blocked).toBe(true);
      await writer.query("COMMIT");
      expect(await mutation).toMatchObject({ error: { code: "purchase_financial_adjustment_required", status: 409 } });
      expect((await pool.query("SELECT stcompra FROM compra WHERE idcompra=$1", [purchaseId])).rows[0].stcompra).toBe("conc");
      expect((await pool.query(scenario.endsWith("payment") ? "SELECT * FROM compra_pagamentos WHERE idcompra=$1 AND periodo_id IS NOT NULL" : "SELECT * FROM voucher WHERE idcompra=$1 AND validacao_periodo_id IS NOT NULL", [purchaseId])).rowCount).toBe(1);
      expect(mock.sync).not.toHaveBeenCalled();
    } finally { await writer.query("ROLLBACK"); writer.release(); await mutation; }
  });
  it("either commits a complete sale before close or rejects it with no partial receipts", async () => {
    const session = await open();
    const [sale, close] = await Promise.allSettled([createOperationalBoxOfficeSale(input(session.id)), closeCashSession({ periodId:session.id,countedCashCents:10000,reason:"Fim",idempotencyKey:"race-close" },actor)]);
    expect(close.status).toBe("fulfilled");
    const snapshot = (await getCashSession(session.id)).snapshot;
    expect(snapshot.expectedCashCents).toBe(sale.status === "fulfilled" ? 10000 : 0);
    expect((await pool.query("SELECT * FROM compra")).rowCount).toBe(sale.status === "fulfilled" ? 1 : 0);
    expect((await pool.query("SELECT * FROM compra_pagamentos")).rowCount).toBe(sale.status === "fulfilled" ? 1 : 0);
  });
});
