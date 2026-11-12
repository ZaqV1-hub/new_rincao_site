import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePainelApiAccess = vi.fn();
const cancelOperationalPurchase = vi.fn();
const asPurchaseOperationError = vi.fn();

vi.mock("@/lib/painel-api-auth", () => ({ requirePainelApiAccess }));

vi.mock("@/lib/ops-purchase-management", () => ({
  cancelOperationalPurchase,
  asPurchaseOperationError,
}));

describe("ops/purchases cancel BFF route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requirePainelApiAccess.mockResolvedValue({ ok: true, session: { actorName: "Gestor Teste", actorCpf: "52998224725" } });
    asPurchaseOperationError.mockImplementation((error: Error) => error);
  });

  it("cancels an operational purchase with reason and actor", async () => {
    cancelOperationalPurchase.mockResolvedValue({
      action: "cancel",
      purchaseId: 321,
      status: "canc",
      affectedVoucherIds: [1, 2],
      warnings: [],
      message: "Compra cancelada com sucesso.",
      auditLogId: 901,
    });

    const { POST } = await import("@/app/api/ops/purchases/cancel/route");
    const response = await POST(
      new Request("https://example.com/api/ops/purchases/cancel", {
        method: "POST",
        headers: {
          authorization: "Bearer ops-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          purchaseId: 321,
          reason: "Cancelamento manual",
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(requirePainelApiAccess).toHaveBeenCalledWith(expect.any(Request), "vis_bilhet");
    expect(cancelOperationalPurchase).toHaveBeenCalledWith(
      321,
      "Cancelamento manual",
      {
        name: "Gestor Teste",
        cpf: "52998224725",
      },
    );
    expect(body).toEqual({
      ok: true,
      data: {
        action: "cancel",
        purchaseId: 321,
        status: "canc",
        affectedVoucherIds: [1, 2],
        warnings: [],
        message: "Compra cancelada com sucesso.",
        auditLogId: 901,
      },
    });
  });

  it("rejects cancel requests with invalid purchase id", async () => {
    const { POST } = await import("@/app/api/ops/purchases/cancel/route");
    const response = await POST(
      new Request("https://example.com/api/ops/purchases/cancel", {
        method: "POST",
        headers: {
          authorization: "Bearer ops-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({ purchaseId: 0 }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      ok: false,
      error: {
        code: "invalid_purchase_id",
        message: "Compra invalida.",
      },
    });
  });

  it("rejects cancel requests without exclusion reason", async () => {
    const { POST } = await import("@/app/api/ops/purchases/cancel/route");
    const response = await POST(
      new Request("https://example.com/api/ops/purchases/cancel", {
        method: "POST",
        headers: {
          authorization: "Bearer ops-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({ purchaseId: 321, reason: "   " }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      ok: false,
      error: {
        code: "invalid_update_reason",
        message: "Informe o motivo da exclusao.",
      },
    });
  });
});
