import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getPainelBilheteriaPurchaseDetail,
  getPainelBilheteriaVoucherPrintModel,
  payPainelBilheteriaReservation,
  sendPainelBilheteriaVoucherWhatsapp,
} from "@/lib/painel-bilheteria";

const { sendPurchaseTicketsWhatsApp, query, connect, clientQuery, release, generateVoucherQrcodes, registerOpsAuditLog, queuePurchaseConfirmationEmail } = vi.hoisted(() => ({
  sendPurchaseTicketsWhatsApp: vi.fn(),
  query: vi.fn(),
  connect: vi.fn(),
  clientQuery: vi.fn(),
  release: vi.fn(),
  generateVoucherQrcodes: vi.fn(),
  registerOpsAuditLog: vi.fn(),
  queuePurchaseConfirmationEmail: vi.fn(),
}));

vi.mock("@/lib/ingresso-db", () => ({
  getIngressoDbPool: () => ({
    query,
    connect,
  }),
  getIngressoSistemaDbPool: () => ({
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

vi.mock("@/lib/purchase-confirmation-email", () => ({
  queuePurchaseConfirmationEmail,
}));

vi.mock("@/lib/ticket-service", () => ({ sendPurchaseTicketsWhatsApp }));

describe("painel-bilheteria", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    connect.mockResolvedValue({
      query: clientQuery,
      release,
    });
  });

  it("releases the database connection before queuing a reservation email", async () => {
    clientQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM compra")) {
        return {
          rows: [{
            idcompra: 321,
            tpcompra: "reser",
            stcompra: "pend",
            vltotcompra: "60.00",
            dtpagamento: null,
          }],
        };
      }

      return { rows: [] };
    });
    registerOpsAuditLog.mockResolvedValue(17);
    queuePurchaseConfirmationEmail.mockResolvedValue({ status: "queued" });

    await expect(payPainelBilheteriaReservation({
      purchaseId: 321,
      payments: [{ method: "pix", value: "60.00" }],
    })).resolves.toMatchObject({ purchaseId: 321, status: "conc" });

    expect(release).toHaveBeenCalledTimes(1);
    expect(release.mock.invocationCallOrder[0]).toBeLessThan(
      queuePurchaseConfirmationEmail.mock.invocationCallOrder[0],
    );
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
              descricao: "Adulto - Meia",
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
        voucherTypeLabel: "Adulto - Meia",
        baseVoucherTypeLabel: "Adulto",
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
              descricao: "Adulto",
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
        typeLabel: "Adulto",
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
    expect(registerOpsAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        origem: "compra",
        acao: "editar",
        compraId: 321,
      }),
      "postgres",
    );
    expect(release).toHaveBeenCalled();
  });

  it("allows QR print for used voucher", async () => {
    clientQuery.mockImplementation(async (sql: string) => {
      if (sql === "BEGIN" || sql === "COMMIT") {
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
              descricao: "Adulto",
              dtvalidade: "2026-04-28",
              cpf: "52998224725",
              tpcompra: "bilhe",
              dtcompra: "2026-04-28",
            },
          ],
        };
      }

      if (sql.includes("SELECT agenda.dtagenda::text AS dtagenda")) {
        return {
          rows: [{ dtagenda: "2026-05-01" }],
        };
      }

      if (sql.includes("UPDATE voucher") || sql.includes("INSERT INTO logsistema")) {
        return { rows: [] };
      }

      return { rows: [] };
    });
    generateVoucherQrcodes.mockResolvedValue({
      12: "https://qr.example/12.png",
    });
    registerOpsAuditLog.mockResolvedValue(1001);

    await expect(getPainelBilheteriaVoucherPrintModel(12)).resolves.toMatchObject({
      purchaseId: 321,
      voucherId: 12,
      voucherNumber: "A1234",
      qrCodeUrl: "https://qr.example/12.png",
    });
    expect(generateVoucherQrcodes).toHaveBeenCalled();
    expect(release).toHaveBeenCalled();
  });

  it("keeps voucher printing available when QR generation is unavailable", async () => {
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
              descricao: "Adulto",
              dtvalidade: "2026-04-28",
              cpf: "52998224725",
              tpcompra: "bilhe",
              dtcompra: "2026-04-28",
            },
          ],
        };
      }

      if (sql.includes("FROM agenda")) {
        return {
          rows: [{ dtagenda: "2026-05-01" }],
        };
      }

      if (sql.includes("UPDATE voucher")) {
        return { rows: [] };
      }

      return { rows: [] };
    });
    generateVoucherQrcodes.mockRejectedValue(new Error("fetch failed"));
    registerOpsAuditLog.mockResolvedValue(1001);
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    await expect(getPainelBilheteriaVoucherPrintModel(12)).resolves.toMatchObject({
      purchaseId: 321,
      voucherId: 12,
      voucherNumber: "A1234",
      qrCodeUrl: null,
    });
    expect(generateVoucherQrcodes).toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "painel-bilheteria-print-qrcode-failed",
      expect.any(Error),
    );
    consoleErrorSpy.mockRestore();
    expect(release).toHaveBeenCalled();
  });
});


