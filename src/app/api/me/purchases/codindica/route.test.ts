import { beforeEach, describe, expect, it, vi } from "vitest";

const clearAuthCookie = vi.fn();
const getAuthSession = vi.fn();
const getActivePublicUserByCpf = vi.fn();
const previewOnlinePurchaseCodindica = vi.fn();

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
    previewOnlinePurchaseCodindica,
  };
});

describe("me/purchases/codindica BFF route", () => {
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

  it("previews an applied referral code for B2C cart line items", async () => {
    previewOnlinePurchaseCodindica.mockResolvedValue({
      codindica: "ABC123",
      subtotal: "100.00",
      discountAmount: "25.00",
      totalValue: "75.00",
    });

    const { POST } = await import("@/app/api/me/purchases/codindica/route");
    const response = await POST(
      new Request("https://example.com/api/me/purchases/codindica", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          agendaId: 123,
          codindica: " abc123 ",
          lineItems: [
            { productId: "passaporte-explorador", quantity: 2 },
            { productId: "cafe-da-manha", quantity: 1 },
          ],
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(previewOnlinePurchaseCodindica).toHaveBeenCalledWith(
      123,
      {
        lineItems: [
          { productId: "passaporte-explorador", quantity: 2 },
          { productId: "cafe-da-manha", quantity: 1 },
        ],
      },
      "ABC123",
    );
    expect(body).toEqual({
      ok: true,
      data: {
        codindica: "ABC123",
        subtotal: "100.00",
        discountAmount: "25.00",
        totalValue: "75.00",
      },
    });
  });

  it("rejects malformed payloads", async () => {
    const { POST } = await import("@/app/api/me/purchases/codindica/route");
    const response = await POST(
      new Request("https://example.com/api/me/purchases/codindica", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          agendaId: 123,
          codindica: 123456,
          lineItems: [{ productId: "passaporte-explorador", quantity: 1 }],
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(previewOnlinePurchaseCodindica).not.toHaveBeenCalled();
    expect(body).toEqual({
      ok: false,
      error: {
        code: "invalid_purchase",
        message: "Informe agenda, itens e codigo validos para continuar.",
      },
    });
  });
});
