import { beforeEach, describe, expect, it, vi } from "vitest";

const clearAuthCookie = vi.fn();
const getAuthSession = vi.fn();
const getActivePublicUserByCpf = vi.fn();
const getCielo3dsTokenData = vi.fn();
const isCielo3dsConfigured = vi.fn();

vi.mock("@/lib/auth-session", () => ({
  clearAuthCookie,
  getAuthSession,
}));

vi.mock("@/lib/user-repository", () => ({
  getActivePublicUserByCpf,
}));

vi.mock("@/lib/cielo-3ds", () => ({
  getCielo3dsTokenData,
  isCielo3dsConfigured,
}));

describe("checkout cielo3ds-token route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthSession.mockResolvedValue({ sub: "52998224725" });
    getActivePublicUserByCpf.mockResolvedValue({
      cpf: "52998224725",
      status: "ati",
    });
    isCielo3dsConfigured.mockReturnValue(true);
    getCielo3dsTokenData.mockResolvedValue({
      accessToken: "token-123",
      tokenType: "Bearer",
      expiresIn: 840,
      environment: "PRD",
      debug: false,
    });
    vi.stubGlobal("fetch", vi.fn());
  });

  it("returns a native 3ds token when bff credentials are configured", async () => {
    const { GET } = await import("@/app/api/checkout/cielo3ds-token/route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      status: "00",
      accessToken: "token-123",
      tokenType: "Bearer",
      expiresIn: 840,
      environment: "PRD",
      debug: false,
    });
    expect(getCielo3dsTokenData).toHaveBeenCalledTimes(1);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("blocks 3ds token creation without falling back when native 3ds is not configured", async () => {
    isCielo3dsConfigured.mockReturnValue(false);
    vi.stubGlobal("fetch", vi.fn());

    const { GET } = await import("@/app/api/checkout/cielo3ds-token/route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({
      status: "10",
      msg: "Autenticacao 3DS indisponivel neste ambiente.",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("keeps the legacy error contract when the native token request fails", async () => {
    getCielo3dsTokenData.mockRejectedValue(
      new Error("Falha ao obter token 3DS: unauthorized"),
    );

    const { GET } = await import("@/app/api/checkout/cielo3ds-token/route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      status: "10",
      msg: "Falha ao obter token 3DS: unauthorized",
    });
  });

  it("clears the auth cookie when the public user no longer exists", async () => {
    getActivePublicUserByCpf.mockResolvedValue(null);

    const { GET } = await import("@/app/api/checkout/cielo3ds-token/route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toMatchObject({
      ok: false,
      error: {
        code: "unauthenticated",
      },
    });
    expect(clearAuthCookie).toHaveBeenCalledWith(response);
  });
});
