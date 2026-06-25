import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cancelCieloPayment,
  createNativeCieloCheckout,
  getCieloSaleByPaymentId,
  getNativeCieloCheckoutStatus,
  isCieloEcommerceConfigured,
} from "@/lib/cielo-ecommerce";

const originalEnv = process.env;

describe("cielo-ecommerce", () => {
  beforeEach(() => {
    process.env = {
      ...originalEnv,
      INGRESSO_CIELO_MERCHANT_ID: "merchant-id",
      INGRESSO_CIELO_MERCHANT_KEY: "merchant-key",
      INGRESSO_CIELO_API_ENDPOINT: "https://api.example.test/",
      INGRESSO_CIELO_QUERY_ENDPOINT: "https://query.example.test/",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.unstubAllGlobals();
  });

  it("detects missing credentials", () => {
    delete process.env.INGRESSO_CIELO_MERCHANT_ID;
    delete process.env.INGRESSO_CIELO_MERCHANT_KEY;

    expect(isCieloEcommerceConfigured()).toBe(false);
  });

  it("queries Cielo by payment id with merchant headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        MerchantOrderId: "123",
        Payment: {
          PaymentId: "pid-123",
          Status: 2,
          Amount: 12000,
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(getCieloSaleByPaymentId("pid-123")).resolves.toMatchObject({
      MerchantOrderId: "123",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://query.example.test/1/sales/pid-123",
      expect.objectContaining({
        method: "GET",
        cache: "no-store",
        headers: expect.objectContaining({
          MerchantId: "merchant-id",
          MerchantKey: "merchant-key",
        }),
      }),
    );
  });

  it("normalizes native Cielo query results for checkout status", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          Payments: [
            {
              PaymentId: "pid-456",
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          Payment: {
            PaymentId: "pid-456",
            Status: 2,
            Amount: 12990,
            PaymentType: "CreditCard",
            CreditCard: {
              Brand: "Visa",
            },
          },
          Customer: {
            Name: "Cliente Teste",
            Email: "cliente@example.com",
          },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await getNativeCieloCheckoutStatus({
      reference: "456",
      purchaseId: 456,
    });

    expect(result).toMatchObject({
      status: "00",
      dados: {
        code: "pid-456",
        reference: "456",
        status: 3,
        grossAmount: "129.90",
        paymentMethod: {
          code: 101,
        },
      },
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("creates native Cielo checkout payloads", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        MerchantOrderId: "456",
        Payment: {
          PaymentId: "pid-456",
          Status: 1,
          Amount: 12990,
          PaymentType: "CreditCard",
          CreditCard: {
            Brand: "Visa",
          },
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await createNativeCieloCheckout({
      purchaseId: 456,
      amount: "129.90",
      customer: {
        name: "Cliente Teste",
        email: "cliente@example.com",
        phone: "(51) 99999-9999",
        document: "529.982.247-25",
      },
      payment: {
        type: "CreditCard",
        installments: 2,
        creditCard: {
          cardNumber: "4111111111111111",
          holder: "Cliente Teste",
          expirationMonth: "12",
          expirationYear: "2030",
          securityCode: "123",
          brand: "Visa",
        },
      },
      returnUrl: "https://example.com/checkout/456/retorno",
    });

    expect(result).toMatchObject({
      status: "00",
      paymentId: "pid-456",
      dados: {
        reference: "456",
        status: 2,
      },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/1/sales/",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"MerchantOrderId":"456"'),
      }),
    );
    const [, init] = fetchMock.mock.calls[0] as [
      string,
      { body: string },
    ];
    const body = JSON.parse(init.body);

    expect(body).toMatchObject({
      MerchantOrderId: "456",
      Customer: {
        Identity: "52998224725",
        IdentityType: "CPF",
      },
      Payment: {
        Type: "CreditCard",
        Amount: 12990,
        Installments: 2,
        Capture: true,
        CreditCard: {
          Brand: "Visa",
        },
      },
    });
  });

  it("voids Cielo payments through the API endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({}));
    vi.stubGlobal("fetch", fetchMock);

    await cancelCieloPayment("pid-789");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/1/sales/pid-789/void",
      expect.objectContaining({
        method: "PUT",
      }),
    );
  });
});
