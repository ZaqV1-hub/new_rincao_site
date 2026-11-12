import { beforeEach, describe, expect, it, vi } from "vitest";
import { createOperationalBoxOfficeSale, readCashPayments, settleCashPayments } from "./ops-box-office-sales";
const mock = vi.hoisted(() => ({ query: vi.fn(), release: vi.fn(), lock: vi.fn(), audit: vi.fn(), send: vi.fn(), command: vi.fn() }));
vi.mock("@/lib/ingresso-db", () => ({ getIngressoSistemaDbPool: () => ({ connect: async () => ({ query: mock.query, release: mock.release }) }), getIngressoSistemaDbDialect: () => "postgres" }));
vi.mock("@/lib/ops-audit-log", () => ({ ensureOpsAuditLogTable: async () => {}, registerOpsAuditLog: mock.audit }));
vi.mock("@/lib/operational-cash-session", () => ({ lockOpenCashSession: mock.lock, withCashSessionCommand: mock.command, CashSessionError: class extends Error {} }));
vi.mock("@/lib/ticket-service", () => ({ processConfirmedPurchaseTickets: mock.send }));
const input = { agendaId: 88, periodId: 55, cpf: "52998224725", idempotencyKey: "sale-test-key", items: [{ type: "norma", quantity: 1 }], payments: [{ method: "dinhe", value: "100.00" }], actor: { name: "Operador", cpf: "52998224725" } };
beforeEach(() => {
  vi.clearAllMocks();
  mock.command.mockImplementation(async (_client, _input, run) => (await run()).response);
  mock.lock.mockResolvedValue({ id: 55, park: "rincao", date: "2099-01-01", type: "sales" });
  mock.audit.mockResolvedValue(9001); mock.send.mockResolvedValue({ status: "sent" });
  mock.query.mockImplementation(async (sql: string) => {
      if (sql.includes('AS "isCurrentCashDate"')) return { rows: [{ isCurrentCashDate: true }] };
    if (sql.includes("FROM agenda")) return { rows: [{ idagenda: 88, dtagenda: "2099-01-01", tpagenda: "padra", stagenda: "lot", vlnormalbil: "100.00", vlinfantbil: "70.00", validity: "7_days", ticketTypes: ["norma", "infan", "isent"] }] };
    if (sql.includes("FROM cortesias")) return { rows: [{ id: 3, nome: "Diretoria" }] };
    if (sql.includes("FROM descontos")) return { rows: [{ id: 7, nome: "Professor", tipo_aplicacao: "percentual", valor: "50.00" }] };
    if (sql.includes("FROM servicos_adicionais")) return { rows: [{ id: "9", name: "Armário", price: "10.00" }] };
    if (sql.includes("INSERT INTO compra (")) return { rows: [{ idcompra: 321 }] };
    if (sql.includes("INSERT INTO voucher")) return { rows: [{ idvoucher: 9001 }] };
    return { rows: [], rowCount: 0 };
  });
});
describe("cash payment arithmetic", () => {
  it("uses exact cents, gives change only from cash, and accepts a free sale without fake payment", () => {
    expect(settleCashPayments(10000, readCashPayments([{ method: "pix", value: "70,00" }, { method: "dinhe", value: "50.00" }]))).toEqual({ totalCents: 10000, receivedCents: 12000, changeCents: 2000, netPayments: [{ method: "pix", amountCents: 7000 }, { method: "dinhe", amountCents: 3000 }] });
    expect(settleCashPayments(0, [])).toEqual({ totalCents: 0, receivedCents: 0, changeCents: 0, netPayments: [] });
    expect(() => settleCashPayments(100, readCashPayments([{ method: "pix", value: "1.01" }]))).toThrow();
    expect(() => settleCashPayments(100, readCashPayments([{ method: "dinhe", value: "0.99" }]))).toThrow();
  });
  it.each([{ method: "boleto", value: "1" }, { method: "pix", value: "0.001" }, { method: "pix", value: "1e3" }, { method: "dinhe", value: -1 }, { method: "pix", value: "1.2,34" }])("rejects unsupported or inexact payments", (payment) => { expect(() => readCashPayments([payment])).toThrow(); });
});
describe("scoped box office sale", () => {
  it("requires an explicit period, idempotency key, valid CPF and bounded units", async () => {
    for (const patch of [{ periodId: 0 }, { idempotencyKey: "" }, { cpf: "11111111111" }, { items: [{ type: "norma", quantity: 501 }] }, { services: [{ serviceId: 9, quantity: 1, discountId: 7 }] }]) await expect(createOperationalBoxOfficeSale({ ...input, ...patch })).rejects.toMatchObject({ status: 400 });
    expect(mock.query).not.toHaveBeenCalled();
  });
  it("locks the explicit sales session, preserves discounts, and saves interval and operational origin", async () => {
    const result = await createOperationalBoxOfficeSale({ ...input, items: [{ type: "norma", quantity: 2, discountId: 7 }], payments: [{ method: "dinhe", value: "120.00" }] });
    expect(mock.lock).toHaveBeenCalledWith(expect.anything(), { periodId: 55, expectedType: "sales" });
    expect(result).toMatchObject({ totalCents: 10000, receivedCents: 12000, changeCents: 2000, periodId: 55 });
    expect(mock.command.mock.invocationCallOrder[0]).toBeLessThan(mock.lock.mock.invocationCallOrder[0]);
    const vouchers = mock.query.mock.calls.find(([sql]) => String(sql).includes("INSERT INTO voucher"))!;
    expect(vouchers[0]).toContain("dtinicio_validade"); expect(vouchers[0]).toContain("parque_operacional");
    expect(vouchers[1]).toContain("2099-01-01"); expect(vouchers[1]).toContain("2099-01-07"); expect(vouchers[1]).toContain("rincao");
    const payments = mock.query.mock.calls.find(([sql]) => String(sql).includes("INSERT INTO compra_pagamentos"))!;
    expect(payments[0]).toContain("periodo_id"); expect(payments[1]).toContain("100.00"); expect(payments[1]).toContain(55);
  });
  it("allows free courtesy and service sales without payment rows", async () => {
    await createOperationalBoxOfficeSale({ ...input, items: [], courtesies: [{ authorId: 3, quantity: 1 }], payments: [] });
    expect(mock.query.mock.calls.some(([sql]) => String(sql).includes("INSERT INTO compra_pagamentos"))).toBe(false);
  });
  it("does not apply admission discounts to services and rejects disabled ticket types", async () => {
    const result = await createOperationalBoxOfficeSale({ ...input, items: [{ type: "norma", quantity: 1, discountId: 7 }], services: [{ serviceId: 9, quantity: 1 }], payments: [{ method: "pix", value: "60.00" }] });
    expect(result.totalCents).toBe(6000);
    const original = mock.query.getMockImplementation()!;
    mock.query.mockImplementation(async (sql, ...args) => sql.includes("FROM agenda") ? { rows: [{ idagenda: 88, dtagenda: "2099-01-01", vlnormalbil: "100", vlinfantbil: "70", validity: "day", ticketTypes: ["infan"] }] } : original(sql, ...args));
    await expect(createOperationalBoxOfficeSale(input)).rejects.toMatchObject({ status: 409 });
  });
  it("retains a committed sale on delivery failure and never dispatches a replay", async () => {
    mock.send.mockRejectedValueOnce(new Error("delivery down"));
    const result = await createOperationalBoxOfficeSale(input);
    expect(result.purchaseId).toBe(321); expect(mock.query.mock.calls.some(([sql]) => sql === "ROLLBACK")).toBe(false);
    mock.send.mockClear(); mock.command.mockResolvedValueOnce(result);
    expect(await createOperationalBoxOfficeSale(input)).toEqual(result); expect(mock.send).not.toHaveBeenCalled();
  });
});
