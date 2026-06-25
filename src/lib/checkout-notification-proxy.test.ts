import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getNativeCieloCheckoutStatus,
  isCieloEcommerceConfigured,
} from "@/lib/cielo-ecommerce";
import { reconcilePaymentFromGatewayPayload } from "@/lib/payment-reconciliation";
import { proxyCheckoutNotification } from "@/lib/checkout-notification-proxy";

vi.mock("@/lib/payment-reconciliation", () => ({
  reconcilePaymentFromGatewayPayload: vi.fn(),
}));

vi.mock("@/lib/cielo-ecommerce", () => ({
  getNativeCieloCheckoutStatus: vi.fn(),
  isCieloEcommerceConfigured: vi.fn(() => false),
}));

describe("checkout-notification-proxy", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("rejects unreconciled notifications without falling back to Zend", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await proxyCheckoutNotification(
      new Request("https://example.com/api/checkout/notification", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          CieloWebhookSecret: "secret",
          "x-forwarded-for": "10.0.0.1",
        },
        body: JSON.stringify({
          PaymentId: "pid_123",
          MerchantOrderId: "456",
        }),
      }),
    );

    expect(result).toEqual({
      status: 422,
      contentType: "application/json; charset=UTF-8",
      body: JSON.stringify({
        ok: false,
        error: {
          code: "payment_notification_unhandled",
          message: "Notificacao de pagamento nao reconciliada nativamente.",
        },
      }),
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(reconcilePaymentFromGatewayPayload).not.toHaveBeenCalled();
  });

  it("applies native reconciliation before proxying complete Cielo notifications", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const payload = {
      MerchantOrderId: "456",
      Payment: {
        PaymentId: "pid_456",
        Status: 2,
        Amount: 12000,
      },
    };

    const result = await proxyCheckoutNotification(
      new Request("https://example.com/api/checkout/notification", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      }),
    );

    expect(result).toEqual({
      status: 200,
      contentType: "text/plain; charset=UTF-8",
      body: "ok",
    });
    expect(reconcilePaymentFromGatewayPayload).toHaveBeenCalledWith(
      payload,
      456,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("applies native reconciliation for flat complete Cielo notifications", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const payload = {
      MerchantOrderId: "654",
      PaymentId: "pid-654",
      Status: 2,
    };

    const result = await proxyCheckoutNotification(
      new Request("https://example.com/api/checkout/notification", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      }),
    );

    expect(result).toEqual({
      status: 200,
      contentType: "text/plain; charset=UTF-8",
      body: "ok",
    });
    expect(reconcilePaymentFromGatewayPayload).toHaveBeenCalledWith(
      payload,
      654,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("queries Cielo natively before acknowledging identifier-only notifications", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.mocked(isCieloEcommerceConfigured).mockReturnValue(true);
    vi.mocked(getNativeCieloCheckoutStatus).mockResolvedValue({
      status: "00",
      dados: {
        code: "pid-789",
        reference: "789",
        status: 3,
      },
    } as unknown as Awaited<ReturnType<typeof getNativeCieloCheckoutStatus>>);

    const result = await proxyCheckoutNotification(
      new Request("https://example.com/api/checkout/notification", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          MerchantOrderId: "789",
          Payment: {
            PaymentId: "pid-789",
          },
        }),
      }),
    );

    expect(result).toEqual({
      status: 200,
      contentType: "text/plain; charset=UTF-8",
      body: "ok",
    });
    expect(getNativeCieloCheckoutStatus).toHaveBeenCalledWith({
      paymentId: "pid-789",
      reference: "789",
      purchaseId: 789,
    });
    expect(reconcilePaymentFromGatewayPayload).toHaveBeenCalledWith(
      {
        status: "00",
        dados: {
          code: "pid-789",
          reference: "789",
          status: 3,
        },
      },
      789,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
