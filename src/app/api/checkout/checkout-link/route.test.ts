import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const clearAuthCookie = vi.fn();
const getAuthSession = vi.fn();
const getActivePublicUserByCpf = vi.fn();
const getUserVoucherPurchaseById = vi.fn();
const isCieloEcommerceConfigured = vi.fn();
const createNativeCieloCheckout = vi.fn();
const getNativeCieloCheckoutStatus = vi.fn();
const cancelCieloPayment = vi.fn();
const reconcilePaymentFromGatewayPayload = vi.fn();
const dbQuery = vi.fn();
const dbRelease = vi.fn();

vi.mock("@/lib/auth-session", () => ({
  clearAuthCookie,
  getAuthSession,
}));

vi.mock("@/lib/user-repository", () => ({
  getActivePublicUserByCpf,
}));

vi.mock("@/lib/voucher-repository", () => ({
  getUserVoucherPurchaseById,
}));

vi.mock("@/lib/cielo-ecommerce", () => ({
  cancelCieloPayment,
  createNativeCieloCheckout,
  getNativeCieloCheckoutStatus,
  isCieloEcommerceConfigured,
}));

vi.mock("@/lib/ingresso-db", () => ({
  getIngressoSistemaDbPool: () => ({
    connect: async () => ({ query: dbQuery, release: dbRelease }),
  }),
}));

vi.mock("@/lib/payment-reconciliation", async () => {
  const actual = await vi.importActual<typeof import("@/lib/payment-reconciliation")>(
    "@/lib/payment-reconciliation",
  );

  return {
    ...actual,
    reconcilePaymentFromGatewayPayload,
  };
});

