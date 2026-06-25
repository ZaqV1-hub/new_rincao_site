import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getPainelBilheteriaPurchaseDetail,
  getPainelBilheteriaVoucherPrintModel,
} from "@/lib/painel-bilheteria";

const { query, connect, clientQuery, release, generateVoucherQrcodes, registerOpsAuditLog } = vi.hoisted(() => ({
  query: vi.fn(),
  connect: vi.fn(),
  clientQuery: vi.fn(),
  release: vi.fn(),
  generateVoucherQrcodes: vi.fn(),
  registerOpsAuditLog: vi.fn(),
}));

vi.mock("@/lib/ingresso-db", () => ({
  getIngressoDbPool: () => ({
    query,
    connect,
  }),
}));

vi.mock("@/lib/ticket-api", () => ({
  generateVoucherQrcodes,
  TicketApiError: class TicketApiError extends Error {
    code: string;
    status: number;

    constructor(code: string, message: string, status = 502) {
      super(message);
      this.code = code;
      this.status = status;
    }
  },
}));

vi.mock("@/lib/ops-audit-log", () => ({
  registerOpsAuditLog,
}));

describe("painel-bilheteria", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    connect.mockResolvedValue({
      query: clientQuery,
      release,
    });
  });

  it("returns voucher editing metadata for history detail", async () => {
    query.mockImplementation(async (sql: string, values?: unknown[]) => {
      if (sql.includes("FROM compra")) {
        expect(values).toEqual([321]);

        return {
          rows: [
            {
              idcompra: 321,
              dtcompra: "2026-04-28",
              cpf: "52998224725",
              tpcompra: "bilhe",
              stcompra: "conc",
              formapag: "pix",
              vltotcompra: "60.00",
              dtpagamento: "2026-04-28",
              hrpagamento: "14:30:00",
            },
          ],
        };
      }

      if (sql.includes("LEFT JOIN agenda ON agenda.idagenda = voucher.idagenda")) {
        return {
          rows: [
            {
              idvoucher: 1,
              numvoucher: "A1234",
              tpvoucher: "norma",
              stusado: "n",
              vlunicompra: "60.00",
              desconto_id: 7,
              descricao: "Passaporte - Meia",
              agenda_data: "2026-05-01",
            },
            {
              idvoucher: 2,
              numvoucher: "I1234",
              tpvoucher: "isent",
              stusado: "n",
              vlunicompra: "0.00",
              desconto_id: null,
              descricao: "Isento",
              agenda_data: "2026-05-01",
            },
          ],
        };
      }

      if (sql.includes("FROM compra_pagamentos")) {
        return {
          rows: [
            {
              forma_pagamento: "pix",
              valor: "60.00",
            },
          ],
        };
      }

      if (sql.includes("FROM descontos")) {
        return {
          rows: [
            {
              id: 7,
              nome: "Meia",
              tipo_aplicacao: "percentual",
              valor: "50.00",
              tipo_desc: "Estudante",
            },
          ],
        };
      }

      return { rows: [] };
    });

    const detail = await getPainelBilheteriaPurchaseDetail(321);

    expect(detail.discountOptions).toEqual([
      {
        id: 7,
        name: "Meia",
        applicationType: "percentual",
        value: "50.00",
        typeDescription: "Estudante",
      },
    ]);
    expect(detail.vouchers).toEqual([
      expect.objectContaining({
        voucherId: 1,
        voucherType: "norma",
        voucherTypeLabel: "Passaporte - Meia",
        baseVoucherTypeLabel: "Passaporte",
        unitValue: "60.00",
        baseUnitValue: "120.00",
        discountId: 7,
        discountEditable: true,
      }),
      expect.objectContaining({
        voucherId: 2,
        voucherType: "isent",
        voucherTypeLabel: "Isento",
        baseVoucherTypeLabel: "Isento",
        unitValue: "0.00",
        baseUnitValue: "0.00",
        discountId: null,
        discountEditable: false,
      }),
    ]);
  });

  it("returns a single voucher print model and extends validity", async () => {
    clientQuery.mockImplementation(async (sql: string, values?: unknown[]) => {
      if (sql === "BEGIN" || sql === "COMMIT") {
        return { rows: [] };
      }

      if (sql.includes("FROM voucher") && sql.includes("JOIN compra")) {
        expect(values).toEqual([12]);

        return {
          rows: [
            {
              idvoucher: 12,
              idcompra: 321,
              idagenda: 44,
              numvoucher: "A1234",
              tpvoucher: "norma",
              stusado: "n",
              dtuso: null,
              vlunicompra: "49.90",
              desconto_id: null,
              descricao: "Passaporte",
              dtvalidade: "2026-04-28",
              cpf: "52998224725",
              tpcompra: "bilhe",
              dtcompra: "2026-04-28",
            },
          ],
        };
      }

      if (sql.includes("FROM agenda")) {
        expect(values).toEqual([44]);
        return {
          rows: [{ dtagenda: "2026-05-01" }],
        };
      }

      if (sql.includes("UPDATE voucher")) {
        expect(values?.[0]).toBe(12);
        expect(String(values?.[1])).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        return { rows: [] };
      }

      return { rows: [] };
    });
    registerOpsAuditLog.mockResolvedValue(77);
    generateVoucherQrcodes.mockResolvedValue({
      12: "https://qr.example/12.png",
    });

    const model = await getPainelBilheteriaVoucherPrintModel(12, {
      name: "Operador",
      cpf: "52998224725",
    });

    expect(model).toEqual(
      expect.objectContaining({
        purchaseId: 321,
        voucherId: 12,
        voucherCode: "A1234",
        typeLabel: "Passaporte",
        purchaseLocation: "Bilheteria",
        purchaseDate: "2026-04-28",
        visitDate: "2026-05-01",
        qrCodeUrl: "https://qr.example/12.png",
      }),
    );
    expect(generateVoucherQrcodes).toHaveBeenCalledWith([
      expect.objectContaining({
        purchaseId: 321,
        voucherId: 12,
        cpf: "52998224725",
        purchaseLocation: "Bilheteria",
      }),
    ]);
    expect(release).toHaveBeenCalled();
  });

  it("blocks QR print for used voucher", async () => {
    clientQuery.mockImplementation(async (sql: string) => {
      if (sql === "BEGIN" || sql === "ROLLBACK") {
        return { rows: [] };
      }

      if (sql.includes("FROM voucher") && sql.includes("JOIN compra")) {
        return {
          rows: [
            {
              idvoucher: 12,
              idcompra: 321,
              idagenda: 44,
              numvoucher: "A1234",
              tpvoucher: "norma",
              stusado: "s",
              dtuso: "2026-04-28",
              vlunicompra: "49.90",
              desconto_id: null,
              descricao: "Passaporte",
              dtvalidade: "2026-04-28",
              cpf: "52998224725",
              tpcompra: "bilhe",
              dtcompra: "2026-04-28",
            },
          ],
        };
      }

      return { rows: [] };
    });

    await expect(getPainelBilheteriaVoucherPrintModel(12)).rejects.toMatchObject({
      code: "voucher_already_used",
      status: 409,
    });
    expect(generateVoucherQrcodes).not.toHaveBeenCalled();
    expect(release).toHaveBeenCalled();
  });
});
