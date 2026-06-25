import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticateOperationsRequest = vi.fn();
const syncOperationalPaymentStatuses = vi.fn();
const asOperationalPaymentSyncError = vi.fn();

vi.mock("@/lib/ops-auth", () => ({
  authenticateOperationsRequest,
}));

vi.mock("@/lib/ops-payment-sync", () => ({
  syncOperationalPaymentStatuses,
  asOperationalPaymentSyncError,
}));

describe("ops/jobs/payment-sync BFF route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateOperationsRequest.mockReturnValue({ ok: true });
    asOperationalPaymentSyncError.mockImplementation((error: Error) => error);
  });

  it("runs the operational payment sync job", async () => {
    syncOperationalPaymentStatuses.mockResolvedValue({
      action: "payment_sync",
      configured: true,
      candidates: 2,
      processed: 2,
      reconciled: 1,
      cancelled: 1,
      missing: 0,
      skipped: 0,
      failed: 0,
      items: [],
      message: "Reconciliacao operacional executada para 2 compra(s).",
    });

    const { POST } = await import("@/app/api/ops/jobs/payment-sync/route");
    const response = await POST(
      new Request("https://example.com/api/ops/jobs/payment-sync", {
        method: "POST",
        headers: {
          authorization: "Bearer ops-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          recentDays: 7,
          cancelAfterDays: 5,
          limit: 50,
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(authenticateOperationsRequest).toHaveBeenCalledWith(
      expect.any(Request),
      { requiredPermission: "ops.jobs" },
    );
    expect(syncOperationalPaymentStatuses).toHaveBeenCalledWith({
      recentDays: 7,
      cancelAfterDays: 5,
      limit: 50,
    });
    expect(body).toEqual({
      ok: true,
      data: {
        action: "payment_sync",
        configured: true,
        candidates: 2,
        processed: 2,
        reconciled: 1,
        cancelled: 1,
        missing: 0,
        skipped: 0,
        failed: 0,
        items: [],
        message: "Reconciliacao operacional executada para 2 compra(s).",
      },
    });
  });
});
