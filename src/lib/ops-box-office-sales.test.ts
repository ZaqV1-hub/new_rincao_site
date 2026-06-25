import { beforeEach, describe, expect, it, vi } from "vitest";
import { createOperationalBoxOfficeSale } from "@/lib/ops-box-office-sales";

const mocks = vi.hoisted(() => ({
  clientQuery: vi.fn(),
  release: vi.fn(),
  ensureOpsAuditLogTable: vi.fn(),
  registerOpsAuditLog: vi.fn(),
  getOrCreateOpenCashPeriod: vi.fn(),
  processConfirmedPurchaseTickets: vi.fn(),
  randomInt: vi.fn(),
}));

vi.mock("node:crypto", () => ({
  randomInt: mocks.randomInt,
}));

vi.mock("@/lib/ingresso-db", () => ({
  getIngressoDbPool: () => ({
    connect: async () => ({
      query: mocks.clientQuery,
      release: mocks.release,
    }),
  }),
}));

vi.mock("@/lib/ops-audit-log", () => ({
  ensureOpsAuditLogTable: mocks.ensureOpsAuditLogTable,
  registerOpsAuditLog: mocks.registerOpsAuditLog,
}));

vi.mock("@/lib/ops-cash-management", () => ({
  getOrCreateOpenCashPeriod: mocks.getOrCreateOpenCashPeriod,
}));

vi.mock("@/lib/ticket-service", () => ({
  processConfirmedPurchaseTickets: mocks.processConfirmedPurchaseTickets,
}));

