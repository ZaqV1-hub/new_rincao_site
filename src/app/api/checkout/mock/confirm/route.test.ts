import { beforeEach, describe, expect, it, vi } from "vitest";

const clearAuthCookie = vi.fn();
const getAuthSession = vi.fn();
const getUserVoucherPurchaseById = vi.fn();
const confirmSandboxCheckout = vi.fn();

vi.mock("@/lib/auth-session", () => ({
  clearAuthCookie,
  getAuthSession,
}));

vi.mock("@/lib/voucher-repository", () => ({
  getUserVoucherPurchaseById,
}));

vi.mock("@/lib/checkout-sandbox", () => ({
  confirmSandboxCheckout,
}));

describe("checkout mock confirm route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthSession.mockResolvedValue({ sub: "52998224725" });
    getUserVoucherPurchaseById.mockResolvedValue({
      id: 456,
      type: "ponli",
      status: "pend",
      totalValue: "129.90",
    });
    confirmSandboxCheckout.mockResolvedValue({
      purchaseId: 456,
      purchaseStatus: "conc",
    });
  });

  it("confirms a local mock checkout for the authenticated purchase", async () => {
    const { POST } = await import("@/app/api/checkout/mock/confirm/route");
    const response = await POST(
      new Request("https://example.test/api/checkout/mock/confirm", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          purchaseId: 456,
          paymentType: "Pix",
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      data: {
        purchaseId: 456,
        purchaseStatus: "conc",
      },
    });
    expect(confirmSandboxCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        purchaseId: 456,
        amount: "129.90",
        cpf: "52998224725",
        paymentType: "Pix",
      }),
    );
  });

  it("rejects invalid purchase ids before confirming the mock checkout", async () => {
    const { POST } = await import("@/app/api/checkout/mock/confirm/route");
    const response = await POST(
      new Request("https://example.test/api/checkout/mock/confirm", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          purchaseId: 0,
          paymentType: "Pix",
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      ok: false,
      error: {
        code: "invalid_checkout_request",
      },
    });
  });

  it("keeps auth protection before returning the disabled sandbox response", async () => {
    getAuthSession.mockResolvedValue(null);
    const { POST } = await import("@/app/api/checkout/mock/confirm/route");
    const response = await POST(
      new Request("https://example.test/api/checkout/mock/confirm", {
        method: "POST",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toMatchObject({
      ok: false,
      error: {
        code: "unauthenticated",
      },
    });
  });
});
