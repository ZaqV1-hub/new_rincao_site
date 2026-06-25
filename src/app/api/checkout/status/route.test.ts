import { beforeEach, describe, expect, it, vi } from "vitest";

const clearAuthCookie = vi.fn();
const getAuthSession = vi.fn();
const getActivePublicUserByCpf = vi.fn();
const getUserVoucherPurchaseById = vi.fn();
const syncCheckoutStatus = vi.fn();

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

vi.mock("@/lib/checkout-status", () => ({
  syncCheckoutStatus,
}));

describe("checkout status BFF route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthSession.mockResolvedValue({ sub: "52998224725" });
    getActivePublicUserByCpf.mockResolvedValue({
      cpf: "52998224725",
      status: "ati",
    });
    getUserVoucherPurchaseById.mockResolvedValue({
      id: 456,
      type: "ponli",
      status: "pend",
    });
    syncCheckoutStatus.mockResolvedValue({
      status: 200,
      contentType: "application/json; charset=UTF-8",
      body: {
        status: "00",
        dados: {
          reference: "456",
          status: 2,
        },
      },
    });
  });

  it("syncs a checkout status for the authenticated purchase owner", async () => {
    const { GET } = await import("@/app/api/checkout/status/route");
    const response = await GET(
      new Request("https://example.com/api/checkout/status?reference=456"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(getUserVoucherPurchaseById).toHaveBeenCalledWith("52998224725", 456);
    expect(syncCheckoutStatus).toHaveBeenCalledWith(
      {
        id: 456,
        type: "ponli",
        status: "pend",
      },
      expect.any(URLSearchParams),
    );
    expect(body).toEqual({
      status: "00",
      dados: {
        reference: "456",
        status: 2,
      },
    });
  });

  it("rejects invalid purchase references", async () => {
    const { GET } = await import("@/app/api/checkout/status/route");
    const response = await GET(
      new Request("https://example.com/api/checkout/status?reference=x"),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(syncCheckoutStatus).not.toHaveBeenCalled();
    expect(body).toEqual({
      ok: false,
      error: {
        code: "checkout_unavailable",
        message: "Compra invalida para consultar o checkout.",
      },
    });
  });

  it("clears the auth cookie when the public user no longer exists", async () => {
    getActivePublicUserByCpf.mockResolvedValue(null);

    const { GET } = await import("@/app/api/checkout/status/route");
    const response = await GET(
      new Request("https://example.com/api/checkout/status?reference=456"),
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(clearAuthCookie).toHaveBeenCalledWith(response);
    expect(body).toEqual({
      ok: false,
      error: {
        code: "unauthenticated",
        message: "Sessao nao encontrada ou expirada.",
      },
    });
  });
});
