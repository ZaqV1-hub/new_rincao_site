import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePainelApiAccess = vi.fn();
const getOperationalCashClosureDetail = vi.fn();
const asOperationalCashClosureError = vi.fn();

vi.mock("@/lib/painel-api-auth", () => ({
  requirePainelApiAccess,
}));

vi.mock("@/lib/ops-cash-closures", () => ({
  getOperationalCashClosureDetail,
  asOperationalCashClosureError,
}));

describe("ops/cash-closures/[closureId] BFF route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requirePainelApiAccess.mockResolvedValue({ ok: true, session: { actorName: "Gestor Teste", actorCpf: null, legacyRoleId: 1 } });
    asOperationalCashClosureError.mockImplementation((error: Error) => error);
  });

  it("requires a panel session before querying historical detail", async () => {
    requirePainelApiAccess.mockResolvedValue({ ok: false, response: new Response(null, { status: 401 }) });
    const { GET } = await import("./route");
    const response = await GET(new Request("https://example.com/api/ops/cash-closures/44"), { params: Promise.resolve({ closureId: "44" }) });
    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(getOperationalCashClosureDetail).not.toHaveBeenCalled();
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
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
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
