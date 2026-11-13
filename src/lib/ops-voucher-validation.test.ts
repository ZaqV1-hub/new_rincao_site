import type { PoolClient } from "pg";
import { markVoucherUsed as markVoucherUsedInCash } from "@/lib/ops-voucher-validation-shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  invalidateSelectedVouchers as invalidateSelectedVouchersInCash,
  invalidatePurchaseVouchers as invalidatePurchaseVouchersInCash,
  unvalidatePurchaseVouchers as unvalidatePurchaseVouchersInCash,
  unvalidateSelectedVouchers as unvalidateSelectedVouchersInCash,
  validatePurchaseVouchers as validatePurchaseVouchersInCash,
  validateSchoolTripVouchers as validateSchoolTripVouchersInCash,
  validateSelectedVouchers as validateSelectedVouchersInCash,
  validateVoucherByNumber as validateVoucherByNumberInCash,
} from "@/lib/ops-voucher-validation";

import { lockVoucherCashContext } from "@/lib/ops-voucher-validation-cash";
import type { CashSession } from "@/lib/operational-cash-session";
import type { VoucherOperationInputActor } from "@/lib/ops-voucher-validation-contract";
const periodId = 11;
function session(date: string): CashSession { return { id: periodId, park: "rincao", date, locationId: 1, locationName: "Portaria", type: "sales", openingCashCents: 0, openedAt: `${date}T10:00:00Z`, closedAt: null, openedBy: { name: "Operador", cpf: null }, closedBy: null, closureId: null, countedCashCents: null, automatic: false }; }
vi.mock("@/lib/operational-cash-session", () => ({
  CashSessionError: class extends Error {},
  lockOpenCashSession: async (client: PoolClient, input: { periodId: number; date: string }) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`operational-day:rincao:${input.date}`]);
    await client.query("SELECT id FROM caixa_periodos WHERE id=$1 FOR UPDATE", [input.periodId]);
    return session(input.date);
  },
}));
const validateVoucherByNumber = (number: string, confirm = false, actor?: VoucherOperationInputActor | null) => validateVoucherByNumberInCash(number, confirm, actor, periodId);
const validatePurchaseVouchers = (id: number, confirm = false, actor?: VoucherOperationInputActor | null) => validatePurchaseVouchersInCash(id, confirm, actor, periodId);
const validateSchoolTripVouchers = (school: number, agenda: number, actor?: VoucherOperationInputActor | null) => validateSchoolTripVouchersInCash(school, agenda, actor, periodId);
const validateSelectedVouchers = (ids: number[], actor?: VoucherOperationInputActor | null) => validateSelectedVouchersInCash(ids, actor, periodId);
const unvalidateSelectedVouchers = (ids: number[], actor?: VoucherOperationInputActor | null) => unvalidateSelectedVouchersInCash(ids, actor, periodId);
const invalidateSelectedVouchers = (ids: number[], actor?: VoucherOperationInputActor | null) => invalidateSelectedVouchersInCash(ids, actor, periodId);
const unvalidatePurchaseVouchers = (id: number, actor?: VoucherOperationInputActor | null) => unvalidatePurchaseVouchersInCash(id, actor, periodId);
const invalidatePurchaseVouchers = (id: number, actor?: VoucherOperationInputActor | null) => invalidatePurchaseVouchersInCash(id, actor, periodId);
async function markVoucherUsed(client: PoolClient, id: number, date: string, time: string) {
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(`${date}T15:00:00Z`));
  return markVoucherUsedInCash(client, id, date, time, await lockVoucherCashContext(client, periodId, date));
}

const {
  query,
  connect,
  release,
  syncTicketValidation,
  registerOpsAuditLog,
  ensureVoucherLifecycleSchema,
} = vi.hoisted(() => ({
  query: vi.fn(),
  connect: vi.fn(),
  release: vi.fn(),
  syncTicketValidation: vi.fn(),
  registerOpsAuditLog: vi.fn(),
  ensureVoucherLifecycleSchema: vi.fn(),
}));

