import { beforeEach, describe, expect, it, vi } from "vitest";

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
  getIngressoDbPool: () => ({
    query: dbQuery,
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
            installments: 2,
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
          installments: 2,
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
});
