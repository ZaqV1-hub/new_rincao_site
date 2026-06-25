import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  invalidateSelectedVouchers,
  invalidatePurchaseVouchers,
  unvalidatePurchaseVouchers,
  unvalidateSelectedVouchers,
  validatePurchaseVouchers,
  validateSchoolTripVouchers,
  validateSelectedVouchers,
  validateVoucherByNumber,
} from "@/lib/ops-voucher-validation";

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

describe("ops-voucher-validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    connect.mockResolvedValue({
      query,
      release,
    });
    syncTicketValidation.mockResolvedValue({
      status: "sent",
      action: "validate",
      pairs: ["456-9001"],
    });
    registerOpsAuditLog.mockResolvedValue(901);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-23T15:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("validates a single online voucher by number", async () => {
    query.mockImplementation(async (sql: string) => {
      if (sql === "BEGIN" || sql === "COMMIT") {
        return { rows: [] };
      }

      if (sql.includes("WHERE voucher.numvoucher = $1")) {
        return {
          rows: [
            {
              idvoucher: 9001,
              numvoucher: "A1234",
              stusado: "n",
              dtuso: null,
              hruso: null,
              idcompra: 456,
              tpcompra: "ponli",
              stcompra: "conc",
              formapag: "pix",
              payment_status: 3,
              dtagenda: "2026-04-23",
              tpagenda: "padra",
            },
          ],
        };
      }

      return { rows: [] };
    });

    const result = await validateVoucherByNumber("A1234");

    expect(result).toEqual({
      action: "validate",
      mode: "voucher_number",
      processedCount: 1,
      affectedVoucherIds: [9001],
      warnings: [],
      message: "A1234 - Voucher Validado com sucesso! Entrada permitida",
    });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE voucher"),
      [9001, "2026-04-23", "12:00:00"],
    );
    expect(syncTicketValidation).toHaveBeenCalledWith(
      [{ purchaseId: 456, voucherId: 9001 }],
      "validate",
    );
    expect(registerOpsAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        origem: "voucher",
        acao: "validar",
        compraId: 456,
      }),
    );
  });

  it("rejects online validation outside the visit date without confirmation", async () => {
    query.mockImplementation(async (sql: string) => {
      if (sql === "BEGIN") {
        return { rows: [] };
      }

      if (sql === "ROLLBACK") {
        return { rows: [] };
      }

      if (sql.includes("WHERE voucher.numvoucher = $1")) {
        return {
          rows: [
            {
              idvoucher: 9001,
              numvoucher: "A1234",
              stusado: "n",
              dtuso: null,
              hruso: null,
              idcompra: 456,
              tpcompra: "ponli",
              stcompra: "conc",
              formapag: "pix",
              payment_status: 3,
              dtagenda: "2026-04-24",
              tpagenda: "padra",
            },
          ],
        };
      }

      return { rows: [] };
    });

    await expect(validateVoucherByNumber("A1234")).rejects.toMatchObject({
      code: "voucher_confirmation_required",
      status: 409,
    });
    expect(syncTicketValidation).not.toHaveBeenCalled();
  });

  it("validates a selection and reports skipped vouchers as warnings", async () => {
    query.mockImplementation(async (sql: string, values?: unknown[]) => {
      if (sql === "BEGIN" || sql === "COMMIT") {
        return { rows: [] };
      }

      if (sql.includes("WHERE voucher.idvoucher = ANY")) {
        expect(values).toEqual([[9001, 9002]]);

        return {
          rows: [
            {
              idvoucher: 9001,
              numvoucher: "A1234",
              stusado: "n",
              dtuso: null,
              hruso: null,
              idcompra: 456,
              tpcompra: "ponli",
              stcompra: "conc",
              formapag: "pix",
              payment_status: 3,
              dtagenda: "2026-04-23",
              tpagenda: "padra",
            },
            {
              idvoucher: 9002,
              numvoucher: "A9999",
              stusado: "s",
              dtuso: "2026-04-22",
              hruso: "09:00:00",
              idcompra: 456,
              tpcompra: "ponli",
              stcompra: "conc",
              formapag: "pix",
              payment_status: 3,
              dtagenda: "2026-04-23",
              tpagenda: "padra",
            },
          ],
        };
      }

      return { rows: [] };
    });

    const result = await validateSelectedVouchers([9001, 9002]);

    expect(result).toEqual({
      action: "validate",
      mode: "selection",
      processedCount: 1,
      affectedVoucherIds: [9001],
      warnings: ["Voucher A9999 ja utilizado ou indisponivel para validacao."],
      message: "1 voucher(s) validado(s) com sucesso.",
    });
  });

  it("unvalidates vouchers already marked as used", async () => {
    query.mockImplementation(async (sql: string) => {
      if (sql === "BEGIN" || sql === "COMMIT") {
        return { rows: [] };
      }

      if (sql.includes("WHERE voucher.idvoucher = ANY")) {
        return {
          rows: [
            {
              idvoucher: 9001,
              numvoucher: "A1234",
              stusado: "s",
              dtuso: "2026-04-23",
              hruso: "10:00:00",
              idcompra: 456,
              tpcompra: "ponli",
              stcompra: "conc",
              formapag: "pix",
              payment_status: 3,
              dtagenda: "2026-04-23",
              tpagenda: "padra",
            },
          ],
        };
      }

      return { rows: [] };
    });

    const result = await unvalidateSelectedVouchers([9001], {
      name: "Gestor Teste",
      cpf: "52998224725",
    });

    expect(result).toEqual({
      action: "unvalidate",
      mode: "selection",
      processedCount: 1,
      affectedVoucherIds: [9001],
      warnings: [],
      message: "1 voucher(s) desvalidado(s) com sucesso.",
    });
    expect(syncTicketValidation).toHaveBeenCalledWith(
      [{ purchaseId: 456, voucherId: 9001 }],
      "unvalidate",
    );
    expect(registerOpsAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        origem: "voucher",
        acao: "desvalidar",
        compraId: 456,
        usuarioNome: "Gestor Teste (52998224725)",
      }),
    );
  });

  it("validates only same-day vouchers in purchase mode without confirmation", async () => {
    query.mockImplementation(async (sql: string) => {
      if (sql === "BEGIN" || sql === "COMMIT") {
        return { rows: [] };
      }

      if (sql.includes("WHERE voucher.idcompra = $1")) {
        return {
          rows: [
            {
              idvoucher: 9001,
              numvoucher: "A1234",
              stusado: "n",
              dtuso: null,
              hruso: null,
              idcompra: 456,
              tpcompra: "ponli",
              stcompra: "conc",
              formapag: "pix",
              payment_status: 3,
              dtagenda: "2026-04-23",
              tpagenda: "padra",
            },
            {
              idvoucher: 9002,
              numvoucher: "A9999",
              stusado: "n",
              dtuso: null,
              hruso: null,
              idcompra: 456,
              tpcompra: "ponli",
              stcompra: "conc",
              formapag: "pix",
              payment_status: 3,
              dtagenda: "2026-04-24",
              tpagenda: "padra",
            },
          ],
        };
      }

      return { rows: [] };
    });

    const result = await validatePurchaseVouchers(456);

    expect(result).toEqual({
      action: "validate",
      mode: "purchase",
      processedCount: 1,
      affectedVoucherIds: [9001],
      warnings: ["Ignorados por data diferente: A9999."],
      skippedVoucherNumbers: ["A9999"],
      message: "Vouchers validados com sucesso! Entrada permitida.",
    });
  });

  it("unvalidates all used vouchers from a purchase", async () => {
    query.mockImplementation(async (sql: string, values?: unknown[]) => {
      if (sql === "BEGIN" || sql === "COMMIT") {
        return { rows: [] };
      }

      if (sql.includes("WHERE voucher.idcompra = $1")) {
        expect(values).toEqual([456]);

        return {
          rows: [
            {
              idvoucher: 9001,
              numvoucher: "A1234",
              stusado: "s",
              dtuso: "2026-04-23",
              hruso: "10:00:00",
              idcompra: 456,
              tpcompra: "ponli",
              stcompra: "conc",
              formapag: "pix",
              payment_status: 3,
              dtagenda: "2026-04-23",
              tpagenda: "padra",
            },
            {
              idvoucher: 9002,
              numvoucher: "A5678",
              stusado: "n",
              dtuso: null,
              hruso: null,
              idcompra: 456,
              tpcompra: "ponli",
              stcompra: "conc",
              formapag: "pix",
              payment_status: 3,
              dtagenda: "2026-04-23",
              tpagenda: "padra",
            },
          ],
        };
      }

      return { rows: [] };
    });

    const result = await unvalidatePurchaseVouchers(456, {
      name: "Gestor Teste",
    });

    expect(result).toEqual({
      action: "unvalidate",
      mode: "purchase",
      processedCount: 1,
      affectedVoucherIds: [9001],
      warnings: ["Voucher A5678 nao esta validado."],
      message: "Todos os vouchers validados da compra 456 foram desvalidados.",
    });
    expect(syncTicketValidation).toHaveBeenCalledWith(
      [{ purchaseId: 456, voucherId: 9001 }],
      "unvalidate",
    );
    expect(registerOpsAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        origem: "voucher",
        acao: "desvalidar",
        compraId: 456,
        usuarioNome: "Gestor Teste",
        detalhes: expect.objectContaining({
          mode: "purchase",
          affectedVoucherIds: [9001],
          warnings: ["Voucher A5678 nao esta validado."],
        }),
      }),
    );
  });

  it("validates school trip vouchers by school and agenda ids", async () => {
    query.mockImplementation(async (sql: string, values?: unknown[]) => {
      if (sql === "BEGIN" || sql === "COMMIT") {
        return { rows: [] };
      }

      if (sql.includes("WHERE voucher.idescola = $1")) {
        expect(values).toEqual([77, 88]);

        return {
          rows: [
            {
              idvoucher: 9001,
              numvoucher: "ESC-1001",
              stusado: "n",
              dtuso: null,
              hruso: null,
              idcompra: 456,
              tpcompra: "reser",
              stcompra: "conc",
              formapag: "dinh",
              payment_status: null,
              dtagenda: "2026-04-23",
              tpagenda: "escol",
              idescola: 77,
              idagenda: 88,
            },
          ],
        };
      }

      return { rows: [] };
    });

    const result = await validateSchoolTripVouchers(77, 88);

    expect(result).toEqual({
      action: "validate",
      mode: "school_trip",
      processedCount: 1,
      affectedVoucherIds: [9001],
      warnings: [],
      message: "Vouchers do passeio validados com sucesso! Entrada permitida.",
    });
  });

  it("invalidates selected vouchers and syncs invalidate with tickets", async () => {
    query.mockImplementation(async (sql: string) => {
      if (sql === "BEGIN" || sql === "COMMIT") {
        return { rows: [] };
      }

      if (sql.includes("WHERE voucher.idvoucher = ANY")) {
        return {
          rows: [
            {
              idvoucher: 9001,
              numvoucher: "A1234",
              stusado: "n",
              dtuso: null,
              hruso: null,
              idcompra: 456,
              tpcompra: "ponli",
              stcompra: "conc",
              formapag: "pix",
              payment_status: 3,
              dtagenda: "2026-04-23",
              tpagenda: "padra",
            },
          ],
        };
      }

      return { rows: [] };
    });

    const result = await invalidateSelectedVouchers([9001], {
      name: "Gestor Teste",
      cpf: "52998224725",
    });

    expect(result).toEqual({
      action: "invalidate",
      mode: "selection",
      processedCount: 1,
      affectedVoucherIds: [9001],
      warnings: [],
      message: "1 voucher(s) invalidado(s) com sucesso.",
    });
    expect(syncTicketValidation).toHaveBeenCalledWith(
      [{ purchaseId: 456, voucherId: 9001 }],
      "invalidate",
    );
    expect(registerOpsAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        origem: "voucher",
        acao: "invalidar",
        compraId: 456,
        usuarioNome: "Gestor Teste (52998224725)",
      }),
    );
  });

  it("persists audit context for school trip validation", async () => {
    query.mockImplementation(async (sql: string, values?: unknown[]) => {
      if (sql === "BEGIN" || sql === "COMMIT") {
        return { rows: [] };
      }

      if (sql.includes("WHERE voucher.idescola = $1")) {
        expect(values).toEqual([77, 88]);

        return {
          rows: [
            {
              idvoucher: 9001,
              numvoucher: "ESC-1001",
              stusado: "n",
              dtuso: null,
              hruso: null,
              idcompra: 456,
              tpcompra: "reser",
              stcompra: "conc",
              formapag: "dinh",
              payment_status: null,
              dtagenda: "2026-04-23",
              tpagenda: "escol",
              idescola: 77,
              idagenda: 88,
            },
          ],
        };
      }

      return { rows: [] };
    });

    await validateSchoolTripVouchers(77, 88, {
      name: "Gestor Escola",
    });

    expect(registerOpsAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        origem: "voucher",
        acao: "validar",
        compraId: 456,
        usuarioNome: "Gestor Escola",
        detalhes: expect.objectContaining({
          mode: "school_trip",
          schoolId: 77,
          agendaId: 88,
          affectedVoucherIds: [9001],
        }),
      }),
    );
  });

  it("invalidates all eligible vouchers from a purchase", async () => {
    query.mockImplementation(async (sql: string, values?: unknown[]) => {
      if (sql === "BEGIN" || sql === "COMMIT") {
        return { rows: [] };
      }

      if (sql.includes("WHERE voucher.idcompra = $1")) {
        expect(values).toEqual([456]);

        return {
          rows: [
            {
              idvoucher: 9001,
              numvoucher: "A1234",
              stusado: "n",
              dtuso: null,
              hruso: null,
              idcompra: 456,
              tpcompra: "ponli",
              stcompra: "conc",
              formapag: "pix",
              payment_status: 3,
              dtagenda: "2026-04-23",
              tpagenda: "padra",
            },
            {
              idvoucher: 9002,
              numvoucher: "A5678",
              stusado: "inv",
              dtuso: "2026-04-20",
              hruso: "09:00:00",
              idcompra: 456,
              tpcompra: "ponli",
              stcompra: "conc",
              formapag: "pix",
              payment_status: 3,
              dtagenda: "2026-04-23",
              tpagenda: "padra",
            },
          ],
        };
      }

      return { rows: [] };
    });

    const result = await invalidatePurchaseVouchers(456, {
      name: "Gestor Teste",
      cpf: "52998224725",
    });

    expect(result).toEqual({
      action: "invalidate",
      mode: "purchase",
      processedCount: 1,
      affectedVoucherIds: [9001],
      warnings: [],
      message: "Todos os vouchers elegiveis da compra 456 foram invalidados.",
    });
    expect(syncTicketValidation).toHaveBeenCalledWith(
      [{ purchaseId: 456, voucherId: 9001 }],
      "invalidate",
    );
  });
});
