import { readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { resetVoucherLifecycleSchemaForTests } from "@/lib/voucher-repository";
import { validateSelectedVouchers, unvalidateSelectedVouchers } from "@/lib/ops-voucher-validation";

const mock = vi.hoisted(() => ({ pool: null as Pool | null }));
vi.mock("@/lib/ingresso-db", () => ({ getIngressoSistemaDbPool: () => mock.pool, getIngressoSistemaDbDialect: () => "postgres" }));
vi.mock("@/lib/school-payment-eligibility", () => ({ getSchoolPaymentHold: async () => null }));
vi.mock("@/lib/ticket-service", () => ({ syncTicketValidation: async () => ({ status: "sent" }) }));
const connectionString = process.env.PANEL_TEST_DATABASE_URL;
if (connectionString) {
  const url = new URL(connectionString);
  if (!["postgres:", "postgresql:"].includes(url.protocol) || url.hostname !== "127.0.0.1" || url.pathname !== "/chargeback_test_painel" || url.search || url.hash) throw new Error("Use only the scratch database chargeback_test_painel on 127.0.0.1 without URL options");
}

describe.skipIf(!connectionString)("purchase-scoped voucher selection with PostgreSQL", () => {
  const schema = `purchase_selection_it_${randomBytes(8).toString("hex")}`;
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
    await pool.query("TRUNCATE voucher, compra, agenda, operacao_dias, online_capacity_reservations,pagpagseguro,edicoes_log,caixa_operacoes,caixa_periodos,caixa_locais,caixa_fechamentos,compra_pagamentos RESTART IDENTITY CASCADE");
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

  const actor = { name: "Operador", cpf: "52998224725" };
  async function snapshot() {
    return {
      vouchers: (await pool.query("SELECT * FROM voucher ORDER BY idvoucher")).rows,
      audits: (await pool.query("SELECT * FROM edicoes_log ORDER BY id")).rows,
      payments: (await pool.query("SELECT * FROM compra_pagamentos ORDER BY id")).rows,
    };
  }
  it("changes only the requested voucher, keeps warnings, and retries never duplicate admission or reversal", async () => {
    const initial = await snapshot();
    const result = await validateSelectedVouchers([1,2], actor, 1, 1);
    expect(result).toMatchObject({ action: "validate", mode: "selection", processedCount: 1, affectedVoucherIds: [1] });
    expect(result.warnings).toHaveLength(1);
    expect((await snapshot()).vouchers.slice(1)).toEqual(initial.vouchers.slice(1));
    const validated = await snapshot();
    expect(validated.audits).toHaveLength(1);
    expect(validated.vouchers[0]).toMatchObject({ stusado: "s", validacao_periodo_id: 1, validado_por_nome: actor.name });
    await expect(validateSelectedVouchers([1], actor, 1, 1)).rejects.toMatchObject({ code: "voucher_validation_unavailable", status: 409 });
    expect(await snapshot()).toEqual(validated);
    await expect(unvalidateSelectedVouchers([1], actor, 2, 1)).resolves.toMatchObject({ action: "unvalidate", processedCount: 1, affectedVoucherIds: [1] });
    const reversed = await snapshot();
    expect(reversed.vouchers[0]).toMatchObject({ stusado: "n", validacao_periodo_id: null, validado_em: null });
    expect(reversed.audits).toHaveLength(2); expect(reversed.payments).toEqual(initial.payments);
    await expect(unvalidateSelectedVouchers([1], actor, 2, 1)).rejects.toMatchObject({ code: "voucher_unvalidate_unavailable", status: 409 });
    expect(await snapshot()).toEqual(reversed);
  });
  it.each([
    ["validate", "foreign"], ["validate", "missing"], ["validate", "other_park"],
    ["unvalidate", "foreign"], ["unvalidate", "missing"], ["unvalidate", "other_park"],
  ])("rolls back the whole %s selection for an %s voucher even if it would be skipped", async (action, mismatch) => {
    if (action === "unvalidate") await validateSelectedVouchers([1], actor, 1, 1);
    if (mismatch === "foreign") await pool.query("INSERT INTO compra(idcompra,stcompra) VALUES(2,'conc'); UPDATE voucher SET idcompra=2 WHERE idvoucher=2");
    if (mismatch === "other_park") await pool.query("UPDATE voucher SET parque_operacional='estancia' WHERE idvoucher=2");
    const before = await snapshot();
    const execute = action === "validate" ? validateSelectedVouchers : unvalidateSelectedVouchers;
    await expect(execute([1, mismatch === "missing" ? 999 : 2], actor, 2, 1)).rejects.toMatchObject({
      code: mismatch === "other_park" ? "voucher_park_mismatch" : "voucher_purchase_mismatch", status: 409,
    });
    expect(await snapshot()).toEqual(before);
  });
  it.each(["validate", "unvalidate"])("rejects missing and closed cash for purchase-scoped %s", async (action) => {
    const execute = action === "validate" ? validateSelectedVouchers : unvalidateSelectedVouchers;
    if (action === "unvalidate") await validateSelectedVouchers([1], actor, 1, 1);
    const before = await snapshot();
    await expect(execute([1], actor, undefined, 1)).rejects.toMatchObject({ code: "cash_session_required", status: 409 });
    await pool.query("UPDATE caixa_periodos SET fechado_em=now() WHERE id=2");
    await expect(execute([1], actor, 2, 1)).rejects.toMatchObject({ status: 409 });
    expect(await snapshot()).toEqual(before);
  });
  it("rechecks the original validation cash closure before undoing the purchase selection", async () => {
    await validateSelectedVouchers([1], actor, 1, 1);
    await pool.query("UPDATE caixa_periodos SET fechado_em=now() WHERE id=1");
    const before = await snapshot();
    await expect(unvalidateSelectedVouchers([1], actor, 2, 1)).rejects.toMatchObject({ code: "voucher_cash_closed", status: 409 });
    expect(await snapshot()).toEqual(before);
  });
  it("serializes two operators selecting the same purchase voucher into one admission", async () => {
    const results = await Promise.allSettled([
      validateSelectedVouchers([1], actor, 1, 1), validateSelectedVouchers([1], { name: "Segundo", cpf: "11144477735" }, 2, 1),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.find((result) => result.status === "rejected")).toMatchObject({ reason: { code: "voucher_validation_unavailable", status: 409 } });
    expect((await snapshot()).audits).toHaveLength(1);
  });
  it("keeps legacy null-park vouchers eligible without changing unrelated selection callers", async () => {
    await expect(validateSelectedVouchers([3], actor, 1, 1)).resolves.toMatchObject({ affectedVoucherIds: [3] });
    await expect(validateSelectedVouchers([1,999], actor, 1)).resolves.toMatchObject({ affectedVoucherIds: [1], warnings: ["Voucher 999 nao encontrado."] });
  });
});
