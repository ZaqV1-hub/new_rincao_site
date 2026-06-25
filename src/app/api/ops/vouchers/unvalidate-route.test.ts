import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticateOperationsRequest = vi.fn();
const unvalidatePurchaseVouchers = vi.fn();
const unvalidateSelectedVouchers = vi.fn();
const asVoucherOperationError = vi.fn();

vi.mock("@/lib/ops-auth", () => ({
  authenticateOperationsRequest,
}));

vi.mock("@/lib/ops-voucher-validation", () => ({
  unvalidatePurchaseVouchers,
  unvalidateSelectedVouchers,
  asVoucherOperationError,
}));

describe("ops/vouchers unvalidate BFF route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateOperationsRequest.mockReturnValue({ ok: true });
    asVoucherOperationError.mockImplementation((error: Error) => error);
  });

  it("unvalidates selected vouchers and forwards actor metadata", async () => {
    unvalidateSelectedVouchers.mockResolvedValue({
      action: "unvalidate",
      mode: "selection",
      processedCount: 1,
      affectedVoucherIds: [9001],
      warnings: [],
      message: "1 voucher(s) desvalidado(s) com sucesso.",
    });

    const { POST } = await import("@/app/api/ops/vouchers/unvalidate/route");
    const response = await POST(
      new Request("https://example.com/api/ops/vouchers/unvalidate", {
        method: "POST",
        headers: {
          authorization: "Bearer ops-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          voucherIds: [9001],
          actor: {
            name: "Gestor Teste",
            cpf: "52998224725",
          },
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(unvalidateSelectedVouchers).toHaveBeenCalledWith([9001], {
      name: "Gestor Teste",
      cpf: "52998224725",
    });
    expect(body).toEqual({
      ok: true,
      data: {
        action: "unvalidate",
        mode: "selection",
        processedCount: 1,
        affectedVoucherIds: [9001],
        warnings: [],
        message: "1 voucher(s) desvalidado(s) com sucesso.",
      },
    });
  });

  it("rejects requests without voucher ids", async () => {
    const { POST } = await import("@/app/api/ops/vouchers/unvalidate/route");
    const response = await POST(
      new Request("https://example.com/api/ops/vouchers/unvalidate", {
        method: "POST",
        headers: {
          authorization: "Bearer ops-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({ actor: { name: "Gestor" } }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      ok: false,
      error: {
        code: "invalid_operations_payload",
        message: "Informe voucherIds ou purchaseId para desvalidar.",
      },
    });
  });

  it("unvalidates all validated vouchers from a purchase id", async () => {
    unvalidatePurchaseVouchers.mockResolvedValue({
      action: "unvalidate",
      mode: "purchase",
      processedCount: 2,
      affectedVoucherIds: [9001, 9002],
      warnings: [],
      message: "Todos os vouchers validados da compra 321 foram desvalidados.",
    });

    const { POST } = await import("@/app/api/ops/vouchers/unvalidate/route");
    const response = await POST(
      new Request("https://example.com/api/ops/vouchers/unvalidate", {
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
    expect(unvalidatePurchaseVouchers).toHaveBeenCalledWith(321, {
      name: "Gestor Teste",
      cpf: null,
    });
    expect(unvalidateSelectedVouchers).not.toHaveBeenCalled();
  });
});
