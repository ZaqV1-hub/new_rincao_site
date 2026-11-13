import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getPainelBilheteriaPurchaseDetail,
  getPainelBilheteriaPurchasePrintModel,
  getPainelBilheteriaVoucherPrintModel,
  payPainelBilheteriaReservation,
  sendPainelBilheteriaVoucherWhatsapp,
} from "@/lib/painel-bilheteria";

const { cashCommand, cashLock, sendPurchaseTicketsWhatsApp, query, connect, clientQuery, release, generateLocalVoucherQrCodes, registerOpsAuditLog, queuePurchaseConfirmationEmail } = vi.hoisted(() => ({
  cashCommand: vi.fn(), cashLock: vi.fn(),
  sendPurchaseTicketsWhatsApp: vi.fn(),
  query: vi.fn(),
  connect: vi.fn(),
  clientQuery: vi.fn(),
  release: vi.fn(),
  generateLocalVoucherQrCodes: vi.fn(),
  registerOpsAuditLog: vi.fn(),
  queuePurchaseConfirmationEmail: vi.fn(),
}));

vi.mock("@/lib/operational-cash-session", () => ({ withCashSessionCommand: cashCommand, lockOpenCashSession: cashLock, CashSessionError: class extends Error {} }));
vi.mock("@/lib/ingresso-db", () => ({
  getIngressoSistemaDbDialect: () => "postgres",
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
  generateLocalVoucherQrCodes,
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
  ensureOpsAuditLogTable: async () => {},
  registerOpsAuditLog,
}));

vi.mock("@/lib/purchase-confirmation-email", () => ({
  queuePurchaseConfirmationEmail,
}));

vi.mock("@/lib/ticket-service", () => ({ sendPurchaseTicketsWhatsApp }));

