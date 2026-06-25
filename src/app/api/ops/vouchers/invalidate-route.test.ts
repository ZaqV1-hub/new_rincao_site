import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticateOperationsRequest = vi.fn();
const invalidatePurchaseVouchers = vi.fn();
const invalidateSelectedVouchers = vi.fn();
const asVoucherOperationError = vi.fn();

vi.mock("@/lib/ops-auth", () => ({
  authenticateOperationsRequest,
}));

vi.mock("@/lib/ops-voucher-validation", () => ({
  invalidatePurchaseVouchers,
  invalidateSelectedVouchers,
  asVoucherOperationError,
}));

describe("ops/vouchers invalidate BFF route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateOperationsRequest.mockReturnValue({ ok: true });
    asVoucherOperationError.mockImplementation((error: Error) => error);
  });

  it("invalidates selected vouchers and forwards actor metadata", async () => {
    invalidateSelectedVouchers.mockResolvedValue({
      action: "invalidate",
      mode: "selection",
      processedCount: 2,
      affectedVoucherIds: [9001, 9002],
      warnings: [],
      message: "2 voucher(s) invalidado(s) com sucesso.",
    });

    const { POST } = await import("@/app/api/ops/vouchers/invalidate/route");
    const response = await POST(
      new Request("https://example.com/api/ops/vouchers/invalidate", {
        method: "POST",
        headers: {
          authorization: "Bearer ops-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          voucherIds: [9001, 9002],
          actor: {
            name: "Gestor Teste",
            cpf: "52998224725",
          },
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(invalidateSelectedVouchers).toHaveBeenCalledWith([9001, 9002], {
      name: "Gestor Teste",
      cpf: "52998224725",
    });
    expect(body).toEqual({
      ok: true,
      data: {
        action: "invalidate",
        mode: "selection",
        processedCount: 2,
        affectedVoucherIds: [9001, 9002],
        warnings: [],
        message: "2 voucher(s) invalidado(s) com sucesso.",
      },
    });
  });

  it("rejects requests without voucher ids", async () => {
    const { POST } = await import("@/app/api/ops/vouchers/invalidate/route");
    const response = await POST(
      new Request("https://example.com/api/ops/vouchers/invalidate", {
        method: "POST",
        headers: {
          authorization: "Bearer ops-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({}),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      ok: false,
      error: {
        code: "invalid_operations_payload",
        message: "Informe voucherIds ou purchaseId para invalidar.",
      },
    });
  });

  it("invalidates all vouchers from a purchase id", async () => {
    invalidatePurchaseVouchers.mockResolvedValue({
      action: "invalidate",
      mode: "purchase",
      processedCount: 3,
      affectedVoucherIds: [1, 2, 3],
      warnings: [],
      message: "Todos os vouchers elegiveis da compra 321 foram invalidados.",
    });

    const { POST } = await import("@/app/api/ops/vouchers/invalidate/route");
    const response = await POST(
      new Request("https://example.com/api/ops/vouchers/invalidate", {
        method: "POST",
        headers: {
          authorization: "Bearer ops-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          purchaseId: 321,
          actor: {
            name: "Gestor Teste",
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(invalidatePurchaseVouchers).toHaveBeenCalledWith(321, {
      name: "Gestor Teste",
      cpf: null,
    });
    expect(invalidateSelectedVouchers).not.toHaveBeenCalled();
  });
});
