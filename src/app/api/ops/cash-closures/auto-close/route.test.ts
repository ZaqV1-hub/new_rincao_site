import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticateOperationsRequest = vi.fn();
const autoCloseOperationalCashClosures = vi.fn();
const asOperationalCashClosureError = vi.fn();

vi.mock("@/lib/ops-auth", () => ({
  authenticateOperationsRequest,
}));

vi.mock("@/lib/ops-cash-closures", () => ({
  autoCloseOperationalCashClosures,
  asOperationalCashClosureError,
}));

describe("ops/cash-closures/auto-close BFF route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateOperationsRequest.mockReturnValue({ ok: true });
    asOperationalCashClosureError.mockImplementation((error: Error) => error);
  });

  it("auto closes stale cash periods", async () => {
    autoCloseOperationalCashClosures.mockResolvedValue({
      action: "auto_close",
      closedCount: 1,
      closedPeriodIds: [6],
      closureIds: [55],
      currentSummary: {
        period: {
          id: 7,
          openedAt: "2026-04-23 03:00:00+00",
          closedAt: null,
          operator: null,
          closureSheetId: null,
        },
        funds: [],
        sangrias: [],
        totals: {
          cashSales: "0.00",
          fund: "0.00",
          sangria: "0.00",
          cashInDrawer: "0.00",
        },
      },
      auditLogIds: [981],
      message: "1 periodo(s) anterior(es) fechados automaticamente.",
    });

    const { POST } = await import("@/app/api/ops/cash-closures/auto-close/route");
    const response = await POST(
      new Request("https://example.com/api/ops/cash-closures/auto-close", {
        method: "POST",
        headers: {
          authorization: "Bearer ops-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          reason: "Virada do dia no BFF",
          actor: {
            name: "Sistema",
          },
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(autoCloseOperationalCashClosures).toHaveBeenCalledWith({
      reason: "Virada do dia no BFF",
      actor: {
        name: "Sistema",
        cpf: null,
      },
    });
    expect(body).toEqual({
      ok: true,
      data: {
        action: "auto_close",
        closedCount: 1,
        closedPeriodIds: [6],
        closureIds: [55],
        currentSummary: {
          period: {
            id: 7,
            openedAt: "2026-04-23 03:00:00+00",
            closedAt: null,
            operator: null,
            closureSheetId: null,
          },
          funds: [],
          sangrias: [],
          totals: {
            cashSales: "0.00",
            fund: "0.00",
            sangria: "0.00",
            cashInDrawer: "0.00",
          },
        },
        auditLogIds: [981],
        message: "1 periodo(s) anterior(es) fechados automaticamente.",
      },
    });
  });
});