describe("operational voucher reissue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    connect.mockResolvedValue({ query: clientQuery, release });
    generateVoucherQrcodes.mockResolvedValue({ 12: "https://qr.example/12.png" });
    sendPurchaseTicketsWhatsApp.mockResolvedValue({ status: "sent" });
    clientQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM voucher")) return { rows: [{ idvoucher: 12, idcompra: 321, idagenda: 44, numvoucher: "A1234", tpvoucher: "norma", stusado: "n", dtvalidade: "2026-05-07", dtinicio_validade: "2026-05-01", parque_operacional: "rincao", vlunicompra: "49.90", descricao: "Adulto", cpf: "52998224725", tpcompra: "ponli", dtcompra: "2026-04-20" }] };
      if (sql.includes("FROM compra")) return { rows: [{ idcompra: 321, stcompra: "conc" }] };
      if (sql.includes("FROM agenda")) return { rows: [{ dtagenda: "2026-05-01" }] };
      return { rows: [] };
    });
  });
  it.each(["print", "whatsapp"])("blocks %s when a paid purchase is retained for capacity", async (operation) => {
    const original = clientQuery.getMockImplementation()!;
    clientQuery.mockImplementation(async (sql: string, ...args: unknown[]) => {
      if (sql.includes("online_capacity_reservations")) return { rows: [{ deliveryHold: true }] };
      return original(sql, ...args);
    });
    const action = operation === "print" ? getPainelBilheteriaVoucherPrintModel(12)
      : sendPainelBilheteriaVoucherWhatsapp({ purchaseId: 321, voucherId: 12, phoneNumber: "51999999999" });
    await expect(action).rejects.toMatchObject({ code: "online_capacity_delivery_hold", status: 409 });
    expect(generateVoucherQrcodes).not.toHaveBeenCalled();
    expect(sendPurchaseTicketsWhatsApp).not.toHaveBeenCalled();
  });

  it("prints the saved interval without rewriting its validity", async () => {
    await expect(getPainelBilheteriaVoucherPrintModel(12)).resolves.toMatchObject({ validFrom: "2026-05-01", validUntil: "2026-05-07" });
    expect(clientQuery.mock.calls.some(([sql]) => String(sql).includes("SET dtvalidade"))).toBe(false);
  });
  it("re-sends without rewriting the saved interval", async () => {
    await expect(sendPainelBilheteriaVoucherWhatsapp({ purchaseId: 321, voucherId: 12, phoneNumber: "51999999999" })).resolves.toMatchObject({ validUntil: "2026-05-07" });
    expect(clientQuery.mock.calls.some(([sql]) => String(sql).includes("SET dtvalidade"))).toBe(false);
  });
});