describe("ops-box-office-sales", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    let randomIndex = 0;

    mocks.randomInt.mockImplementation((minOrMax: number, max?: number) => {
      const upperBound = max ?? minOrMax;
      const next = randomIndex % upperBound;
      randomIndex += 1;
      return next;
    });
    mocks.getOrCreateOpenCashPeriod.mockResolvedValue({
      id: 55,
      aberto_em: "2026-04-23 08:00:00-03",
      fechado_em: null,
      operador: null,
      folha_id: null,
    });
    mocks.registerOpsAuditLog.mockResolvedValue(9001);
    mocks.ensureOpsAuditLogTable.mockResolvedValue(undefined);
    mocks.processConfirmedPurchaseTickets.mockResolvedValue({
      status: "sent",
      purchaseId: 321,
      sentVoucherIds: [9001],
    });
  });

  it("creates a sale with bulk voucher and payment writes", async () => {
    mocks.clientQuery.mockImplementation(async (sql: string, values?: unknown[]) => {
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
        return { rows: [] };
      }

      if (sql.includes("FROM agenda")) {
        return {
          rows: [
            {
              idagenda: 88,
              dtagenda: "2026-07-25",
              tpagenda: "padra",
              stagenda: "abe",
              vlnormalbil: "100.00",
              vlinfantbil: "70.00",
            },
          ],
        };
      }

      if (sql.includes("FROM descontos")) {
        expect(values).toEqual([[7]]);
        return {
          rows: [
            {
              id: 7,
              nome: "Professor",
              tipo_aplicacao: "percentual",
              valor: "50.00",
            },
          ],
        };
      }

      if (sql.includes("FROM cortesias")) {
        expect(values).toEqual([[3]]);
        return {
          rows: [{ id: 3, nome: "Diretoria" }],
        };
      }

      if (sql.includes("INSERT INTO compra (")) {
        expect(values).toEqual(["52998224725", "dinhe", "170.00"]);
        return { rows: [{ idcompra: 321 }] };
      }

      if (sql.includes("SELECT numvoucher")) {
        expect(values).toHaveLength(1);
        expect(Array.isArray(values?.[0])).toBe(true);
        return { rows: [] };
      }

      if (sql.includes("INSERT INTO voucher")) {
        expect(sql.match(/\(/g)?.length).toBeGreaterThanOrEqual(5);
        expect(values).toEqual([
          321,
          expect.stringMatching(/^A/),
          88,
          "norma",
          "50.00",
          "s",
          expect.any(String),
          7,
          "Passaporte - Professor",
          null,
          null,
          "n",
          321,
          expect.stringMatching(/^A/),
          88,
          "norma",
          "50.00",
          "s",
          expect.any(String),
          7,
          "Passaporte - Professor",
          null,
          null,
          "n",
          321,
          expect.stringMatching(/^C/),
          88,
          "infan",
          "70.00",
          "n",
          expect.any(String),
          null,
          "Passaporte Infantil",
          null,
          null,
          "n",
          321,
          expect.stringMatching(/^I/),
          88,
          "isent",
          "0.00",
          "n",
          expect.any(String),
          null,
          "Isento",
          null,
          null,
          "n",
          321,
          expect.stringMatching(/^A/),
          88,
          "corte",
          "0.00",
          "n",
          expect.any(String),
          null,
          "Cortesia - Diretoria - Maria (Portaria)",
          "Maria",
          3,
          "n",
        ]);
        return {
          rows: [
            { idvoucher: 9001 },
            { idvoucher: 9002 },
            { idvoucher: 9003 },
            { idvoucher: 9004 },
            { idvoucher: 9005 },
          ],
        };
      }

      if (sql.includes("INSERT INTO compra_pagamentos")) {
        expect(values).toEqual([321, "dinhe", "100.00", 321, "pix", "70.00"]);
        return { rows: [] };
      }

      return { rows: [] };
    });

    await expect(
      createOperationalBoxOfficeSale({
        agendaId: 88,
        cpf: "529.982.247-25",
        items: [
          { type: "norma", quantity: 2, discountId: 7 },
          { type: "infan", quantity: 1 },
          { type: "isent", quantity: 1 },
        ],
        courtesies: [
          {
            authorId: 3,
            quantity: 1,
            identification: "Maria",
            note: "Portaria",
          },
        ],
        payments: [
          { method: "dinhe", value: "100,00" },
          { method: "pix", value: "70,00" },
        ],
        reason: "Venda presencial",
        actor: {
          name: "Operador",
        },
      }),
    ).resolves.toMatchObject({
      action: "create",
      purchaseId: 321,
      agendaId: 88,
      totalValue: "170.00",
      paymentMethods: ["dinhe", "pix"],
      voucherIds: [9001, 9002, 9003, 9004, 9005],
      voucherCount: 5,
      auditLogId: 9001,
    });
    expect(mocks.registerOpsAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        origem: "ops-box-office",
        acao: "sale_create",
        compraId: 321,
        periodoId: 55,
        motivo: "Venda presencial",
        usuarioNome: "Operador",
      }),
    );
    expect(mocks.clientQuery).toHaveBeenCalledWith("COMMIT");
    expect(mocks.processConfirmedPurchaseTickets).toHaveBeenCalledWith(321);
    expect(mocks.release).toHaveBeenCalled();
  });

  it("rejects paid sales when payment total differs from calculated total", async () => {
    mocks.clientQuery.mockImplementation(async (sql: string) => {
      if (sql === "BEGIN" || sql === "ROLLBACK") {
        return { rows: [] };
      }

      if (sql.includes("FROM agenda")) {
        return {
          rows: [
            {
              idagenda: 88,
              dtagenda: "2026-07-25",
              tpagenda: "padra",
              stagenda: "abe",
              vlnormalbil: "100.00",
              vlinfantbil: "70.00",
            },
          ],
        };
      }

      return { rows: [] };
    });

    await expect(
      createOperationalBoxOfficeSale({
        agendaId: 88,
        items: [{ type: "norma", quantity: 1 }],
        payments: [{ method: "dinhe", value: "1,00" }],
      }),
    ).rejects.toMatchObject({
      code: "box_office_payment_mismatch",
      status: 409,
    });
    expect(mocks.clientQuery).toHaveBeenCalledWith("ROLLBACK");
    expect(mocks.registerOpsAuditLog).not.toHaveBeenCalled();
  });

  it("allows zero-value courtesy-only sales without payment rows", async () => {
    mocks.clientQuery.mockImplementation(async (sql: string, values?: unknown[]) => {
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
        return { rows: [] };
      }

      if (sql.includes("FROM agenda")) {
        return {
          rows: [
            {
              idagenda: 88,
              dtagenda: "2026-07-25",
              tpagenda: "promo",
              stagenda: "abe",
              vlnormalbil: "100.00",
              vlinfantbil: "70.00",
            },
          ],
        };
      }

      if (sql.includes("FROM cortesias")) {
        return { rows: [{ id: 3, nome: "Diretoria" }] };
      }

      if (sql.includes("INSERT INTO compra (")) {
        expect(values).toEqual([null, "corte", "0.00"]);
        return { rows: [{ idcompra: 322 }] };
      }

      if (sql.includes("SELECT numvoucher")) {
        return { rows: [] };
      }

      if (sql.includes("INSERT INTO voucher")) {
        expect(values).toContain("2026-07-25");
        return { rows: [{ idvoucher: 9100 }] };
      }

      if (sql.includes("INSERT INTO compra_pagamentos")) {
        throw new Error("payments_should_not_be_inserted");
      }

      return { rows: [] };
    });

    await expect(
      createOperationalBoxOfficeSale({
        agendaId: 88,
        courtesies: [{ authorId: 3, authorizedById: 3, quantity: 1 }],
      }),
    ).resolves.toMatchObject({
      purchaseId: 322,
      totalValue: "0.00",
      paymentMethods: [],
      voucherIds: [9100],
    });
  });

  it("keeps the committed sale when ticket service is skipped", async () => {
    mocks.processConfirmedPurchaseTickets.mockResolvedValue({
      status: "skipped",
      purchaseId: 323,
      sentVoucherIds: [],
      skippedReason: "ticket_service_not_configured",
    });
    mocks.clientQuery.mockImplementation(async (sql: string, values?: unknown[]) => {
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
        return { rows: [] };
      }

      if (sql.includes("FROM agenda")) {
        return {
          rows: [
            {
              idagenda: 88,
              dtagenda: "2026-07-25",
              tpagenda: "padra",
              stagenda: "abe",
              vlnormalbil: "100.00",
              vlinfantbil: "70.00",
            },
          ],
        };
      }

      if (sql.includes("INSERT INTO compra (")) {
        expect(values).toEqual([null, "dinhe", "100.00"]);
        return { rows: [{ idcompra: 323 }] };
      }

      if (sql.includes("SELECT numvoucher")) {
        return { rows: [] };
      }

      if (sql.includes("INSERT INTO voucher")) {
        return { rows: [{ idvoucher: 9200 }] };
      }

      if (sql.includes("INSERT INTO compra_pagamentos")) {
        return { rows: [] };
      }

      return { rows: [] };
    });

    await expect(
      createOperationalBoxOfficeSale({
        agendaId: 88,
        items: [{ type: "norma", quantity: 1 }],
        payments: [{ method: "dinhe", value: "100.00" }],
      }),
    ).resolves.toMatchObject({
      purchaseId: 323,
      warnings: ["ticket_service_not_configured"],
    });
    expect(mocks.clientQuery).toHaveBeenCalledWith("COMMIT");
    expect(mocks.clientQuery).not.toHaveBeenCalledWith("ROLLBACK");
  });

  it("keeps the committed sale when ticket dispatch fails after commit", async () => {
    mocks.processConfirmedPurchaseTickets.mockRejectedValue(
      new Error("ticket service unavailable"),
    );
    mocks.clientQuery.mockImplementation(async (sql: string, values?: unknown[]) => {
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
        return { rows: [] };
      }

      if (sql.includes("FROM agenda")) {
        return {
          rows: [
            {
              idagenda: 88,
              dtagenda: "2026-07-25",
              tpagenda: "padra",
              stagenda: "abe",
              vlnormalbil: "100.00",
              vlinfantbil: "70.00",
            },
          ],
        };
      }

      if (sql.includes("INSERT INTO compra (")) {
        expect(values).toEqual([null, "dinhe", "100.00"]);
        return { rows: [{ idcompra: 324 }] };
      }

      if (sql.includes("SELECT numvoucher")) {
        return { rows: [] };
      }

      if (sql.includes("INSERT INTO voucher")) {
        return { rows: [{ idvoucher: 9300 }] };
      }

      if (sql.includes("INSERT INTO compra_pagamentos")) {
        return { rows: [] };
      }

      return { rows: [] };
    });

    await expect(
      createOperationalBoxOfficeSale({
        agendaId: 88,
        items: [{ type: "norma", quantity: 1 }],
        payments: [{ method: "dinhe", value: "100.00" }],
      }),
    ).resolves.toMatchObject({
      purchaseId: 324,
      warnings: ["ticket_service_failed"],
    });
    expect(mocks.clientQuery).toHaveBeenCalledWith("COMMIT");
    expect(mocks.clientQuery).not.toHaveBeenCalledWith("ROLLBACK");
  });

  it("reuses a committed sale when the same idempotency key is retried", async () => {
    mocks.clientQuery.mockImplementation(async (sql: string, values?: unknown[]) => {
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
        return { rows: [] };
      }

      if (sql.includes("pg_advisory_xact_lock")) {
        expect(values).toEqual(["ops-box-office-sale:box-sale-abc123"]);
        return { rows: [] };
      }

      if (sql.includes("FROM edicoes_log")) {
        expect(values).toEqual(["box-sale-abc123"]);
        return {
          rows: [
            {
              audit_log_id: 9100,
              purchase_id: 400,
              total_value: "100.00",
              payment_method: "dinhe",
              voucher_ids: [9501, 9502],
              detalhes_json: JSON.stringify({
                agendaId: 88,
                totalValue: "100.00",
                paymentMethods: ["dinhe"],
                voucherIds: [9501, 9502],
                idempotencyKey: "box-sale-abc123",
              }),
            },
          ],
        };
      }

      if (sql.includes("INSERT INTO compra")) {
        throw new Error("purchase_should_not_be_inserted_again");
      }

      return { rows: [] };
    });

    await expect(
      createOperationalBoxOfficeSale({
        agendaId: 88,
        idempotencyKey: "box-sale-abc123",
        items: [{ type: "norma", quantity: 1 }],
        payments: [{ method: "dinhe", value: "100.00" }],
      }),
    ).resolves.toMatchObject({
      purchaseId: 400,
      agendaId: 88,
      totalValue: "100.00",
      paymentMethods: ["dinhe"],
      voucherIds: [9501, 9502],
      auditLogId: 9100,
      warnings: ["idempotent_replay"],
    });
    expect(mocks.ensureOpsAuditLogTable).toHaveBeenCalled();
    expect(mocks.getOrCreateOpenCashPeriod).not.toHaveBeenCalled();
    expect(mocks.processConfirmedPurchaseTickets).toHaveBeenCalledWith(400);
  });
});
