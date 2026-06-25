import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticateOperationsRequest = vi.fn();
const getOperationalCashSummary = vi.fn();
const asOperationalCashError = vi.fn();

vi.mock("@/lib/ops-auth", () => ({
  authenticateOperationsRequest,
}));

vi.mock("@/lib/ops-cash-management", () => ({
  getOperationalCashSummary,
  asOperationalCashError,
}));

describe("ops/cash-summary BFF route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateOperationsRequest.mockReturnValue({ ok: true });
    asOperationalCashError.mockImplementation((error: Error) => error);
  });

  it("returns the current cash summary", async () => {
    getOperationalCashSummary.mockResolvedValue({
      period: {
        id: 7,
        openedAt: "2026-04-23 08:00:00+00",
        closedAt: null,
        operator: null,
        closureSheetId: null,
      },
      funds: [],
      sangrias: [],
      totals: {
        cashSales: "320.00",
        fund: "50.00",
        sangria: "10.00",
        cashInDrawer: "360.00",
      },
    });

    const { GET } = await import("@/app/api/ops/cash-summary/route");
    const response = await GET(
      new Request("https://example.com/api/ops/cash-summary", {
        headers: {
          authorization: "Bearer ops-token",
        },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      data: {
        period: {
          id: 7,
          openedAt: "2026-04-23 08:00:00+00",
          closedAt: null,
          operator: null,
          closureSheetId: null,
        },
        funds: [],
        sangrias: [],
        totals: {
          cashSales: "320.00",
          fund: "50.00",
          sangria: "10.00",
          cashInDrawer: "360.00",
        },
      },
    });
  });

  it("returns the normalized domain error", async () => {
    getOperationalCashSummary.mockRejectedValue(
      Object.assign(new Error("unavailable"), {
        code: "ops_cash_unavailable",
        status: 502,
        message: "Nao foi possivel operar o caixa agora.",
      }),
    );

    const { GET } = await import("@/app/api/ops/cash-summary/route");
    const response = await GET(
      new Request("https://example.com/api/ops/cash-summary", {
        headers: {
          authorization: "Bearer ops-token",
        },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body).toEqual({
      ok: false,
      error: {
        code: "ops_cash_unavailable",
        message: "Nao foi possivel operar o caixa agora.",
      },
    });
  });
});
