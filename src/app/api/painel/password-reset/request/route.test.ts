import { beforeEach, describe, expect, it, vi } from "vitest";

const requestPainelPasswordReset = vi.fn();

vi.mock("@/lib/painel-password-reset", () => ({
  requestPainelPasswordReset,
}));

describe("painel/password-reset/request route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requests a painel password reset by e-mail", async () => {
    requestPainelPasswordReset.mockResolvedValue({
      blocked: false,
      userFound: true,
      email: "operador@example.com",
    });

    const { POST } = await import(
      "@/app/api/painel/password-reset/request/route"
    );
    const response = await POST(
      new Request("https://example.com/api/painel/password-reset/request", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          email: "operador@example.com",
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(requestPainelPasswordReset).toHaveBeenCalledWith({
      email: "operador@example.com",
      origin: "https://example.com",
    });
    expect(body).toEqual({
      ok: true,
      data: {
        sent: true,
        email: "operador@example.com",
      },
    });
  });

  it("returns 429 when reset throttle blocks the request", async () => {
    requestPainelPasswordReset.mockResolvedValue({
      blocked: true,
      message: "Ja enviamos um link recentemente. Aguarde 2 min e tente novamente.",
    });

    const { POST } = await import(
      "@/app/api/painel/password-reset/request/route"
    );
    const response = await POST(
      new Request("https://example.com/api/painel/password-reset/request", {
        method: "POST",
        body: JSON.stringify({
          email: "operador@example.com",
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body).toEqual({
      ok: false,
      error: {
        code: "password_reset_throttled",
        message: "Ja enviamos um link recentemente. Aguarde 2 min e tente novamente.",
      },
    });
  });

  it("returns not found when the user email does not exist", async () => {
    requestPainelPasswordReset.mockResolvedValue({
      blocked: false,
      userFound: false,
    });

    const { POST } = await import(
      "@/app/api/painel/password-reset/request/route"
    );
    const response = await POST(
      new Request("https://example.com/api/painel/password-reset/request", {
        method: "POST",
        body: JSON.stringify({
          email: "inexistente@example.com",
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({
      ok: false,
      error: {
        code: "user_not_found",
        message: "Nenhum usuario foi encontrado utilizando este endereco de e-mail.",
      },
    });
  });
});
