import { beforeEach, describe, expect, it, vi } from "vitest";
import { markCieloPortalCancelled } from "@/lib/cielo-portal-cancellation";

const { query, connect, release, registerOpsAuditLog, syncTicketValidation, cancelCodindicaCashback } = vi.hoisted(() => ({
  query: vi.fn(), connect: vi.fn(), release: vi.fn(), registerOpsAuditLog: vi.fn(),
  syncTicketValidation: vi.fn(), cancelCodindicaCashback: vi.fn(),
}));
vi.mock("@/lib/ingresso-db", () => ({ getIngressoSistemaDbPool: () => ({ connect }) }));
vi.mock("@/lib/ops-audit-log", () => ({ registerOpsAuditLog }));
vi.mock("@/lib/ticket-service", () => ({ syncTicketValidation }));
vi.mock("@/lib/codindica-cashback", () => ({ cancelCodindicaCashback }));

const input = {
  purchaseId: 193338,
  paymentId: "8db9a07a-9a96-4ccb-96eb-f03582de6c6c",
  amount: 210,
  evidence: "Portal Cielo: venda 193338 cancelada total",
};

describe("Cielo portal cancellation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    connect.mockResolvedValue({ query, release });
    registerOpsAuditLog.mockResolvedValue(42);
    syncTicketValidation.mockResolvedValue({ status: "sent" });
    cancelCodindicaCashback.mockResolvedValue(undefined);
    query.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM compra")) return { rows: [{ idcompra: 193338, stcompra: "conc", tpcompra: "ponli", formapag: "pgseg", vltotcompra: "210.00" }] };
      if (sql.includes("FROM pagpagseguro")) return { rows: [{ idpagseguro: input.paymentId, status: 3, cancellation_source: null }] };
      if (sql.includes("FROM voucher")) return { rows: [{ idvoucher: 10, stusado: "n" }, { idvoucher: 11, stusado: "n" }] };
      return { rows: [] };
    });
  });

  it("blocks the purchase and vouchers, records evidence and syncs tickets", async () => {
    await expect(markCieloPortalCancelled(input)).resolves.toMatchObject({
      purchaseId: 193338, status: "canc", invalidatedVoucherIds: [10, 11], auditLogId: 42,
    });
    expect(query.mock.calls.some(([sql]) => String(sql).includes("UPDATE compra SET stcompra = 'canc'"))).toBe(true);
    expect(query.mock.calls.some(([sql]) => String(sql).includes('"cancellationSource" = $2'))).toBe(true);
    expect(query.mock.calls.some(([sql]) => String(sql).includes("UPDATE voucher SET stusado = 'inv'"))).toBe(true);
    expect(syncTicketValidation).toHaveBeenCalledWith([
      { purchaseId: 193338, voucherId: 10 }, { purchaseId: 193338, voucherId: 11 },
    ], "invalidate");
    expect(cancelCodindicaCashback).toHaveBeenCalledWith(193338);
  });

  it("rejects a mismatched amount without changing the purchase", async () => {
    await expect(markCieloPortalCancelled({ ...input, amount: 209 })).rejects.toMatchObject({ code: "portal_cancellation_mismatch" });
    expect(query.mock.calls.some(([sql]) => String(sql).includes("UPDATE compra"))).toBe(false);
    expect(query).toHaveBeenCalledWith("ROLLBACK");
    expect(syncTicketValidation).not.toHaveBeenCalled();
  });
});
