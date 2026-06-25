import { beforeEach, describe, expect, it, vi } from "vitest";

const getAuthSession = vi.fn();
const clearAuthCookie = vi.fn();
const getActivePublicUserByCpf = vi.fn();
const createSchoolPurchase = vi.fn();

vi.mock("@/lib/auth-session", () => ({
  getAuthSession,
  clearAuthCookie,
}));

vi.mock("@/lib/user-repository", () => ({
  getActivePublicUserByCpf,
}));

vi.mock("@/lib/school-purchase-repository", async () => {
  const actual = await vi.importActual<typeof import("@/lib/school-purchase-repository")>(
    "@/lib/school-purchase-repository"
  );

  return {
    ...actual,
    createSchoolPurchase,
  };
});

describe("api/escola/purchases route", () => {
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

  it("accepts educator payloads and forwards them to the shared purchase service", async () => {
    createSchoolPurchase.mockResolvedValue({
      purchaseId: 901,
      legacyEncodedId: "OTAx",
      totalValue: "45.00",
      voucherCount: 1,
    });

    const { POST } = await import("@/app/api/escola/purchases/route");
    const response = await POST(
      new Request("https://example.com/api/escola/purchases", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          schoolId: 12,
          agendaId: 77,
          value: "45,00",
          participantType: "educator",
          educatorName: "Carlos Lima",
          educatorRole: "Professor",
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(createSchoolPurchase).toHaveBeenCalledWith("52998224725", {
      schoolId: 12,
      agendaId: 77,
      value: "45,00",
      participantType: "educator",
      educatorName: "Carlos Lima",
      educatorRole: "Professor",
    });
    expect(body).toEqual({
      ok: true,
      data: {
        purchaseId: 901,
        legacyEncodedId: "OTAx",
        totalValue: "45.00",
        voucherCount: 1,
        checkoutRedirect: "/checkout/901",
      },
    });
  });
});