describe("checkout-link BFF route", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthSession.mockResolvedValue({ sub: "52998224725" });
    getActivePublicUserByCpf.mockResolvedValue({
      cpf: "52998224725",
      name: "Cliente Teste",
      email: "cliente@example.com",
      status: "ati",
    });
    getUserVoucherPurchaseById.mockResolvedValue({
      id: 456,
      type: "ponli",
      status: "pend",
      checkoutExpiresAt: "2099-01-01T00:00:00.000Z",
      totalValue: "129.90",
    });
    isCieloEcommerceConfigured.mockReturnValue(true);
    createNativeCieloCheckout.mockResolvedValue({
      status: "00",
      paymentId: "pid-456",
      dados: {
        code: "pid-456",
        reference: "456",
        status: 2,
      },
      sale: {},
    });
    getNativeCieloCheckoutStatus.mockResolvedValue({
      status: "00",
      dados: {
        code: "pid-pix-old",
        reference: "456",
        status: 7,
      },
    });
    dbQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("pg_try_advisory_lock")) {
        return { rows: [{ locked: true }] };
      }

      if (sql.includes("FROM pagpagseguro")) {
        return { rows: [] };
      }

      return { rows: [] };
    });
  });

  it("creates checkout directly in Cielo when configured", async () => {
    const { POST } = await import("@/app/api/checkout/checkout-link/route");
    const response = await POST(
      new Request("https://example.com/api/checkout/checkout-link", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          idcompra: 456,
          valor: "1.00",
          nome: "Cliente Teste",
          email: "cliente@example.com",
          telefone: "(51) 99999-9999",
          document: "529.982.247-25",
          payment: {
            type: "CreditCard",
            installments: 1,
          },
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      status: "00",
      paymentId: "pid-456",
    });
    expect(createNativeCieloCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        purchaseId: 456,
        amount: "129.90",
        customer: expect.objectContaining({
          document: "529.982.247-25",
        }),
        payment: {
          type: "CreditCard",
          installments: 1,
        },
      }),
    );
    expect(reconcilePaymentFromGatewayPayload).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentId: "pid-456",
      }),
      456,
    );
    expect(dbQuery).toHaveBeenCalledWith("SELECT pg_advisory_unlock($1, $2)", [
      94127,
      456,
    ]);
    expect(dbRelease).toHaveBeenCalledOnce();
  });

  it.each([
    { total: "199.99", installments: 2, status: 400, amount: null },
    { total: "200.00", installments: 6, status: 200, amount: "223.37" },
    { total: "200.00", installments: 7, status: 400, amount: null },
  ])("applies the credit installment policy for R$ $total in $installments installments", async ({ total, installments, status, amount }) => {
    getUserVoucherPurchaseById.mockResolvedValue({
      id: 456,
      type: "ponli",
      status: "pend",
      checkoutExpiresAt: "2099-01-01T00:00:00.000Z",
      totalValue: total,
    });
    const { POST } = await import("@/app/api/checkout/checkout-link/route");
    const response = await POST(new Request("https://example.com/api/checkout/checkout-link", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        idcompra: 456, expectedAmountCents: amount === null ? 0 : Math.round(Number(amount) * 100),
        payment: { type: "CreditCard", installments, creditCard: { brand: "Visa" } },
      }),
    }));

    expect(response.status).toBe(status);
    if (amount === null) {
      expect(createNativeCieloCheckout).not.toHaveBeenCalled();
    } else {
      expect(createNativeCieloCheckout).toHaveBeenCalledWith(expect.objectContaining({
        amount,
        payment: expect.objectContaining({ installments }),
      }));
    }
  });

  it.each([
    ...["Visa", "Mastercard"].flatMap((brand) =>
      [36998, 37494, 38019, 38547, 39089].map((amount, index) => ({ brand, amount, installments: index + 2 }))),
    ...["Elo", "Amex"].flatMap((brand) =>
      [37394, 37900, 38437, 38976, 39531].map((amount, index) => ({ brand, amount, installments: index + 2 }))),
  ])("sends the quoted $brand $installments x total to Cielo in cents", async ({ brand, amount, installments }) => {
    vi.stubEnv("INGRESSO_CIELO_MERCHANT_ID", "test-merchant");
    vi.stubEnv("INGRESSO_CIELO_MERCHANT_KEY", "test-key");
    vi.stubEnv("INGRESSO_CIELO_API_ENDPOINT", "https://api.example.test");
    const fetchMock = vi.fn().mockResolvedValue(Response.json({
      MerchantOrderId: "456",
      Payment: { PaymentId: "pid-quoted", Status: 2, Amount: amount, Installments: installments },
    }));
    vi.stubGlobal("fetch", fetchMock);
    const actualCielo = await vi.importActual<typeof import("@/lib/cielo-ecommerce")>("@/lib/cielo-ecommerce");
    createNativeCieloCheckout.mockImplementation(actualCielo.createNativeCieloCheckout);
    getUserVoucherPurchaseById.mockResolvedValue({
      id: 456, type: "ponli", status: "pend", totalValue: "350.00",
      checkoutExpiresAt: "2099-01-01T00:00:00.000Z",
    });
    const { POST } = await import("@/app/api/checkout/checkout-link/route");
    const response = await POST(new Request("https://example.com/api/checkout/checkout-link", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        idcompra: 456, valor: "0.01", expectedAmountCents: amount,
        payment: {
          type: "CreditCard", installments, amount: 1,
          creditCard: { brand, cardNumber: "4111111111111111", holder: "Teste",
            expirationMonth: "12", expirationYear: "2030", securityCode: "123" },
        },
      }),
    }));
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.example.test/1/sales/");
    expect(JSON.parse(init.body).Payment).toMatchObject({
      Amount: amount, Installments: installments, Interest: "ByMerchant",
      CreditCard: { Brand: brand === "Mastercard" ? "Master" : brand },
    });
    expect(dbQuery).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO checkout_installment_quotes"),
      [456, 350, amount / 100, (amount - 35000) / 100, installments, brand]);
  });

  it.each([undefined, 35824, 35000, "39089"])("rejects stale or invalid displayed total %s before charging", async (expectedAmountCents) => {
    getUserVoucherPurchaseById.mockResolvedValue({
      id: 456, type: "ponli", status: "pend", totalValue: "350.00",
      checkoutExpiresAt: "2099-01-01T00:00:00.000Z",
    });
    const { POST } = await import("@/app/api/checkout/checkout-link/route");
    const response = await POST(new Request("https://example.com/api/checkout/checkout-link", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ idcompra: 456, expectedAmountCents,
        payment: { type: "CreditCard", installments: 6, creditCard: { brand: "Visa" } } }),
    }));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: { code: "checkout_quote_changed" } });
    expect(createNativeCieloCheckout).not.toHaveBeenCalled();
    expect(dbQuery.mock.calls.some(([sql]) => sql.includes("INSERT INTO checkout_installment_quotes"))).toBe(false);
  });

  it("blocks checkout without falling back when Cielo ecommerce credentials are missing", async () => {
    isCieloEcommerceConfigured.mockReturnValue(false);
    vi.stubGlobal("fetch", vi.fn());

    const { POST } = await import("@/app/api/checkout/checkout-link/route");
    const response = await POST(
      new Request("https://example.com/api/checkout/checkout-link", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          idcompra: 456,
          payment: {
            type: "CreditCard",
          },
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({
      ok: false,
      error: {
        code: "checkout_unavailable",
        message: "Checkout nativo indisponivel neste ambiente.",
      },
    });
    expect(fetch).not.toHaveBeenCalled();
    expect(createNativeCieloCheckout).not.toHaveBeenCalled();
  });

  it("blocks duplicate non-Pix checkouts with active payment ledger", async () => {
    dbQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("pg_try_advisory_lock")) {
        return { rows: [{ locked: true }] };
      }

      if (sql.includes("FROM pagpagseguro")) {
        return {
          rows: [
            {
              idpagseguro: "pid-active",
              status: 2,
              paymentmethodtype: 1,
            },
          ],
        };
      }

      return { rows: [] };
    });

    const { POST } = await import("@/app/api/checkout/checkout-link/route");
    const response = await POST(
      new Request("https://example.com/api/checkout/checkout-link", {
        method: "POST",
        body: JSON.stringify({
          idcompra: 456,
          payment: {
            type: "CreditCard",
          },
        }),
      }),
    );
    const body = await response.json();

    expect(body).toMatchObject({
      status: "10",
    });
    expect(createNativeCieloCheckout).not.toHaveBeenCalled();
  });

  it("voids pending Pix before creating a new Pix payment", async () => {
    getNativeCieloCheckoutStatus
      .mockResolvedValueOnce({
        status: "00",
        dados: { code: "pid-pix-old", reference: "456", status: 1 },
      })
      .mockResolvedValueOnce({
        status: "00",
        dados: { code: "pid-pix-old", reference: "456", status: 7 },
      });
    dbQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("pg_try_advisory_lock")) {
        return { rows: [{ locked: true }] };
      }

      if (sql.includes("FROM pagpagseguro")) {
        return {
          rows: [
            {
              idpagseguro: "pid-pix-old",
              status: 1,
              paymentmethodtype: 11,
            },
          ],
        };
      }

      return { rows: [] };
    });

    const { POST } = await import("@/app/api/checkout/checkout-link/route");
    await POST(
      new Request("https://example.com/api/checkout/checkout-link", {
        method: "POST",
        body: JSON.stringify({
          idcompra: 456,
          payment: {
            type: "Pix",
          },
        }),
      }),
    );

    expect(cancelCieloPayment).toHaveBeenCalledWith("pid-pix-old");
    expect(getNativeCieloCheckoutStatus).toHaveBeenCalledWith({
      paymentId: "pid-pix-old",
      reference: "456",
      purchaseId: 456,
    });
    expect(createNativeCieloCheckout).toHaveBeenCalled();
  });

  it("reconciles an earlier paid Pix and does not create or void another payment", async () => {
    getNativeCieloCheckoutStatus.mockResolvedValue({
      status: "00",
      dados: { code: "pid-paid", reference: "456", status: 3 },
    });
    dbQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("pg_try_advisory_lock")) {
        return { rows: [{ locked: true }] };
      }
      if (sql.includes("FROM pagpagseguro")) {
        return {
          rows: [{
            idpagseguro: "pid-pix-old",
            status: 1,
            paymentmethodtype: 11,
          }],
        };
      }
      return { rows: [] };
    });

    const { POST } = await import("@/app/api/checkout/checkout-link/route");
    const response = await POST(
      new Request("https://example.com/api/checkout/checkout-link", {
        method: "POST",
        body: JSON.stringify({ idcompra: 456, payment: { type: "Pix" } }),
      }),
    );

    expect((await response.json()).status).toBe("10");
    expect(reconcilePaymentFromGatewayPayload).toHaveBeenCalledOnce();
    expect(cancelCieloPayment).not.toHaveBeenCalled();
    expect(createNativeCieloCheckout).not.toHaveBeenCalled();
  });

  it("does not create a new Pix if the previous attempt became refunded", async () => {
    getNativeCieloCheckoutStatus
      .mockResolvedValueOnce({
        status: "00",
        dados: { code: "pid-pix-old", reference: "456", status: 1 },
      })
      .mockResolvedValueOnce({
        status: "00",
        dados: { code: "pid-pix-old", reference: "456", status: 6 },
      });
    dbQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("pg_try_advisory_lock")) {
        return { rows: [{ locked: true }] };
      }
      if (sql.includes("FROM pagpagseguro")) {
        return {
          rows: [{
            idpagseguro: "pid-pix-old",
            status: 1,
            paymentmethodtype: 11,
          }],
        };
      }
      return { rows: [] };
    });

    const { POST } = await import("@/app/api/checkout/checkout-link/route");
    const response = await POST(
      new Request("https://example.com/api/checkout/checkout-link", {
        method: "POST",
        body: JSON.stringify({ idcompra: 456, payment: { type: "Pix" } }),
      }),
    );

    expect((await response.json()).status).toBe("10");
    expect(cancelCieloPayment).toHaveBeenCalledWith("pid-pix-old");
    expect(createNativeCieloCheckout).not.toHaveBeenCalled();
  });

  it("does not offer checkout for an already concluded purchase", async () => {
    getUserVoucherPurchaseById.mockResolvedValue({
      id: 456,
      type: "ponli",
      status: "conc",
      totalValue: "129.90",
    });

    const { POST } = await import("@/app/api/checkout/checkout-link/route");
    const response = await POST(
      new Request("https://example.com/api/checkout/checkout-link", {
        method: "POST",
        body: JSON.stringify({ idcompra: 456, payment: { type: "Pix" } }),
      }),
    );

    expect(response.status).toBe(404);
    expect(createNativeCieloCheckout).not.toHaveBeenCalled();
  });

  it("rejects an old pending purchase before creating a new charge", async () => {
    getUserVoucherPurchaseById.mockResolvedValue({
      id: 456,
      type: "ponli",
      status: "pend",
      checkoutExpiresAt: "2025-10-07T02:10:53.000Z",
      totalValue: "150.00",
    });

    const { POST } = await import("@/app/api/checkout/checkout-link/route");
    const response = await POST(
      new Request("https://example.com/api/checkout/checkout-link", {
        method: "POST",
        body: JSON.stringify({ idcompra: 456, payment: { type: "Pix" } }),
      }),
    );

    expect(response.status).toBe(410);
    expect(createNativeCieloCheckout).not.toHaveBeenCalled();
  });
});