describe("painel-bilheteria", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cashCommand.mockImplementation(async (_client, _input, run) => (await run()).response);
    cashLock.mockResolvedValue({ id: 55, park: "rincao", date: "2099-01-01", type: "sales" });
    connect.mockResolvedValue({
      query: clientQuery,
      release,
    });
  });

  it("releases the database connection before queuing a reservation email", async () => {
    clientQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('AS "isCurrentCashDate"')) return { rows: [{ isCurrentCashDate: true }] };
      if (sql.includes("FROM compra WHERE")) {
        return {
          rows: [{
            idcompra: 321, cpf: "52998224725", formapag: "N/A",
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
      purchaseId: 321, periodId: 55, idempotencyKey: "reservation-test-321",
      payments: [{ method: "pix", value: "60.00" }],
    })).resolves.toMatchObject({ purchaseId: 321, status: "conc" });

    expect(release).toHaveBeenCalledTimes(1);
    expect(release.mock.invocationCallOrder[0]).toBeLessThan(
      queuePurchaseConfirmationEmail.mock.invocationCallOrder[0],
    );
  });

  it("returns voucher editing metadata for history detail", async () => {
    query.mockImplementation(async (sql: string, values?: unknown[]) => {
      if (sql.includes('AS "isCurrentCashDate"')) return { rows: [{ isCurrentCashDate: true }] };
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

  it("returns a single voucher print model preserving legacy validity", async () => {
    clientQuery.mockImplementation(async (sql: string, values?: unknown[]) => {
      if (sql.includes('AS "isCurrentCashDate"')) return { rows: [{ isCurrentCashDate: true }] };
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
    generateLocalVoucherQrCodes.mockResolvedValue({
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
        validUntil: "2026-04-28",
        qrCodeUrl: "https://qr.example/12.png",
      }),
    );
    expect(generateLocalVoucherQrCodes).toHaveBeenCalledWith([
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
        origem: "voucher",
        acao: "imprimir",
        compraId: 321,
      }),
      "postgres",
    );
    expect(release).toHaveBeenCalled();
  });

  it("allows QR print for used voucher", async () => {
    clientQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('AS "isCurrentCashDate"')) return { rows: [{ isCurrentCashDate: true }] };
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
    generateLocalVoucherQrCodes.mockResolvedValue({
      12: "https://qr.example/12.png",
    });
    registerOpsAuditLog.mockResolvedValue(1001);

    await expect(getPainelBilheteriaVoucherPrintModel(12)).resolves.toMatchObject({
      purchaseId: 321,
      voucherId: 12,
      voucherNumber: "A1234",
      qrCodeUrl: "https://qr.example/12.png",
    });
    expect(generateLocalVoucherQrCodes).toHaveBeenCalled();
    expect(release).toHaveBeenCalled();
  });

  it("keeps voucher printing available when QR generation is unavailable", async () => {
    clientQuery.mockImplementation(async (sql: string, values?: unknown[]) => {
      if (sql.includes('AS "isCurrentCashDate"')) return { rows: [{ isCurrentCashDate: true }] };
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
    generateLocalVoucherQrCodes.mockRejectedValue(new Error("fetch failed"));
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
    expect(generateLocalVoucherQrCodes).toHaveBeenCalled();
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
    cashCommand.mockImplementation(async (_client, _input, run) => (await run()).response);
    cashLock.mockResolvedValue({ id: 55, park: "rincao", date: "2099-01-01", type: "sales" });
    connect.mockResolvedValue({ query: clientQuery, release });
    generateLocalVoucherQrCodes.mockResolvedValue({ 12: "https://qr.example/12.png" });
    sendPurchaseTicketsWhatsApp.mockResolvedValue({ status: "sent" });
    clientQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('AS "isCurrentCashDate"')) return { rows: [{ isCurrentCashDate: true }] };
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
    expect(generateLocalVoucherQrCodes).not.toHaveBeenCalled();
    expect(sendPurchaseTicketsWhatsApp).not.toHaveBeenCalled();
  });
  it.each(["print", "whatsapp"])("blocks %s for an explicitly different park", async (operation) => {
    const original = clientQuery.getMockImplementation()!;
    clientQuery.mockImplementation(async (sql: string, ...args: unknown[]) => {
      const result = await original(sql, ...args);
      if (sql.includes("FROM voucher")) return { rows: result.rows.map((row: Record<string, unknown>) => ({ ...row, parque_operacional: "estancia" })) };
      return result;
    });
    const action = operation === "print" ? getPainelBilheteriaVoucherPrintModel(12)
      : sendPainelBilheteriaVoucherWhatsapp({ purchaseId: 321, voucherId: 12, phoneNumber: "51999999999" });
    await expect(action).rejects.toMatchObject({ code: "voucher_park_mismatch", status: 409 });
    expect(generateLocalVoucherQrCodes).not.toHaveBeenCalled(); expect(sendPurchaseTicketsWhatsApp).not.toHaveBeenCalled();
  });

  it.each(["print", "whatsapp"])("preserves missing legacy validity during %s and keeps phone out of audit", async (operation) => {
    const original = clientQuery.getMockImplementation()!;
    clientQuery.mockImplementation(async (sql: string, ...args: unknown[]) => {
      const result = await original(sql, ...args);
      if (sql.includes("FROM voucher")) return { rows: result.rows.map((row: Record<string, unknown>) => ({ ...row, dtinicio_validade: null, dtvalidade: null })) };
      return result;
    });
    const result = operation === "print" ? await getPainelBilheteriaVoucherPrintModel(12)
      : await sendPainelBilheteriaVoucherWhatsapp({ purchaseId: 321, voucherId: 12, phoneNumber: "51999999999" });
    expect(result.validUntil).toBe("");
    expect(clientQuery.mock.calls.some(([sql]) => /UPDATE voucher|SET dtvalidade/.test(String(sql)))).toBe(false);
    expect(JSON.stringify(registerOpsAuditLog.mock.calls)).not.toContain("51999999999");
    if (operation === "whatsapp") expect(sendPurchaseTicketsWhatsApp).toHaveBeenCalledWith(321, [12], "51999999999");
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


describe("selected purchase printing", () => {
  beforeEach(() => { vi.clearAllMocks(); });
  it.each([true, false])("prints only the validated selection in stable order (selected=%s)", async (selected) => {
    query.mockResolvedValueOnce({ rows: [{ idcompra: 321 }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ idvoucher: 12, parque_operacional: null }, { idvoucher: 13, parque_operacional: "rincao" }], rowCount: 2 });
    connect.mockResolvedValue({ query: clientQuery, release });
    clientQuery.mockImplementation(async (sql: string, values?: unknown[]) => {
      if (sql.includes("FROM voucher") && sql.includes("JOIN compra")) return { rows: [{
        idvoucher: values?.[0], idcompra: 321, tpvoucher: "norma", dtvalidade: "2026-01-01", parque_operacional: null,
      }] };
      return { rows: [] };
    });
    generateLocalVoucherQrCodes.mockResolvedValue({ 12: "data:image/png;base64,test", 13: "data:image/png;base64,test" });
    const result = await getPainelBilheteriaPurchasePrintModel(321, null, selected ? [13,12] : undefined);
    expect(result.vouchers.map((row) => row.voucherId)).toEqual([12,13]);
    expect(generateLocalVoucherQrCodes).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[1][1]).toEqual(selected ? [321,[13,12]] : [321]);
    expect(clientQuery.mock.calls.some(([sql]) => String(sql).includes("UPDATE voucher"))).toBe(false);
    expect(registerOpsAuditLog.mock.calls.every(([, entry]) => entry.origem === "voucher" && entry.acao === "imprimir")).toBe(true);
  });
  it("generates the real local QR without any HTTP request", async () => {
    const actual = await vi.importActual<typeof import("@/lib/ticket-api")>("@/lib/ticket-api");
    const fetchMock = vi.fn(() => { throw new Error("HTTP is forbidden while printing"); });
    vi.stubGlobal("fetch", fetchMock);
    try {
      query.mockResolvedValueOnce({ rows: [{ idcompra: 321 }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ idvoucher: 12, parque_operacional: null }], rowCount: 1 });
      connect.mockResolvedValue({ query: clientQuery, release });
      clientQuery.mockImplementation(async (sql: string) => sql.includes("FROM voucher") && sql.includes("JOIN compra")
        ? { rows: [{ idvoucher: 12, idcompra: 321, tpvoucher: "norma", dtvalidade: "2026-01-01", cpf: "52998224725" }] }
        : { rows: [] });
      generateLocalVoucherQrCodes.mockImplementation(actual.generateLocalVoucherQrCodes);
      const result = await getPainelBilheteriaPurchasePrintModel(321,null,[12]);
      expect(result.vouchers[0].qrCodeUrl).toMatch(/^data:image\/png;base64,/);
      expect(fetchMock).not.toHaveBeenCalled();
      expect(generateLocalVoucherQrCodes).toHaveBeenCalledWith([expect.objectContaining({ purchaseId: 321, voucherId: 12 })]);
    } finally { vi.unstubAllGlobals(); }
  });
  it.each([[[]], [[12,12]], [[0]], [[Number.MAX_SAFE_INTEGER+1]]])("rejects invalid selection %j before database or QR", async (ids) => {
    await expect(getPainelBilheteriaPurchasePrintModel(321, null, ids)).rejects.toMatchObject({ code: "invalid_voucher_selection" });
    expect(query).not.toHaveBeenCalled(); expect(generateLocalVoucherQrCodes).not.toHaveBeenCalled();
  });
  it.each([
    [[{ idvoucher: 12, parque_operacional: "rincao" }], "invalid_voucher_selection"],
    [[{ idvoucher: 12, parque_operacional: "rincao" }, { idvoucher: 13, parque_operacional: "estancia" }], "voucher_park_mismatch"],
  ])("validates every selected item before generating any QR", async (rows, code) => {
    query.mockResolvedValueOnce({ rows: [{ idcompra: 321 }], rowCount: 1 }).mockResolvedValueOnce({ rows, rowCount: rows.length });
    await expect(getPainelBilheteriaPurchasePrintModel(321, null, [12,13])).rejects.toMatchObject({ code });
    expect(generateLocalVoucherQrCodes).not.toHaveBeenCalled(); expect(connect).not.toHaveBeenCalled();
  });
});
