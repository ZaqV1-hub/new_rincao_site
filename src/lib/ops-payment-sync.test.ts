import { beforeEach, describe, expect, it, vi } from "vitest";
import { syncOperationalPaymentStatuses } from "@/lib/ops-payment-sync";

const {
  query,
  connect,
  release,
  isCieloEcommerceConfigured,
  getNativeCieloCheckoutStatus,
  reconcilePaymentFromGatewayPayload,
} = vi.hoisted(() => ({
  query: vi.fn(),
  connect: vi.fn(),
  release: vi.fn(),
  isCieloEcommerceConfigured: vi.fn(),
  getNativeCieloCheckoutStatus: vi.fn(),
  reconcilePaymentFromGatewayPayload: vi.fn(),
}));

vi.mock("@/lib/ingresso-db", () => ({
  getIngressoDbPool: () => ({
    connect,
  }),
}));

vi.mock("@/lib/cielo-ecommerce", () => ({
  isCieloEcommerceConfigured,
  getNativeCieloCheckoutStatus,
}));

vi.mock("@/lib/payment-reconciliation", () => ({
  reconcilePaymentFromGatewayPayload,
}));

describe("ops-payment-sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    connect.mockResolvedValue({
      query,
      release,
    });
  });

  it("returns a no-op response when Cielo is not configured", async () => {
    isCieloEcommerceConfigured.mockReturnValue(false);

    await expect(syncOperationalPaymentStatuses()).resolves.toEqual({
      action: "payment_sync",
      configured: false,
      candidates: 0,
      processed: 0,
      reconciled: 0,
      cancelled: 0,
      missing: 0,
      skipped: 0,
      failed: 0,
      items: [],
      message:
        "Integracao Cielo nao configurada; reconciliacao operacional em lote ignorada.",
    });

    expect(connect).not.toHaveBeenCalled();
  });

  it("reconciles pending payments and cancels stale purchases without payment id", async () => {
    isCieloEcommerceConfigured.mockReturnValue(true);

    query.mockImplementation(async (sql: string, values?: unknown[]) => {
      if (sql.includes("FROM compra") && sql.includes("LEFT JOIN LATERAL")) {
        expect(values).toEqual([7, 50]);

        return {
          rows: [
            {
              purchase_id: 321,
              purchase_date: "2026-04-22",
              purchase_status: "pend",
              payment_id: "payment-321",
              gateway_status: "1",
            },
            {
              purchase_id: 322,
              purchase_date: "2026-04-10",
              purchase_status: "pend",
              payment_id: null,
              gateway_status: null,
            },
          ],
        };
      }

      if (sql.includes("UPDATE compra") && values?.[0] === 322) {
        return { rows: [] };
      }

      return { rows: [] };
    });

    getNativeCieloCheckoutStatus.mockImplementation(async ({ purchaseId }: { purchaseId: number }) => {
      if (purchaseId === 321) {
        return {
          status: "00",
          dados: {
            reference: "321",
            status: 3,
          },
        };
      }

      return {
        status: "30",
        msgRetorno: "Transacao nao encontrada.",
      };
    });

    reconcilePaymentFromGatewayPayload.mockResolvedValue({
      purchaseId: 321,
      gatewayPaymentId: "payment-321",
      gatewayStatus: 3,
      purchaseStatus: "conc",
      ledgerAction: "updated",
    });

    await expect(
      syncOperationalPaymentStatuses({
        recentDays: 7,
        cancelAfterDays: 5,
        limit: 50,
      }),
    ).resolves.toEqual({
      action: "payment_sync",
      configured: true,
      candidates: 2,
      processed: 2,
      reconciled: 1,
      cancelled: 1,
      missing: 0,
      skipped: 0,
      failed: 0,
      items: [
        {
          purchaseId: 321,
          paymentId: "payment-321",
          result: "reconciled",
          purchaseStatus: "conc",
          gatewayStatus: 3,
          note: "Compra reconciliada com ledger updated.",
        },
        {
          purchaseId: 322,
          paymentId: null,
          result: "cancelled",
          purchaseStatus: "canc",
          gatewayStatus: null,
          note: "Compra pendente sem transacao localizada foi cancelada pelo job.",
        },
      ],
      message: "Reconciliacao operacional executada para 2 compra(s).",
    });
  });
});
