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
          MerchantOrderId: "456",
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

  it("falls back to the matching merchant order after a payment id 404", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ message: "not found" }, { status: 404 }),
      )
      .mockResolvedValueOnce(
        Response.json({ Payments: [{ PaymentId: "cielo-payment-456" }] }),
      )
      .mockResolvedValueOnce(
        Response.json({
          MerchantOrderId: "456",
          Payment: {
            PaymentId: "cielo-payment-456",
            Status: 2,
            Amount: 12990,
            PaymentType: "Pix",
          },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await getNativeCieloCheckoutStatus({
      paymentId: "legacy-payment-id",
      reference: "456",
      purchaseId: 456,
    });

    expect(result).toMatchObject({
      status: "00",
      dados: {
        code: "cielo-payment-456",
        reference: "456",
        status: 3,
        paymentMethod: { type: 11 },
      },
    });
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "https://query.example.test/1/sales/legacy-payment-id",
      "https://query.example.test/1/sales?merchantOrderId=456",
      "https://query.example.test/1/sales/cielo-payment-456",
    ]);
  });

  it("reads the top-level PaymentId returned by Cielo merchant order lookup", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ message: "not found" }, { status: 404 }),
      )
      .mockResolvedValueOnce(
        Response.json({
          PaymentId: "replacement-payment-456",
          ReceivedDate: "2026-09-24 12:00:00",
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          MerchantOrderId: "456",
          Payment: {
            PaymentId: "replacement-payment-456",
            Status: 2,
            Amount: 12990,
            PaymentType: "Pix",
          },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await getNativeCieloCheckoutStatus({
      paymentId: "legacy-payment-id",
      reference: "456",
      purchaseId: 456,
    });

    expect(result).toMatchObject({
      status: "00",
      dados: {
        code: "replacement-payment-456",
        reference: "456",
        status: 3,
      },
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("selects a paid Pix attempt even when the saved payment is still pending", async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.endsWith("/1/sales?merchantOrderId=456")) {
        return Response.json({
          Payments: [
            { PaymentId: "pending-456" },
            { PaymentId: "paid-456" },
          ],
        });
      }

      if (url.endsWith("/1/sales/paid-456")) {
        return Response.json({
          MerchantOrderId: "456",
          Payment: {
            PaymentId: "paid-456",
            Status: 2,
            Amount: 12990,
            PaymentType: "Pix",
            ReceivedDate: "2026-09-23T10:00:00Z",
          },
        });
      }

      return Response.json({
        MerchantOrderId: "456",
        Payment: {
          PaymentId: "pending-456",
          Status: 12,
          Amount: 12990,
          PaymentType: "Pix",
          ReceivedDate: "2026-09-24T10:00:00Z",
        },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await getNativeCieloCheckoutStatus({
      paymentId: "pending-456",
      reference: "456",
      purchaseId: 456,
    });

    expect(result).toMatchObject({
      status: "00",
      dados: { code: "paid-456", reference: "456", status: 3 },
      sale: { Payment: { PaymentId: "paid-456" } },
    });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("does not choose between two confirmed charges for one purchase", async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.endsWith("/1/sales?merchantOrderId=456")) {
        return Response.json({
          Payments: [{ PaymentId: "paid-one" }, { PaymentId: "paid-two" }],
        });
      }

      return Response.json({
        MerchantOrderId: "456",
        Payment: {
          PaymentId: url.endsWith("paid-one") ? "paid-one" : "paid-two",
          Status: 2,
          Amount: 12990,
          PaymentType: "Pix",
        },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      getNativeCieloCheckoutStatus({ reference: "456", purchaseId: 456 }),
    ).rejects.toThrow("cielo_multiple_confirmed_payments:456");
  });

  it("keeps a confirmed attempt when another listed attempt is no longer found", async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.endsWith("/1/sales?merchantOrderId=456")) {
        return Response.json({
          PaymentId: "missing-456",
          Payments: [{ PaymentId: "paid-456" }],
        });
      }
      if (url.endsWith("/1/sales/missing-456")) {
        return Response.json({ message: "not found" }, { status: 404 });
      }
      return Response.json({
        MerchantOrderId: "456",
        Payment: {
          PaymentId: "paid-456",
          Status: 2,
          Amount: 12990,
          PaymentType: "Pix",
        },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await getNativeCieloCheckoutStatus({
      reference: "456",
      purchaseId: 456,
    });

    expect(result).toMatchObject({
      status: "00",
      dados: { code: "paid-456", status: 3 },
    });
  });

  it("does not reconcile a sale returned for a different merchant order", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ message: "not found" }, { status: 404 }),
      )
      .mockResolvedValueOnce(
        Response.json({ Payments: [{ PaymentId: "cielo-payment-999" }] }),
      )
      .mockResolvedValueOnce(
        Response.json({
          MerchantOrderId: "999",
          Payment: {
            PaymentId: "cielo-payment-999",
            Status: 2,
            Amount: 12990,
            PaymentType: "Pix",
          },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      getNativeCieloCheckoutStatus({
        paymentId: "legacy-payment-id",
        reference: "456",
        purchaseId: 456,
      }),
    ).resolves.toMatchObject({
      status: "30",
      msgRetorno: "Transacao nao encontrada.",
    });
  });

  it("does not fall back by merchant order for non-404 Cielo errors", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ message: "unauthorized" }, { status: 401 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      getNativeCieloCheckoutStatus({
        paymentId: "legacy-payment-id",
        reference: "456",
        purchaseId: 456,
      }),
    ).rejects.toThrow("cielo_ecommerce_error_401");
    expect(fetchMock).toHaveBeenCalledTimes(1);
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
          ExpirationDate: "12/2030",
        },
      },
    });
  });

  it("expands legacy two-digit card expiration years for Cielo", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        MerchantOrderId: "457",
        Payment: {
          PaymentId: "pid-457",
          Status: 1,
          Amount: 100,
          PaymentType: "CreditCard",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await createNativeCieloCheckout({
      purchaseId: 457,
      amount: "1.00",
      customer: { name: "Cliente Teste" },
      payment: {
        type: "CreditCard",
        creditCard: {
          cardNumber: "4111111111111111",
          holder: "Cliente Teste",
          expirationDate: "12/30",
          securityCode: "123",
          brand: "Visa",
        },
      },
    });

    const [, init] = fetchMock.mock.calls[0] as [string, { body: string }];
    const body = JSON.parse(init.body);

    expect(body.Payment.CreditCard.ExpirationDate).toBe("12/2030");
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
