import { beforeEach, describe, expect, it, vi } from "vitest";

const clearAuthCookie = vi.fn();
const getAuthSession = vi.fn();
const getActivePublicUserByCpf = vi.fn();
const getUserVouchersPage = vi.fn();

vi.mock("@/lib/auth-session", () => ({
  clearAuthCookie,
  getAuthSession,
}));

vi.mock("@/lib/user-repository", () => ({
  getActivePublicUserByCpf,
}));

vi.mock("@/lib/voucher-repository", () => ({
  getUserVouchersPage,
}));

describe("me/vouchers BFF route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects invalid pagination parameters", async () => {
    const { GET } = await import("@/app/api/me/vouchers/route");
    const response = await GET(
      new Request("https://example.com/api/me/vouchers?limit=0&offset=-1"),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      ok: false,
      error: {
        code: "invalid_pagination",
        message: "Informe limit e offset validos.",
      },
    });
  });

  it("requires a valid BFF session", async () => {
    getAuthSession.mockResolvedValue(null);

    const { GET } = await import("@/app/api/me/vouchers/route");
    const response = await GET(
      new Request("https://example.com/api/me/vouchers?limit=10&offset=0"),
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({
      ok: false,
      error: {
        code: "unauthenticated",
        message: "Sessao nao encontrada ou expirada.",
      },
    });
  });

  it("returns grouped purchases and vouchers for the authenticated user", async () => {
    getAuthSession.mockResolvedValue({
      sub: "52998224725",
    });
    getActivePublicUserByCpf.mockResolvedValue({
      cpf: "52998224725",
      cpfMasked: "529.***.***-25",
      name: "Cliente Teste",
      email: "cliente@example.com",
      status: "ati",
    });
    getUserVouchersPage.mockResolvedValue({
      totalPurchases: 2,
      purchases: [
        {
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
          unusedVoucherCount: 1,
          voucherCount: 1,
          canGenerateVoucher: true,
          canCancelReservation: false,
          vouchers: [],
        },
        {
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
        },
      ],
    });

    const { GET } = await import("@/app/api/me/vouchers/route");
    const response = await GET(
      new Request("https://example.com/api/me/vouchers?limit=10&offset=0"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(getUserVouchersPage).toHaveBeenCalledWith("52998224725", 10, 0);
    expect(body).toEqual({
      ok: true,
      data: {
        limit: 10,
        offset: 0,
        totalPurchases: 2,
        purchases: [
          {
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
            unusedVoucherCount: 1,
            voucherCount: 1,
            canGenerateVoucher: true,
            canCancelReservation: false,
            vouchers: [],
          },
          {
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
          },
        ],
        groups: {
          online: [
            {
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
              unusedVoucherCount: 1,
              voucherCount: 1,
              canGenerateVoucher: true,
              canCancelReservation: false,
              vouchers: [],
            },
          ],
          reservations: [
            {
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
            },
          ],
        },
      },
    });
  });

  it("clears the BFF session if the user becomes inactive", async () => {
    getAuthSession.mockResolvedValue({
      sub: "52998224725",
    });
    getActivePublicUserByCpf.mockResolvedValue(null);

    const { GET } = await import("@/app/api/me/vouchers/route");
    const response = await GET(
      new Request("https://example.com/api/me/vouchers?limit=10&offset=0"),
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
