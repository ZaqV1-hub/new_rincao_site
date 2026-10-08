import { beforeEach, describe, expect, it, vi } from "vitest";

const clearAuthCookie = vi.fn();
const getAuthSession = vi.fn();
const getActivePublicUserByCpf = vi.fn();
const getUserVoucherExportData = vi.fn();
const sendPurchaseTicketsWhatsApp = vi.fn();

const schoolMocks = vi.hoisted(() => ({ getSchoolPaymentHold: vi.fn(async () => null as { status: string; source: string } | null) }));
vi.mock("@/lib/school-payment-eligibility", () => ({ getSchoolPaymentHold: schoolMocks.getSchoolPaymentHold }));
vi.mock("@/lib/ingresso-db", () => ({ getIngressoSistemaDbPool: () => ({ query: vi.fn() }) }));

vi.mock("@/lib/auth-session", () => ({
  clearAuthCookie,
  getAuthSession,
}));

vi.mock("@/lib/user-repository", () => ({
  getActivePublicUserByCpf,
}));

vi.mock("@/lib/voucher-repository", () => ({
  getUserVoucherExportData,
}));

vi.mock("@/lib/ticket-service", () => ({
  sendPurchaseTicketsWhatsApp,
}));

describe("me/vouchers whatsapp BFF route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    schoolMocks.getSchoolPaymentHold.mockResolvedValue(null);
  });

  it("sends selected vouchers by whatsapp for the authenticated user", async () => {
    getAuthSession.mockResolvedValue({ sub: "52998224725" });
    getActivePublicUserByCpf.mockResolvedValue({
      cpf: "52998224725",
      cpfMasked: "529.***.***-25",
      name: "Cliente Teste",
      email: "cliente@example.com",
      status: "ati",
    });
    getUserVoucherExportData.mockResolvedValue({
      purchase: {
        id: 101,
        legacyEncodedId: "MTAx",
        type: "ponli",
        typeLabel: "Compra",
        purchaseDate: "2026-07-20",
        totalValue: "120.00",
        status: "conc",
        statusLabel: "Pago",
        payment: {
          provider: "pagseguro",
          status: 3,
          statusLabel: "Paga",
          methodType: 1,
        },
        unusedVoucherCount: 2,
        voucherCount: 2,
        canGenerateVoucher: true,
        canCancelReservation: false,
        vouchers: [],
      },
      vouchers: [
        {
          id: 11,
          number: "ABC-11",
          type: "norma",
          typeLabel: "a partir de 10 anos",
          visitDate: "2026-07-25",
          unitValue: "120.00",
          agendaType: "padra",
          schoolName: null,
          participantName: null,
          schoolClassDisplay: null,
          description: "Dia especial",
        },
      ],
      information: null,
      isSchool: false,
    });
    sendPurchaseTicketsWhatsApp.mockResolvedValue({
      status: "sent",
      purchaseId: 101,
      sentVoucherIds: [11],
    });

    const { POST } = await import(
      "@/app/api/me/vouchers/[voucherId]/whatsapp/route"
    );
    const response = await POST(
      new Request("https://example.com/api/me/vouchers/101/whatsapp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          voucherIds: [11],
          phoneNumber: "(51) 99999-9999",
        }),
      }),
      { params: Promise.resolve({ voucherId: "101" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(sendPurchaseTicketsWhatsApp).toHaveBeenCalledWith(
      101,
      [11],
      "(51) 99999-9999",
    );
    expect(body).toEqual({
      ok: true,
      data: {
        purchaseId: 101,
        voucherIds: [11],
        phoneNumber: "51999999999",
      },
    });
  });

  it("rejects invalid phone numbers", async () => {
    getAuthSession.mockResolvedValue({ sub: "52998224725" });

    const { POST } = await import(
      "@/app/api/me/vouchers/[voucherId]/whatsapp/route"
    );
    const response = await POST(
      new Request("https://example.com/api/me/vouchers/101/whatsapp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          voucherIds: [11],
          phoneNumber: "9999",
        }),
      }),
      { params: Promise.resolve({ voucherId: "101" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      ok: false,
      error: {
        code: "invalid_phone_number",
        message: "Informe um numero de WhatsApp valido com DDD.",
      },
    });
  });
  it("refuses a retained school purchase before producing or sending a voucher", async () => {
    getAuthSession.mockResolvedValue({ sub: "52998224725" });
    getActivePublicUserByCpf.mockResolvedValue({ cpf: "52998224725", name: "Pessoa Exemplo" });
    getUserVoucherExportData.mockResolvedValue({ purchase: { id: 101, canGenerateVoucher: true }, vouchers: [{ id: 11 }], isSchool: true });
    schoolMocks.getSchoolPaymentHold.mockResolvedValue({ status: "review_required", source: "site" });
    const { POST } = await import("@/app/api/me/vouchers/[voucherId]/whatsapp/route");
    const request = new Request("https://example.test/api/me/vouchers/101/whatsapp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ voucherIds: [11], phoneNumber: "5500000000000" }) });
    const response = await POST(request, { params: Promise.resolve({ voucherId: "101" }) });
    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe("school_payment_held");
    expect(sendPurchaseTicketsWhatsApp).not.toHaveBeenCalled();
  });

});
