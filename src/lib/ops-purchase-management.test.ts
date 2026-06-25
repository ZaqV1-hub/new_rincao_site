import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cancelOperationalPurchase,
  updateOperationalPurchase,
} from "@/lib/ops-purchase-management";

const { query, connect, release, syncTicketValidation, registerOpsAuditLog } =
  vi.hoisted(() => ({
  query: vi.fn(),
  connect: vi.fn(),
  release: vi.fn(),
  syncTicketValidation: vi.fn(),
  registerOpsAuditLog: vi.fn(),
  }));

vi.mock("@/lib/ingresso-db", () => ({
  getIngressoDbPool: () => ({
    connect,
  }),
}));

vi.mock("@/lib/ticket-service", () => ({
  syncTicketValidation,
}));

vi.mock("@/lib/ops-audit-log", () => ({
  registerOpsAuditLog,
}));

describe("ops-purchase-management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    connect.mockResolvedValue({
      query,
      release,
    });
    syncTicketValidation.mockResolvedValue({
      status: "sent",
      action: "invalidate",
      pairs: ["321-1", "321-2"],
    });
    registerOpsAuditLog.mockResolvedValue(901);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-23T15:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("cancels a bilheteria purchase and invalidates its vouchers", async () => {
    query.mockImplementation(async (sql: string, values?: unknown[]) => {
      if (sql === "BEGIN" || sql === "COMMIT") {
        return { rows: [] };
      }

      if (sql.includes("FROM compra")) {
        expect(values).toEqual([321]);

        return {
          rows: [
            {
              idcompra: 321,
              tpcompra: "bilhe",
              stcompra: "conc",
              vltotcompra: "120.00",
            },
          ],
        };
      }

      if (sql.includes("FROM voucher")) {
        return {
          rows: [
            {
              idvoucher: 1,
              numvoucher: "A1234",
              idcompra: 321,
              stusado: "n",
            },
            {
              idvoucher: 2,
              numvoucher: "A1235",
              idcompra: 321,
              stusado: "s",
            },
          ],
        };
      }

      return { rows: [] };
    });

    const result = await cancelOperationalPurchase(
      321,
      "Cancelamento manual",
      {
        name: "Gestor Teste",
        cpf: "52998224725",
      },
    );

    expect(result).toEqual({
      action: "cancel",
      purchaseId: 321,
      status: "canc",
      affectedVoucherIds: [1, 2],
      warnings: [],
      message: "Compra cancelada com sucesso.",
      auditLogId: 901,
    });
    expect(syncTicketValidation).toHaveBeenCalledWith(
      [
        { purchaseId: 321, voucherId: 1 },
        { purchaseId: 321, voucherId: 2 },
      ],
      "invalidate",
    );
    expect(registerOpsAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        origem: "compra",
        acao: "excluir",
        compraId: 321,
      }),
    );
  });

  it("rejects cancelling a purchase that is already cancelled", async () => {
    query.mockImplementation(async (sql: string) => {
      if (sql === "BEGIN") {
        return { rows: [] };
      }

      if (sql === "ROLLBACK") {
        return { rows: [] };
      }

      if (sql.includes("FROM compra")) {
        return {
          rows: [
            {
              idcompra: 321,
              tpcompra: "reser",
              stcompra: "canc",
              vltotcompra: "80.00",
            },
          ],
        };
      }

      return { rows: [] };
    });

    await expect(
      cancelOperationalPurchase(321, "Cancelamento manual"),
    ).rejects.toMatchObject({
      code: "purchase_already_cancelled",
      status: 409,
    });
    expect(syncTicketValidation).not.toHaveBeenCalled();
  });

  it("updates purchase totals, payments and voucher status", async () => {
    query.mockImplementation(async (sql: string, values?: unknown[]) => {
      if (sql === "BEGIN" || sql === "COMMIT") {
        return { rows: [] };
      }

      if (sql.includes("FROM compra")) {
        expect(values).toEqual([321]);

        return {
          rows: [
            {
              idcompra: 321,
              tpcompra: "bilhe",
              stcompra: "conc",
              vltotcompra: "120.00",
              dtcompra: "2026-04-20",
              cpf: "11122233344",
              formapag: "dinh",
            },
          ],
        };
      }

      if (sql.includes("FROM voucher")) {
        return {
          rows: [
            {
              idvoucher: 1,
              numvoucher: "A1234",
              idcompra: 321,
              stusado: "n",
              vlunicompra: "120.00",
              tpvoucher: "norma",
              descricao: "Passaporte - Normal",
              desconto_id: null,
            },
          ],
        };
      }

      if (sql.includes("FROM descontos")) {
        expect(values).toEqual([7]);

        return {
          rows: [
            {
              id: 7,
              nome: "Meia",
              tipo_aplicacao: "percentual",
              valor: "50.00",
            },
          ],
        };
      }

      return { rows: [] };
    });

    const result = await updateOperationalPurchase({
      purchaseId: 321,
      reason: "Ajuste manual",
      purchaseDate: "2026-04-23",
      status: "conc",
      cpf: "529.982.247-25",
      vouchers: [{ id: 1, status: "s", discountId: 7 }],
      payments: [{ method: "pix", value: "60,00" }],
      actor: { name: "Gestor Teste" },
    });

    expect(result).toEqual({
      action: "update",
      purchaseId: 321,
      status: "conc",
      totalValue: "60.00",
      paymentMethods: ["pix"],
      affectedVoucherIds: [1],
      warnings: [],
      message: "Alteracoes salvas.",
      auditLogId: 901,
    });
    expect(syncTicketValidation).toHaveBeenCalledWith(
      [{ purchaseId: 321, voucherId: 1 }],
      "validate",
    );
    expect(registerOpsAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        origem: "compra",
        acao: "editar",
        compraId: 321,
      }),
    );
  });

  it("allows updating purchase status to cancelled to match the legacy editor", async () => {
    query.mockImplementation(async (sql: string, values?: unknown[]) => {
      if (sql === "BEGIN" || sql === "COMMIT") {
        return { rows: [] };
      }

      if (sql.includes("FROM compra")) {
        expect(values).toEqual([321]);

        return {
          rows: [
            {
              idcompra: 321,
              tpcompra: "bilhe",
              stcompra: "conc",
              vltotcompra: "120.00",
              dtcompra: "2026-04-20",
              cpf: "11122233344",
              formapag: "pix",
            },
          ],
        };
      }

      if (sql.includes("FROM voucher")) {
        return {
          rows: [
            {
              idvoucher: 1,
              numvoucher: "A1234",
              idcompra: 321,
              stusado: "n",
              vlunicompra: "120.00",
              tpvoucher: "norma",
              descricao: "Passaporte - Normal",
              desconto_id: null,
            },
          ],
        };
      }

      return { rows: [] };
    });

    const result = await updateOperationalPurchase({
      purchaseId: 321,
      reason: "Ajuste legado",
      purchaseDate: "2026-04-23",
      status: "canc",
      cpf: "52998224725",
      vouchers: [{ id: 1, status: "n", value: "120.00", discountId: null }],
      payments: [{ method: "pix", value: "120,00" }],
      actor: { name: "Gestor Teste" },
    });

    expect(result).toEqual({
      action: "update",
      purchaseId: 321,
      status: "canc",
      totalValue: "120.00",
      paymentMethods: ["pix"],
      affectedVoucherIds: [],
      warnings: [],
      message: "Alteracoes salvas.",
      auditLogId: 901,
    });
  });

  it("returns unchanged when no fields differ", async () => {
    query.mockImplementation(async (sql: string, values?: unknown[]) => {
      if (sql === "BEGIN" || sql === "ROLLBACK") {
        return { rows: [] };
      }

      if (sql.includes("FROM compra")) {
        expect(values).toEqual([321]);

        return {
          rows: [
            {
              idcompra: 321,
              tpcompra: "bilhe",
              stcompra: "conc",
              vltotcompra: "120.00",
              dtcompra: "2026-04-23",
              cpf: "52998224725",
              formapag: "pix",
            },
          ],
        };
      }

      if (sql.includes("FROM voucher")) {
        return {
          rows: [
            {
              idvoucher: 1,
              numvoucher: "A1234",
              idcompra: 321,
              stusado: "n",
              vlunicompra: "120.00",
              tpvoucher: "norma",
              descricao: "Passaporte - Normal",
              desconto_id: null,
            },
          ],
        };
      }

      return { rows: [] };
    });

    const result = await updateOperationalPurchase({
      purchaseId: 321,
      reason: "Revisao",
      purchaseDate: "2026-04-23",
      status: "conc",
      cpf: "52998224725",
      vouchers: [{ id: 1, status: "n", value: "120.00", discountId: null }],
      actor: { name: "Gestor Teste" },
    });

    expect(result).toEqual({
      action: "update",
      purchaseId: 321,
      status: "conc",
      totalValue: "120.00",
      paymentMethods: [],
      affectedVoucherIds: [],
      warnings: [],
      message: "Nenhuma alteracao detectada.",
      auditLogId: null,
      unchanged: true,
    });
    expect(syncTicketValidation).not.toHaveBeenCalled();
    expect(registerOpsAuditLog).not.toHaveBeenCalled();
  });

  it("rejects an unknown discount id for an editable voucher", async () => {
    query.mockImplementation(async (sql: string) => {
      if (sql === "BEGIN") {
        return { rows: [] };
      }

      if (sql === "ROLLBACK") {
        return { rows: [] };
      }

      if (sql.includes("FROM compra")) {
        return {
          rows: [
            {
              idcompra: 321,
              tpcompra: "bilhe",
              stcompra: "conc",
              vltotcompra: "120.00",
              dtcompra: "2026-04-23",
              cpf: "52998224725",
              formapag: "pix",
            },
          ],
        };
      }

      if (sql.includes("FROM voucher")) {
        return {
          rows: [
            {
              idvoucher: 1,
              numvoucher: "A1234",
              idcompra: 321,
              stusado: "n",
              vlunicompra: "120.00",
              tpvoucher: "norma",
              descricao: "Passaporte - Normal",
              desconto_id: null,
            },
          ],
        };
      }

      if (sql.includes("FROM descontos")) {
        return { rows: [] };
      }

      return { rows: [] };
    });

    await expect(
      updateOperationalPurchase({
        purchaseId: 321,
        reason: "Ajuste manual",
        purchaseDate: "2026-04-23",
        status: "conc",
        vouchers: [{ id: 1, discountId: 999 }],
        payments: [{ method: "pix", value: "120,00" }],
      }),
    ).rejects.toMatchObject({
      code: "discount_not_found",
      status: 404,
    });
    expect(registerOpsAuditLog).not.toHaveBeenCalled();
  });

  it("rejects saving without a reason using the legacy message", async () => {
    await expect(
      updateOperationalPurchase({
        purchaseId: 321,
        reason: "   ",
        purchaseDate: "2026-04-23",
        status: "conc",
        vouchers: [],
        payments: [],
      }),
    ).rejects.toMatchObject({
      code: "invalid_update_reason",
      message: "Informe o motivo da alteracao.",
      status: 400,
    });
    expect(connect).not.toHaveBeenCalled();
  });
});
