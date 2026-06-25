import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticateOperationsRequest = vi.fn();
const updateOperationalPurchase = vi.fn();
const asPurchaseOperationError = vi.fn();

vi.mock("@/lib/ops-auth", () => ({
  authenticateOperationsRequest,
}));

vi.mock("@/lib/ops-purchase-management", () => ({
  updateOperationalPurchase,
  asPurchaseOperationError,
}));

describe("ops/purchases update BFF route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateOperationsRequest.mockReturnValue({ ok: true });
    asPurchaseOperationError.mockImplementation((error: Error) => error);
  });

  it("updates an operational purchase", async () => {
    updateOperationalPurchase.mockResolvedValue({
      action: "update",
      purchaseId: 321,
      status: "conc",
      totalValue: "150.00",
      paymentMethods: ["pix"],
      affectedVoucherIds: [1],
      warnings: [],
      message: "Alteracoes salvas com sucesso.",
      auditLogId: 901,
    });

    const { POST } = await import("@/app/api/ops/purchases/update/route");
    const response = await POST(
      new Request("https://example.com/api/ops/purchases/update", {
        method: "POST",
        headers: {
          authorization: "Bearer ops-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          purchaseId: 321,
          reason: "Ajuste manual",
          purchaseDate: "2026-04-23",
          status: "conc",
          cpf: "52998224725",
          vouchers: [{ id: 1, status: "s", discountId: 7 }],
          payments: [{ method: "pix", value: "150,00" }],
          actor: { name: "Gestor Teste" },
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(updateOperationalPurchase).toHaveBeenCalledWith(
      expect.objectContaining({
        purchaseId: 321,
        reason: "Ajuste manual",
        purchaseDate: "2026-04-23",
        status: "conc",
        cpf: "52998224725",
      }),
    );
    expect(body).toEqual({
      ok: true,
      data: {
        action: "update",
        purchaseId: 321,
        status: "conc",
        totalValue: "150.00",
        paymentMethods: ["pix"],
        affectedVoucherIds: [1],
        warnings: [],
        message: "Alteracoes salvas com sucesso.",
        auditLogId: 901,
      },
    });
  });

  it("rejects invalid payloads", async () => {
    const { POST } = await import("@/app/api/ops/purchases/update/route");
    const response = await POST(
      new Request("https://example.com/api/ops/purchases/update", {
        method: "POST",
        headers: {
          authorization: "Bearer ops-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          purchaseId: 321,
          reason: "Ajuste manual",
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      ok: false,
      error: {
        code: "invalid_operations_payload",
        message: "Informe purchaseId, reason e purchaseDate para editar a compra.",
      },
    });
  });
});
