import { beforeEach, describe, expect, it, vi } from "vitest";

const clearAuthCookie = vi.fn();
const getAuthSession = vi.fn();
const getActivePublicUserByCpf = vi.fn();
const getUserVoucherPurchaseById = vi.fn();
const cancelReservationPurchase = vi.fn();

vi.mock("@/lib/auth-session", () => ({
  clearAuthCookie,
  getAuthSession,
}));

vi.mock("@/lib/user-repository", () => ({
  getActivePublicUserByCpf,
}));

vi.mock("@/lib/voucher-repository", () => ({
  getUserVoucherPurchaseById,
  cancelReservationPurchase,
}));

describe("me/vouchers cancel BFF route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("cancels an eligible reservation", async () => {
    getAuthSession.mockResolvedValue({ sub: "52998224725" });
    getActivePublicUserByCpf.mockResolvedValue({
      cpf: "52998224725",
      cpfMasked: "529.***.***-25",
      name: "Cliente Teste",
      email: "cliente@example.com",
      status: "ati",
    });
    getUserVoucherPurchaseById.mockResolvedValue({
      id: 202,
      legacyEncodedId: "MjAy",
      type: "reser",
      typeLabel: "Reserva",
      purchaseDate: "2026-07-18",
      totalValue: "80.00",
      status: "pend",
      statusLabel: "Em processamento",
      payment: {
        provider: "bilheteria",
        status: null,
        statusLabel: "Bilheteria",
        methodType: null,
      },
      unusedVoucherCount: 2,
      voucherCount: 2,
      canGenerateVoucher: false,
      canCancelReservation: true,
      vouchers: [],
    });
    cancelReservationPurchase.mockResolvedValue(202);

    const { POST } = await import(
      "@/app/api/me/vouchers/[voucherId]/cancel/route"
    );
    const response = await POST(
      new Request("https://example.com/api/me/vouchers/202/cancel", {
        method: "POST",
      }),
      { params: Promise.resolve({ voucherId: "202" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(cancelReservationPurchase).toHaveBeenCalledWith("52998224725", 202);
    expect(body).toEqual({
      ok: true,
      data: {
        purchaseId: 202,
        status: "canc",
        statusLabel: "Cancelado",
      },
    });
  });

  it("rejects cancel when the reservation is no longer eligible", async () => {
    getAuthSession.mockResolvedValue({ sub: "52998224725" });
    getActivePublicUserByCpf.mockResolvedValue({
      cpf: "52998224725",
      cpfMasked: "529.***.***-25",
      name: "Cliente Teste",
      email: "cliente@example.com",
      status: "ati",
    });
    getUserVoucherPurchaseById.mockResolvedValue({
      id: 202,
      legacyEncodedId: "MjAy",
      type: "reser",
      typeLabel: "Reserva",
      purchaseDate: "2026-07-18",
      totalValue: "80.00",
      status: "canc",
      statusLabel: "Cancelado",
      payment: {
        provider: "bilheteria",
        status: null,
        statusLabel: "Bilheteria",
        methodType: null,
      },
      unusedVoucherCount: 0,
      voucherCount: 2,
      canGenerateVoucher: false,
      canCancelReservation: false,
      vouchers: [],
    });

    const { POST } = await import(
      "@/app/api/me/vouchers/[voucherId]/cancel/route"
    );
    const response = await POST(
      new Request("https://example.com/api/me/vouchers/202/cancel", {
        method: "POST",
      }),
      { params: Promise.resolve({ voucherId: "202" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(cancelReservationPurchase).not.toHaveBeenCalled();
    expect(body).toEqual({
      ok: false,
      error: {
        code: "reservation_cancel_unavailable",
        message: "Esta reserva nao pode mais ser cancelada.",
      },
    });
  });
});
