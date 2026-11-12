import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePainelApiAccess = vi.fn();
const getOperationalCashSummary = vi.fn();
const asOperationalCashError = vi.fn();

vi.mock("@/lib/painel-api-auth", () => ({
  requirePainelApiAccess,
}));

vi.mock("@/lib/ops-cash-management", () => ({
  getOperationalCashSummary,
  asOperationalCashError,
}));

describe("ops/cash-summary BFF route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requirePainelApiAccess.mockResolvedValue({ ok: true, session: { actorName: "Gestor Teste", actorCpf: null, legacyRoleId: 1 } });
    asOperationalCashError.mockImplementation((error: Error) => error);
  });

  it("requires a panel session before querying cash", async () => {
    requirePainelApiAccess.mockResolvedValue({ ok: false, response: new Response(null, { status: 401 }) });
    const { GET } = await import("./route");
    const response = await GET(new Request("https://example.com/api/ops/cash-summary"));
    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(getOperationalCashSummary).not.toHaveBeenCalled();
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
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
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
