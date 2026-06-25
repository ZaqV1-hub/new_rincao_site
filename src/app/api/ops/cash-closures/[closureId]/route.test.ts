import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticateOperationsRequest = vi.fn();
const getOperationalCashClosureDetail = vi.fn();
const asOperationalCashClosureError = vi.fn();

vi.mock("@/lib/ops-auth", () => ({
  authenticateOperationsRequest,
}));

vi.mock("@/lib/ops-cash-closures", () => ({
  getOperationalCashClosureDetail,
  asOperationalCashClosureError,
}));

describe("ops/cash-closures/[closureId] BFF route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateOperationsRequest.mockReturnValue({ ok: true });
    asOperationalCashClosureError.mockImplementation((error: Error) => error);
  });

  it("returns the closure detail", async () => {
    getOperationalCashClosureDetail.mockResolvedValue({
      id: 44,
      periodId: 7,
      openedAt: "2026-04-22 08:00:00+00",
      closedAt: "2026-04-22 18:00:00+00",
      operator: "Gestor Teste",
      totals: {
        cash: "320.00",
        fund: "50.00",
        overall: "470.00",
      },
      createdAt: "2026-04-22 18:00:00+00",
      snapshot: {
        period: {
          ini: "2026-04-22 08:00:00+00",
          fim: "2026-04-22 18:00:00+00",
        },
      },
    });

    const { GET } = await import("@/app/api/ops/cash-closures/[closureId]/route");
    const response = await GET(
      new Request("https://example.com/api/ops/cash-closures/44", {
        headers: {
          authorization: "Bearer ops-token",
        },
      }),
      {
        params: Promise.resolve({ closureId: "44" }),
      },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(getOperationalCashClosureDetail).toHaveBeenCalledWith(44);
    expect(body).toEqual({
      ok: true,
      data: {
        id: 44,
        periodId: 7,
        openedAt: "2026-04-22 08:00:00+00",
        closedAt: "2026-04-22 18:00:00+00",
        operator: "Gestor Teste",
        totals: {
          cash: "320.00",
          fund: "50.00",
          overall: "470.00",
        },
        createdAt: "2026-04-22 18:00:00+00",
        snapshot: {
          period: {
            ini: "2026-04-22 08:00:00+00",
            fim: "2026-04-22 18:00:00+00",
          },
        },
      },
    });
  });
});
