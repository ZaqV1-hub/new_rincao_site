import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getCieloSaleByPaymentId,
  getNativeCieloCheckoutStatus,
  isCieloEcommerceConfigured,
} from "@/lib/cielo-ecommerce";
import { reconcilePaymentFromGatewayPayload } from "@/lib/payment-reconciliation";
import { proxyCheckoutNotification } from "@/lib/checkout-notification-proxy";

vi.mock("@/lib/payment-reconciliation", () => ({
  reconcilePaymentFromGatewayPayload: vi.fn(),
}));

vi.mock("@/lib/cielo-ecommerce", () => ({
  getCieloSaleByPaymentId: vi.fn(),
  getNativeCieloCheckoutStatus: vi.fn(),
  isCieloEcommerceConfigured: vi.fn(() => false),
}));

function gatewayStatusFixture(sale: unknown, code: string, status: number): Awaited<ReturnType<typeof getNativeCieloCheckoutStatus>> {
  return { status: "00", sale, dados: { code, reference: "456", status, cancellationSource: "",
    date: new Date().toISOString(), lastEventDate: new Date().toISOString(), paymentMethod: { type: 1, code: 101 },
    grossAmount: "120.00", discountAmount: "0.00", feeAmount: "0.00", netAmount: "120.00", extraAmount: "0.00",
    installmentCount: 1, sender: { email: "", name: "Pessoa Exemplo", phone: { areaCode: "", number: "" } },
    shipping: { type: 0, cost: "0.00", address: { street: "", number: "", complement: [""], district: "", city: "", state: "", country: "BRA", postalCode: "" } },
    xml: "{}" } };
}

function notification(body: unknown) {
  return new Request("https://example.com/api/checkout/notification", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("checkout-notification-proxy", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("rejects notifications when the gateway is not configured", async () => {
    const result = await proxyCheckoutNotification(
      notification({ PaymentId: "pid-456", ChangeType: 1 }),
    );

    expect(result.status).toBe(422);
    expect(getCieloSaleByPaymentId).not.toHaveBeenCalled();
    expect(reconcilePaymentFromGatewayPayload).not.toHaveBeenCalled();
  });

  it("accepts the PaymentId-only payload sent by Cielo", async () => {
    vi.mocked(isCieloEcommerceConfigured).mockReturnValue(true);
    const sale = {
      MerchantOrderId: "456",
      Payment: { PaymentId: "pid-456", Status: 2, Amount: 12000 },
    };
    vi.mocked(getCieloSaleByPaymentId).mockResolvedValue(sale);
    const orderStatus = gatewayStatusFixture(sale, "pid-456", 3);
    vi.mocked(getNativeCieloCheckoutStatus).mockResolvedValue(orderStatus);

    const result = await proxyCheckoutNotification(
      notification({ PaymentId: "pid-456", ChangeType: 1 }),
    );

    expect(result).toEqual({
      status: 200,
      contentType: "text/plain; charset=UTF-8",
      body: "ok",
    });
    expect(getCieloSaleByPaymentId).toHaveBeenCalledWith("pid-456");
    expect(getNativeCieloCheckoutStatus).toHaveBeenCalledWith({
      paymentId: "pid-456",
      reference: "456",
      purchaseId: 456,
    });
    expect(reconcilePaymentFromGatewayPayload).toHaveBeenCalledWith(orderStatus, 456);
  });

  it("uses the gateway status instead of an untrusted notification status", async () => {
    vi.mocked(isCieloEcommerceConfigured).mockReturnValue(true);
    const sale = {
      MerchantOrderId: "456",
      Payment: { PaymentId: "pid-456", Status: 12, Amount: 12000 },
    };
    vi.mocked(getCieloSaleByPaymentId).mockResolvedValue(sale);
    const orderStatus = gatewayStatusFixture(sale, "other-paid-attempt", 3);
    vi.mocked(getNativeCieloCheckoutStatus).mockResolvedValue(orderStatus);

    const result = await proxyCheckoutNotification(
      notification({
        MerchantOrderId: "456",
        Payment: { PaymentId: "pid-456", Status: 2, Amount: 12000 },
      }),
    );

    expect(result.status).toBe(200);
    expect(reconcilePaymentFromGatewayPayload).toHaveBeenCalledWith(orderStatus, 456);
  });

  it("rejects a payment whose gateway reference differs from the notification", async () => {
    vi.mocked(isCieloEcommerceConfigured).mockReturnValue(true);
    vi.mocked(getCieloSaleByPaymentId).mockResolvedValue({
      MerchantOrderId: "789",
      Payment: { PaymentId: "pid-456", Status: 2, Amount: 12000 },
    });

    const result = await proxyCheckoutNotification(
      notification({ MerchantOrderId: "456", PaymentId: "pid-456" }),
    );

    expect(result.status).toBe(422);
    expect(reconcilePaymentFromGatewayPayload).not.toHaveBeenCalled();
  });
});
