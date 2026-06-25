import { beforeEach, describe, expect, it, vi } from "vitest";

const reconcilePaymentFromGatewayPayload = vi.fn();

vi.mock("@/lib/payment-reconciliation", () => ({
  reconcilePaymentFromGatewayPayload,
}));

describe("checkout sandbox helper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reconcilePaymentFromGatewayPayload.mockResolvedValue({
      purchaseId: 456,
      purchaseStatus: "conc",
    });
  });

  it("sends numeric-safe fallback values to reconciliation", async () => {
    const { confirmSandboxCheckout } = await import("@/lib/checkout-sandbox");

    await confirmSandboxCheckout({
      purchaseId: 456,
      amount: "129.90",
      cpf: "529.982.247-25",
      name: "Cliente Teste",
      email: "cliente@example.com",
      phone: null,
      paymentType: "Pix",
    });

    expect(reconcilePaymentFromGatewayPayload).toHaveBeenCalledWith(
      expect.objectContaining({
        document: "52998224725",
        sender: {
          email: "cliente@example.com",
          name: "Cliente Teste",
          phone: {
            areaCode: "0",
            number: "0",
          },
        },
        shipping: {
          type: 3,
          cost: "0.00",
          address: expect.objectContaining({
            postalCode: "0",
          }),
        },
      }),
      456,
    );
  });
});
