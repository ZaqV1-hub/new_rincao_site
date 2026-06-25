import { beforeEach, describe, expect, it, vi } from "vitest";

const getCustomerPasswordResetTicket = vi.fn();
const resetCustomerPassword = vi.fn();

vi.mock("@/lib/customer-password-reset", () => ({
  getCustomerPasswordResetTicket,
  resetCustomerPassword,
}));

describe("auth/password-reset/tickets/[ticket] route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns whether a public reset ticket is valid", async () => {
    getCustomerPasswordResetTicket.mockResolvedValue({
      exists: true,
      valid: true,
      cpf: "52998224725",
    });

    const { GET } = await import(
      "@/app/api/auth/password-reset/tickets/[ticket]/route"
    );
    const response = await GET(
      new Request("https://example.com/api/auth/password-reset/tickets/abc"),
      {
        params: Promise.resolve({
          ticket: "abc",
        }),
      },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      data: {
        valid: true,
      },
    });
  });

  it("resets the public password when the ticket is valid", async () => {
    resetCustomerPassword.mockResolvedValue({
      ok: true,
    });

    const { POST } = await import(
      "@/app/api/auth/password-reset/tickets/[ticket]/route"
    );
    const response = await POST(
      new Request("https://example.com/api/auth/password-reset/tickets/abc", {
        method: "POST",
        body: JSON.stringify({
          senha: "nova-senha",
          csenha: "nova-senha",
        }),
      }),
      {
        params: Promise.resolve({
          ticket: "abc",
        }),
      },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(resetCustomerPassword).toHaveBeenCalledWith({
      ticket: "abc",
      password: "nova-senha",
    });
    expect(body).toEqual({
      ok: true,
      data: {
        changed: true,
      },
    });
  });

  it("rejects password confirmation mismatches", async () => {
    const { POST } = await import(
      "@/app/api/auth/password-reset/tickets/[ticket]/route"
    );
    const response = await POST(
      new Request("https://example.com/api/auth/password-reset/tickets/abc", {
        method: "POST",
        body: JSON.stringify({
          senha: "nova-senha",
          csenha: "diferente",
        }),
      }),
      {
        params: Promise.resolve({
          ticket: "abc",
        }),
      },
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(resetCustomerPassword).not.toHaveBeenCalled();
    expect(body).toEqual({
      ok: false,
      error: {
        code: "password_confirmation_mismatch",
        message: "O campo confirmar deve conter um valor igual ao campo senha.",
      },
    });
  });

  it("returns invalid ticket when the ticket is no longer usable", async () => {
    resetCustomerPassword.mockResolvedValue({
      ok: false,
      code: "invalid_ticket",
    });

    const { POST } = await import(
      "@/app/api/auth/password-reset/tickets/[ticket]/route"
    );
    const response = await POST(
      new Request("https://example.com/api/auth/password-reset/tickets/abc", {
        method: "POST",
        body: JSON.stringify({
          senha: "nova-senha",
          csenha: "nova-senha",
        }),
      }),
      {
        params: Promise.resolve({
          ticket: "abc",
        }),
      },
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({
      ok: false,
      error: {
        code: "invalid_ticket",
        message: "Ticket para troca de senha invalido.",
      },
    });
  });
});