vi.mock("@/lib/ingresso-db", () => ({
  getIngressoDbPool: () => ({
    connect,
  }),
  getIngressoSistemaDbPool: () => ({
    connect,
  }),
}));

vi.mock("@/lib/ticket-service", () => ({
  syncTicketValidation,
}));

vi.mock("@/lib/ops-audit-log", () => ({
  registerOpsAuditLog,
}));

vi.mock("@/lib/voucher-repository", () => ({
  ensureVoucherLifecycleSchema,
}));

describe("ops-voucher-validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    connect.mockResolvedValue({
      query: async (sql: string, ...args: unknown[]) => {
        const result = await query(sql, ...args);
        if (/^select idcompra, dtinicio_validade/.test(sql) && !result.rows.length) return { rows: [{ idcompra: null, stusado: "n" }] };
        return result;
      },
      release,
    });
    syncTicketValidation.mockResolvedValue({
      status: "sent",
      action: "validate",
      pairs: ["456-9001"],
    });
    registerOpsAuditLog.mockResolvedValue(901);
    ensureVoucherLifecycleSchema.mockResolvedValue(undefined);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-23T15:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    ["number", () => validateVoucherByNumber("TESTE")],
    ["selection", () => validateSelectedVouchers([1])],
    ["purchase", () => validatePurchaseVouchers(1)],
    ["school", () => validateSchoolTripVouchers(1, 1)],
  ])("locks the day then purchases before vouchers: %s", async (_name, execute) => {
    query.mockResolvedValue({ rows: [] });
    await expect(execute()).rejects.toBeInstanceOf(Error);
    const sql = query.mock.calls.map(([statement]) => String(statement));
    const dayLock = sql.findIndex((statement) => statement.includes("pg_advisory_xact_lock"));
    const purchaseLock = sql.findIndex((statement) => statement.includes("FOR UPDATE OF compra"));
    const voucherLock = sql.findIndex((statement) => statement.includes("FOR UPDATE OF voucher"));
    expect(dayLock).toBeGreaterThan(0);
    expect(purchaseLock).toBeGreaterThan(dayLock);
    expect(voucherLock).toBeGreaterThan(purchaseLock);
  });

  it.each([
    ["validate", validateSelectedVouchersInCash],
    ["unvalidate", unvalidateSelectedVouchersInCash],
  ] as const)("rejects every foreign, absent or other-park ID atomically in purchase-scoped %s", async (_action, mutate) => {
    for (const foreign of [
      { idvoucher: 9002, idcompra: 999, parque_operacional: "rincao", stusado: "inv" },
      { idvoucher: 9002, idcompra: 456, parque_operacional: "estancia", stusado: "inv" },
      null,
    ]) {
      vi.clearAllMocks();
      query.mockImplementation(async (sql: string) => ({ rows: sql.includes("FOR UPDATE OF voucher")
        ? [{ idvoucher: 9001, idcompra: 456, parque_operacional: "rincao", stusado: "inv" }, ...(foreign ? [foreign] : [])] : [] }));
      await expect(mutate([9001, 9002], null, periodId, 456)).rejects.toMatchObject({
        code: foreign?.parque_operacional === "estancia" ? "voucher_park_mismatch" : "voucher_purchase_mismatch", status: 409,
      });
      expect(query.mock.calls.some(([sql]) => String(sql).includes("UPDATE voucher"))).toBe(false);
      expect(query.mock.calls.some(([sql]) => sql === "ROLLBACK")).toBe(true);
      expect(registerOpsAuditLog).not.toHaveBeenCalled();
      expect(syncTicketValidation).not.toHaveBeenCalled();
    }
  });

  it("blocks an invalidated paid voucher without writing usage or syncing tickets", async () => {
    query.mockImplementation(async (sql: string) => ({ rows: sql.includes("WHERE voucher.numvoucher = $1")
      ? [{ idvoucher: 603884, numvoucher: "TESTE", stusado: "inv", tpcompra: "ponli", stcompra: "conc", payment_status: 3 }] : [] }));
    await expect(validateVoucherByNumber("TESTE")).rejects.toMatchObject({ code: "voucher_invalidated", status: 409 });
    expect(query.mock.calls.some(([sql]) => String(sql).includes("UPDATE voucher"))).toBe(false);
    expect(syncTicketValidation).not.toHaveBeenCalled();
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
      [9001, "2026-04-23", "12:00:00", periodId, null, null],
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
      "postgres",
    );
  });

  it("validates online voucher even when the visit date is different", async () => {
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

    const result = await validateVoucherByNumber("A1234");

    expect(result).toEqual({
      action: "validate",
      mode: "voucher_number",
      processedCount: 1,
      affectedVoucherIds: [9001],
      warnings: [],
      message: "A1234 - Voucher Validado com sucesso! Entrada permitida",
    });
    expect(syncTicketValidation).toHaveBeenCalledWith(
      [{ purchaseId: 456, voucherId: 9001 }],
      "validate",
    );
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
      warnings: ["Voucher A9999 ja utilizado em: 22/04/2026 09:00:00. Local: não registrado."],
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
      "postgres",
    );
  });

  it("validates all purchase vouchers even when the visit date is different", async () => {
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
      processedCount: 2,
      affectedVoucherIds: [9001, 9002],
      warnings: [],
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
      "postgres",
    );
  });

  it("validates school trip vouchers by school and agenda ids", async () => {
    query.mockImplementation(async (sql: string, values?: unknown[]) => {
      if (sql === "BEGIN" || sql === "COMMIT") {
        return { rows: [] };
      }

      if (sql.includes("WHERE voucher.idescola = $1")) {
        // PostgreSQL cannot lock the nullable payment/agenda sides of LEFT JOINs.
        expect(sql).toContain(sql.includes("LEFT JOIN") ? "FOR UPDATE OF voucher" : "FOR UPDATE OF compra");
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
      "postgres",
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
      "postgres",
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


describe("operational voucher validity", () => {
  const snapshot = {
    idvoucher: 9001, idcompra: 456, numvoucher: "A1234", stusado: "n",
    stvoucher: "ativo", dtcompra: "2026-04-01", tpcompra: "ponli",
    stcompra: "conc", payment_status: 3, dtagenda: "2026-04-20", tpagenda: "padra",
    dtinicio_validade: "2026-04-20", dtvalidade: "2026-04-26", parque_operacional: "rincao",
  };
  let row: typeof snapshot;
  let open: boolean;
  const client = { query } as unknown as PoolClient;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("OPERATIONAL_PARK_ID", "rincao");
    vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-04-23T15:00:00Z"));
    row = { ...snapshot };
    open = true;
    connect.mockResolvedValue({ query, release });
    syncTicketValidation.mockResolvedValue({ status: "sent" });
    query.mockImplementation(async (sql: string) => {
      if (sql.includes("WHERE voucher.numvoucher = $1") || sql.includes("WHERE voucher.idvoucher = ANY") || sql.includes("WHERE voucher.idcompra = $1") || /select .*idcompra[\s\S]*from voucher where idvoucher/i.test(sql)) return { rows: [row] };
      if (sql.includes("FROM agenda") && sql.includes("operacao_dias")) return { rows: open ? [{ idagenda: 44 }] : [] };
      if (sql.includes("UPDATE voucher")) { row.stusado = "s"; return { rows: [], rowCount: 1 }; }
      return { rows: [], rowCount: 0 };
    });
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

  it.each(["2026-04-20", "2026-04-23", "2026-04-26"])("accepts an open day inside the inclusive snapshot: %s", async (date) => {
    await markVoucherUsed(client, 9001, date, "12:00:00");
    expect(row.stusado).toBe("s");
    const lockIndex = query.mock.calls.findIndex(([sql]) => String(sql).includes("pg_advisory_xact_lock"));
    const openIndex = query.mock.calls.findIndex(([sql]) => String(sql).includes("FROM agenda"));
    expect(lockIndex).toBeGreaterThan(-1);
    expect(openIndex).toBeGreaterThan(lockIndex);
    expect(query).toHaveBeenCalledWith(expect.stringContaining("UPDATE voucher"), [9001, date, "12:00:00", periodId, null, null]);
  });

  it.each([
    ["2026-04-19", "voucher_not_yet_valid"],
    ["2026-04-27", "voucher_expired"],
  ])("rejects outside the snapshot on %s", async (date, code) => {
    await expect(markVoucherUsed(client, 9001, date, "12:00:00")).rejects.toMatchObject({ code });
    expect(row.stusado).toBe("n");
  });

  it("rejects a closed day or a date without day use", async () => {
    open = false;
    await expect(markVoucherUsed(client, 9001, "2026-04-23", "12:00:00")).rejects.toMatchObject({ code: "voucher_day_closed" });
    expect(row.stusado).toBe("n");
  });

  it.each([
    { parque_operacional: "estancia" }, { dtvalidade: "" },
    { dtinicio_validade: "2026-04-31" }, { dtvalidade: "2026-04-19" },
  ])("rejects an invalid snapshot %j", async (change) => {
    Object.assign(row, change);
    await expect(markVoucherUsed(client, 9001, "2026-04-23", "12:00:00")).rejects.toMatchObject({ code: "voucher_validity_invalid" });
    expect(row.stusado).toBe("n");
  });

  it("allows a snapshot voucher only once", async () => {
    await markVoucherUsed(client, 9001, "2026-04-23", "12:00:00");
    await expect(markVoucherUsed(client, 9001, "2026-04-23", "12:01:00")).rejects.toMatchObject({ code: "voucher_already_used" });
  });

  it.each([false, true])("never bypasses snapshot expiry with confirm=%s", async (confirm) => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-04-27T15:00:00Z"));
    await expect(validateVoucherByNumber("A1234", confirm)).rejects.toMatchObject({ code: "voucher_expired" });
    expect(row.stusado).toBe("n");
    expect(syncTicketValidation).not.toHaveBeenCalled();
  });

  it.each(["selection", "purchase"])("protects paid reservations through %s validation", async (mode) => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-04-23T15:00:00Z"));
    Object.assign(row, { tpcompra: "reser", formapag: "pix" }); open = false;
    const operation = mode === "selection" ? validateSelectedVouchers([9001]) : validatePurchaseVouchers(456);
    await expect(operation).rejects.toMatchObject({ code: "voucher_day_closed" });
    expect(row.stusado).toBe("n");
  });

  it("does not admit a confirmed payment retained for online capacity", async () => {
    const original = query.getMockImplementation()!;
    query.mockImplementation(async (sql: string, ...args: unknown[]) => {
      if (sql.includes("online_capacity_reservations")) return { rows: [{ deliveryHold: true }] };
      return original(sql, ...args);
    });
    await expect(markVoucherUsed(client, 9001, "2026-04-23", "12:00:00")).rejects.toMatchObject({ code: "online_capacity_delivery_hold", status: 409 });
    expect(row.stusado).toBe("n");
  });

  it("still refuses a payment held for school review", async () => {
    const original = query.getMockImplementation()!;
    query.mockImplementation(async (sql: string, ...args: unknown[]) => {
      if (sql.includes("to_regclass")) return { rows: [{ regclass: "commerce_school_payment_hold" }] };
      if (sql.includes("select status,source from commerce_school_payment_hold")) return { rows: [{ status: "held", source: "site" }] };
      return original(sql, ...args);
    });
    await expect(markVoucherUsed(client, 9001, "2026-04-23", "12:00:00")).rejects.toMatchObject({ code: "school_payment_held" });
    expect(row.stusado).toBe("n");
  });

  it("preserves the explicit expired legacy confirmation", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-01T15:00:00Z"));
    Object.assign(row, { dtinicio_validade: null, parque_operacional: null });
    await expect(validateVoucherByNumber("A1234")).rejects.toMatchObject({ code: "voucher_expired_confirmation_required" });
    await expect(validateVoucherByNumber("A1234", true)).resolves.toMatchObject({ processedCount: 1 });
  });
});
