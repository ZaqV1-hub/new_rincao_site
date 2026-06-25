import { beforeEach, describe, expect, it, vi } from "vitest";

const clearAuthCookie = vi.fn();
const getAuthSession = vi.fn();
const checkPublicUserPassword = vi.fn();
const getActivePublicUserByCpf = vi.fn();
const updatePublicUserPassword = vi.fn();

vi.mock("@/lib/auth-session", () => ({
  clearAuthCookie,
  getAuthSession,
}));

vi.mock("@/lib/user-repository", () => ({
  checkPublicUserPassword,
  getActivePublicUserByCpf,
  updatePublicUserPassword,
}));

describe("customer profile password route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthSession.mockResolvedValue({ sub: "52998224725" });
    getActivePublicUserByCpf.mockResolvedValue({
      cpf: "52998224725",
      name: "Cliente Teste",
      email: "cliente@example.com",
      status: "ati",
    });
    checkPublicUserPassword.mockResolvedValue(true);
    updatePublicUserPassword.mockResolvedValue(undefined);
  });

  it("returns validation error when current password is incorrect", async () => {
    checkPublicUserPassword.mockResolvedValue(false);

    const { POST } = await import("@/app/api/me/profile/password/route");
    const response = await POST(
      new Request("https://example.com/api/me/profile/password", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          currentPassword: "errada",
          newPassword: "NovaSenha123",
          confirmPassword: "NovaSenha123",
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      ok: false,
      error: {
        code: "invalid_current_password",
        message: "A senha atual informada nao esta correta.",
      },
    });
    expect(updatePublicUserPassword).not.toHaveBeenCalled();
  });

  it("returns unauthenticated when session is missing", async () => {
    getAuthSession.mockResolvedValue(null);

    const { POST } = await import("@/app/api/me/profile/password/route");
    const response = await POST(
      new Request("https://example.com/api/me/profile/password", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          currentPassword: "Atual123",
          newPassword: "NovaSenha123",
          confirmPassword: "NovaSenha123",
        }),
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
