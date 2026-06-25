import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticateOperationsRequest = vi.fn();
const createOperationalCashMovement = vi.fn();
const deleteOperationalCashMovement = vi.fn();
const asOperationalCashError = vi.fn();
const updateOperationalCashMovement = vi.fn();

vi.mock("@/lib/ops-auth", () => ({
  authenticateOperationsRequest,
}));

vi.mock("@/lib/ops-cash-management", () => ({
  createOperationalCashMovement,
  deleteOperationalCashMovement,
  asOperationalCashError,
  updateOperationalCashMovement,
}));

describe("ops/cash-movements BFF route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateOperationsRequest.mockReturnValue({ ok: true });
    asOperationalCashError.mockImplementation((error: Error) => error);
  });

  it("creates a fundo movement and returns the updated summary", async () => {
    createOperationalCashMovement.mockResolvedValue({
      action: "create",
      movement: {
        id: 12,
        type: "fundo",
        responsible: "Tesouraria",
        value: "50.00",
        createdAt: "2026-04-23 11:00:00+00",
      },
      summary: {
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
          sangria: "0.00",
          cashInDrawer: "370.00",
        },
      },
      auditLogId: 911,
      message: "Fundo de caixa registrado com sucesso.",
    });

    const { POST } = await import("@/app/api/ops/cash-movements/route");
    const response = await POST(
      new Request("https://example.com/api/ops/cash-movements", {
        method: "POST",
        headers: {
          authorization: "Bearer ops-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          type: "fundo",
          responsible: "Tesouraria",
          value: "50,00",
          reason: "Reforco do caixa",
          actor: {
            name: "Gestor Teste",
          },
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(authenticateOperationsRequest).toHaveBeenCalledWith(
      expect.any(Request),
      { requiredPermission: "ops.cash" },
    );
    expect(createOperationalCashMovement).toHaveBeenCalledWith({
      type: "fundo",
      responsible: "Tesouraria",
      value: "50,00",
      reason: "Reforco do caixa",
      actor: {
        name: "Gestor Teste",
        cpf: null,
      },
    });
    expect(body).toEqual({
      ok: true,
      data: {
        action: "create",
        movement: {
          id: 12,
          type: "fundo",
          responsible: "Tesouraria",
          value: "50.00",
          createdAt: "2026-04-23 11:00:00+00",
        },
        summary: {
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
            sangria: "0.00",
            cashInDrawer: "370.00",
          },
        },
        auditLogId: 911,
        message: "Fundo de caixa registrado com sucesso.",
      },
    });
  });

  it("returns the normalized cash error", async () => {
    createOperationalCashMovement.mockRejectedValue(
      Object.assign(new Error("invalid"), {
        code: "invalid_cash_value",
        status: 400,
        message: "Informe um valor valido para o lancamento de caixa.",
      }),
    );

    const { POST } = await import("@/app/api/ops/cash-movements/route");
    const response = await POST(
      new Request("https://example.com/api/ops/cash-movements", {
        method: "POST",
        headers: {
          authorization: "Bearer ops-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          type: "fundo",
          responsible: "Tesouraria",
          value: "",
          reason: "Reforco do caixa",
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      ok: false,
      error: {
        code: "invalid_cash_value",
        message: "Informe um valor valido para o lancamento de caixa.",
      },
    });
  });

  it("updates a cash movement by id", async () => {
    updateOperationalCashMovement.mockResolvedValue({
      action: "update",
      movement: {
        id: 12,
        type: "sangria",
        responsible: "Gerencia Central",
        value: "30.00",
        createdAt: "2026-04-23 11:00:00+00",
      },
      summary: {
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
          sangria: "30.00",
          cashInDrawer: "340.00",
        },
      },
      auditLogId: 912,
      message: "Lancamento atualizado.",
    });

    const { PATCH } = await import("@/app/api/ops/cash-movements/route");
    const response = await PATCH(
      new Request("https://example.com/api/ops/cash-movements", {
        method: "PATCH",
        headers: {
          authorization: "Bearer ops-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          movementId: 12,
          responsible: "Gerencia Central",
          value: "30,00",
          reason: "Correcao manual",
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(updateOperationalCashMovement).toHaveBeenCalledWith({
      movementId: 12,
      responsible: "Gerencia Central",
      value: "30,00",
      reason: "Correcao manual",
      actor: {
        name: null,
        cpf: null,
      },
    });
    expect(body).toEqual({
      ok: true,
      data: {
        action: "update",
        movement: {
          id: 12,
          type: "sangria",
          responsible: "Gerencia Central",
          value: "30.00",
          createdAt: "2026-04-23 11:00:00+00",
        },
        summary: {
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
            sangria: "30.00",
            cashInDrawer: "340.00",
          },
        },
        auditLogId: 912,
        message: "Lancamento atualizado.",
      },
    });
  });

  it("deletes a cash movement by id", async () => {
    deleteOperationalCashMovement.mockResolvedValue({
      action: "delete",
      movementId: 12,
      movementType: "fundo",
      summary: {
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
          fund: "0.00",
          sangria: "0.00",
          cashInDrawer: "320.00",
        },
      },
      auditLogId: 913,
      message: "Lancamento excluido.",
    });

    const { DELETE } = await import("@/app/api/ops/cash-movements/route");
    const response = await DELETE(
      new Request("https://example.com/api/ops/cash-movements", {
        method: "DELETE",
        headers: {
          authorization: "Bearer ops-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          movementId: 12,
          reason: "Lancamento duplicado",
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(deleteOperationalCashMovement).toHaveBeenCalledWith({
      movementId: 12,
      reason: "Lancamento duplicado",
      actor: {
        name: null,
        cpf: null,
      },
    });
    expect(body).toEqual({
      ok: true,
      data: {
        action: "delete",
        movementId: 12,
        movementType: "fundo",
        summary: {
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
            fund: "0.00",
            sangria: "0.00",
            cashInDrawer: "320.00",
          },
        },
        auditLogId: 913,
        message: "Lancamento excluido.",
      },
    });
  });
});
