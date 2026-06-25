import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticateOperationsRequest = vi.fn();
const closeOperationalCashClosure = vi.fn();
const listOperationalCashClosures = vi.fn();
const asOperationalCashClosureError = vi.fn();

vi.mock("@/lib/ops-auth", () => ({
  authenticateOperationsRequest,
}));

vi.mock("@/lib/ops-cash-closures", () => ({
  closeOperationalCashClosure,
  listOperationalCashClosures,
  asOperationalCashClosureError,
}));

describe("ops/cash-closures BFF route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateOperationsRequest.mockReturnValue({ ok: true });
    asOperationalCashClosureError.mockImplementation((error: Error) => error);
  });

  it("returns the paginated closure history", async () => {
    listOperationalCashClosures.mockResolvedValue({
      items: [
        {
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
        },
      ],
      meta: {
        limit: 10,
        offset: 0,
        total: 1,
      },
    });

    const { GET } = await import("@/app/api/ops/cash-closures/route");
    const response = await GET(
      new Request("https://example.com/api/ops/cash-closures?limit=10&offset=0", {
        headers: {
          authorization: "Bearer ops-token",
        },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(listOperationalCashClosures).toHaveBeenCalledWith({
      limit: 10,
      offset: 0,
    });
    expect(body).toEqual({
      ok: true,
      data: {
        items: [
          {
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
          },
        ],
        meta: {
          limit: 10,
          offset: 0,
          total: 1,
        },
      },
    });
  });

  it("closes the current cash period", async () => {
    closeOperationalCashClosure.mockResolvedValue({
      action: "close",
      periodId: 7,
      nextPeriodId: 8,
      closure: {
        id: 44,
        periodId: 7,
        openedAt: "2026-04-23 08:00:00+00",
        closedAt: "2026-04-23 18:00:00+00",
        operator: "Gestor Teste",
        totals: {
          cash: "320.00",
          fund: "50.00",
          overall: "350.00",
        },
        createdAt: "2026-04-23 18:00:00+00",
        snapshot: {
          period: {
            ini: "2026-04-23 08:00:00+00",
            fim: "2026-04-23 18:00:00+00",
          },
        },
      },
      closedSummary: {
        period: {
          id: 7,
          openedAt: "2026-04-23 08:00:00+00",
          closedAt: "2026-04-23 18:00:00+00",
          operator: "Gestor Teste",
          closureSheetId: null,
        },
        funds: [],
        sangrias: [],
        totals: {
          cashSales: "320.00",
          fund: "50.00",
          sangria: "20.00",
          cashInDrawer: "350.00",
        },
      },
      currentSummary: {
        period: {
          id: 8,
          openedAt: "2026-04-23 18:00:00+00",
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
      auditLogId: 981,
      message: "Caixa fechado com sucesso.",
    });

    const { POST } = await import("@/app/api/ops/cash-closures/route");
    const response = await POST(
      new Request("https://example.com/api/ops/cash-closures", {
        method: "POST",
        headers: {
          authorization: "Bearer ops-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          reason: "Fechamento manual",
          operatorName: "Gestor Teste",
          actor: {
            name: "Gestor Teste",
          },
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(closeOperationalCashClosure).toHaveBeenCalledWith({
      reason: "Fechamento manual",
      operatorName: "Gestor Teste",
      actor: {
        name: "Gestor Teste",
        cpf: null,
      },
    });
    expect(body).toEqual({
      ok: true,
      data: {
        action: "close",
        periodId: 7,
        nextPeriodId: 8,
        closure: {
          id: 44,
          periodId: 7,
          openedAt: "2026-04-23 08:00:00+00",
          closedAt: "2026-04-23 18:00:00+00",
          operator: "Gestor Teste",
          totals: {
            cash: "320.00",
            fund: "50.00",
            overall: "350.00",
          },
          createdAt: "2026-04-23 18:00:00+00",
          snapshot: {
            period: {
              ini: "2026-04-23 08:00:00+00",
              fim: "2026-04-23 18:00:00+00",
            },
          },
        },
        closedSummary: {
          period: {
            id: 7,
            openedAt: "2026-04-23 08:00:00+00",
            closedAt: "2026-04-23 18:00:00+00",
            operator: "Gestor Teste",
            closureSheetId: null,
          },
          funds: [],
          sangrias: [],
          totals: {
            cashSales: "320.00",
            fund: "50.00",
            sangria: "20.00",
            cashInDrawer: "350.00",
          },
        },
        currentSummary: {
          period: {
            id: 8,
            openedAt: "2026-04-23 18:00:00+00",
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
        auditLogId: 981,
        message: "Caixa fechado com sucesso.",
      },
    });
  });
});
