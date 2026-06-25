import { beforeEach, describe, expect, it, vi } from "vitest";

const clearAuthCookie = vi.fn();
const getAuthSession = vi.fn();
const getActivePublicUserByCpf = vi.fn();
const createOnlinePurchase = vi.fn();

vi.mock("@/lib/auth-session", () => ({
  clearAuthCookie,
  getAuthSession,
}));

vi.mock("@/lib/user-repository", () => ({
  getActivePublicUserByCpf,
}));

vi.mock("@/lib/purchase-repository", async () => {
  const actual = await vi.importActual<typeof import("@/lib/purchase-repository")>(
    "@/lib/purchase-repository",
  );

  return {
    ...actual,
    createOnlinePurchase,
  };
});

describe("me/purchases BFF route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthSession.mockResolvedValue({ sub: "52998224725" });
    getActivePublicUserByCpf.mockResolvedValue({
      cpf: "52998224725",
      cpfMasked: "529.***.***-25",
      name: "Cliente Teste",
      email: "cliente@example.com",
      status: "ati",
    });
  });

  it("creates an online purchase for the authenticated customer", async () => {
    createOnlinePurchase.mockResolvedValue({
      purchaseId: 654,
      legacyEncodedId: "NjU0",
      totalValue: "180.00",
      voucherCount: 3,
    });

    const { POST } = await import("@/app/api/me/purchases/route");
    const response = await POST(
      new Request("https://example.com/api/me/purchases", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          agendaId: 123,
          codindica: " abc123 ",
          quantities: {
            discountedNormal: 1,
            discountedChild: 0,
            normal: 1,
            child: 0,
            exempt: 1,
          },
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(createOnlinePurchase).toHaveBeenCalledWith(
      "52998224725",
      123,
      {
        discountedNormal: 1,
        discountedChild: 0,
        normal: 1,
        child: 0,
        exempt: 1,
      },
      "ABC123",
    );
    expect(body).toEqual({
      ok: true,
      data: {
        purchaseId: 654,
        legacyEncodedId: "NjU0",
        totalValue: "180.00",
        voucherCount: 3,
        checkoutRedirect: "/checkout/654",
      },
    });
  });

  it("creates an online purchase from Estancia B2C cart line items", async () => {
    createOnlinePurchase.mockResolvedValue({
      purchaseId: 655,
      legacyEncodedId: "NjU1",
      totalValue: "345.00",
      voucherCount: 6,
    });

    const { POST } = await import("@/app/api/me/purchases/route");
    const response = await POST(
      new Request("https://example.com/api/me/purchases", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          agendaId: 123,
          lineItems: [
            { productId: "passaporte-explorador", quantity: 2 },
            { productId: "passaporte-infantil", quantity: 1 },
            { productId: "cafe-da-manha", quantity: 3 },
          ],
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(createOnlinePurchase).toHaveBeenCalledWith(
      "52998224725",
      123,
      {
        lineItems: [
          { productId: "passaporte-explorador", quantity: 2 },
          { productId: "passaporte-infantil", quantity: 1 },
          { productId: "cafe-da-manha", quantity: 3 },
        ],
      },
      undefined,
    );
    expect(body).toEqual({
      ok: true,
      data: {
        purchaseId: 655,
        legacyEncodedId: "NjU1",
        totalValue: "345.00",
        voucherCount: 6,
        checkoutRedirect: "/checkout/655",
      },
    });
  });

  it("rejects malformed payloads", async () => {
    const { POST } = await import("@/app/api/me/purchases/route");
    const response = await POST(
      new Request("https://example.com/api/me/purchases", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          agendaId: "x",
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(createOnlinePurchase).not.toHaveBeenCalled();
    expect(body).toEqual({
      ok: false,
      error: {
        code: "invalid_purchase",
        message: "Informe agenda e quantidades validas para continuar.",
      },
    });
  });

  it("rejects non-string codindica payloads", async () => {
    const { POST } = await import("@/app/api/me/purchases/route");
    const response = await POST(
      new Request("https://example.com/api/me/purchases", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          agendaId: 123,
          codindica: 123456,
          quantities: {
            discountedNormal: 0,
            discountedChild: 0,
            normal: 1,
            child: 0,
            exempt: 0,
          },
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(createOnlinePurchase).not.toHaveBeenCalled();
    expect(body).toEqual({
      ok: false,
      error: {
        code: "invalid_purchase",
        message: "Informe agenda e quantidades validas para continuar.",
      },
    });
  });

  it("returns normalized repository errors", async () => {
    const { PurchaseCreationError } = await import("@/lib/purchase-repository");
    createOnlinePurchase.mockRejectedValue(
      new PurchaseCreationError(
        "discount_limit_exceeded",
        "A quantidade de ingressos com desconto excede o limite disponivel.",
        409,
      ),
    );

    const { POST } = await import("@/app/api/me/purchases/route");
    const response = await POST(
      new Request("https://example.com/api/me/purchases", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          agendaId: 123,
          quantities: {
            discountedNormal: 2,
            discountedChild: 0,
            normal: 0,
            child: 0,
            exempt: 0,
          },
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({
      ok: false,
      error: {
        code: "discount_limit_exceeded",
        message: "A quantidade de ingressos com desconto excede o limite disponivel.",
      },
    });
  });
});
