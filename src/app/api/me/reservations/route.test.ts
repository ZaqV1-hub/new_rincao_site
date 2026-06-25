import { beforeEach, describe, expect, it, vi } from "vitest";

const clearAuthCookie = vi.fn();
const getAuthSession = vi.fn();
const getActivePublicUserByCpf = vi.fn();
const createReservationPurchase = vi.fn();

vi.mock("@/lib/auth-session", () => ({
  clearAuthCookie,
  getAuthSession,
}));

vi.mock("@/lib/user-repository", () => ({
  getActivePublicUserByCpf,
}));

vi.mock("@/lib/reservation-repository", async () => {
  const actual = await vi.importActual<typeof import("@/lib/reservation-repository")>(
    "@/lib/reservation-repository",
  );

  return {
    ...actual,
    createReservationPurchase,
  };
});

describe("me/reservations BFF route", () => {
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

  it("creates a reservation for the authenticated customer", async () => {
    createReservationPurchase.mockResolvedValue({
      purchaseId: 321,
      legacyEncodedId: "MzIx",
      totalValue: "240.00",
      voucherCount: 3,
    });

    const { POST } = await import("@/app/api/me/reservations/route");
    const response = await POST(
      new Request("https://example.com/api/me/reservations", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          agendaId: 123,
          quantities: {
            normal: 2,
            child: 1,
            exempt: 0,
          },
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(createReservationPurchase).toHaveBeenCalledWith("52998224725", 123, {
      normal: 2,
      child: 1,
      exempt: 0,
    });
    expect(body).toEqual({
      ok: true,
      data: {
        purchaseId: 321,
        legacyEncodedId: "MzIx",
        totalValue: "240.00",
        voucherCount: 3,
      },
    });
  });

  it("rejects empty reservation payloads", async () => {
    const { POST } = await import("@/app/api/me/reservations/route");
    const response = await POST(
      new Request("https://example.com/api/me/reservations", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          agendaId: 123,
          quantities: {
            normal: 0,
            child: 0,
            exempt: 0,
          },
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(createReservationPurchase).not.toHaveBeenCalled();
    expect(body).toEqual({
      ok: false,
      error: {
        code: "invalid_reservation",
        message: "Informe agenda e quantidades validas para reservar.",
      },
    });
  });

  it("clears the cookie when the session no longer resolves to an active user", async () => {
    getActivePublicUserByCpf.mockResolvedValue(null);

    const { POST } = await import("@/app/api/me/reservations/route");
    const response = await POST(
      new Request("https://example.com/api/me/reservations", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          agendaId: 123,
          quantities: {
            normal: 1,
            child: 0,
            exempt: 0,
          },
        }),
      }),
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

  it("returns normalized repository errors", async () => {
    const { ReservationCreationError } = await import(
      "@/lib/reservation-repository"
    );
    createReservationPurchase.mockRejectedValue(
      new ReservationCreationError(
        "agenda_not_found",
        "Data de visita indisponivel para reserva.",
        404,
      ),
    );

    const { POST } = await import("@/app/api/me/reservations/route");
    const response = await POST(
      new Request("https://example.com/api/me/reservations", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          agendaId: 123,
          quantities: {
            normal: 1,
            child: 0,
            exempt: 0,
          },
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({
      ok: false,
      error: {
        code: "agenda_not_found",
        message: "Data de visita indisponivel para reserva.",
      },
    });
  });
});
