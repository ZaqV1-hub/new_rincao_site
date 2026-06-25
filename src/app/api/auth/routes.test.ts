import { beforeEach, describe, expect, it, vi } from "vitest";

const createAuthSessionToken = vi.fn();
const setAuthCookie = vi.fn();
const clearAuthCookie = vi.fn();
const getAuthSession = vi.fn();
const authenticatePublicUser = vi.fn();
const createPublicUser = vi.fn();
const findPublicUserByCpf = vi.fn();
const findPublicUserByEmail = vi.fn();
const getProfileCityById = vi.fn();
const getActivePublicUserByCpf = vi.fn();
const isValidCpf = vi.fn();
const listProfileCitiesByUf = vi.fn();
const listProfileUfs = vi.fn();
const sanitizeCpf = vi.fn();

vi.mock("@/lib/auth-session", () => ({
  createAuthSessionToken,
  setAuthCookie,
  clearAuthCookie,
  getAuthSession,
}));

vi.mock("@/lib/user-repository", () => ({
  authenticatePublicUser,
  createPublicUser,
  findPublicUserByCpf,
  findPublicUserByEmail,
  getActivePublicUserByCpf,
  getProfileCityById,
  isValidCpf,
  listProfileCitiesByUf,
  listProfileUfs,
  sanitizeCpf,
}));

describe("auth BFF routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sanitizeCpf.mockImplementation((value: string) => value.replace(/\D/g, ""));
    isValidCpf.mockReturnValue(true);
    listProfileUfs.mockResolvedValue([
      { id: "SP", name: "Sao Paulo" },
      { id: "RJ", name: "Rio de Janeiro" },
    ]);
  });

  it("creates a BFF session on successful login", async () => {
    authenticatePublicUser.mockResolvedValue({
      cpf: "52998224725",
      cpfMasked: "529.***.***-25",
      name: "Cliente Teste",
      email: "cliente@example.com",
      status: "ati",
    });
    createAuthSessionToken.mockReturnValue("signed-token");

    const { POST } = await import("@/app/api/auth/login/route");
    const response = await POST(
      new Request("https://example.com/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          login: "529.982.247-25",
          senha: "senha",
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(authenticatePublicUser).toHaveBeenCalledWith("52998224725", "senha");
    expect(createAuthSessionToken).toHaveBeenCalled();
    expect(setAuthCookie).toHaveBeenCalledWith(response, "signed-token");
    expect(body).toEqual({
      ok: true,
      data: {
        user: {
          name: "Cliente Teste",
          cpfMasked: "529.***.***-25",
          email: "cliente@example.com",
        },
      },
    });
  });

  it("returns invalid credentials when cpf validation fails", async () => {
    isValidCpf.mockReturnValue(false);

    const { POST } = await import("@/app/api/auth/login/route");
    const response = await POST(
      new Request("https://example.com/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          login: "111",
          senha: "senha",
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(authenticatePublicUser).not.toHaveBeenCalled();
    expect(body).toEqual({
      ok: false,
      error: {
        code: "invalid_credentials",
        message: "CPF ou senha invalidos.",
      },
    });
  });

  it("redirects native form submissions back to login with an explicit error", async () => {
    isValidCpf.mockReturnValue(false);

    const formData = new FormData();
    formData.set("login", "111");
    formData.set("senha", "senha");
    formData.set("redirect", "/agenda");

    const { POST } = await import("@/app/api/auth/login/route");
    const response = await POST(
      new Request("https://example.com/api/auth/login", {
        method: "POST",
        body: formData,
      }),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://example.com/login?redirect=%2Fagenda&error=invalid_credentials",
    );
    expect(authenticatePublicUser).not.toHaveBeenCalled();
  });

  it("redirects native form submissions to the requested destination after login", async () => {
    authenticatePublicUser.mockResolvedValue({
      cpf: "52998224725",
      cpfMasked: "529.***.***-25",
      name: "Cliente Teste",
      email: "cliente@example.com",
      status: "ati",
    });
    createAuthSessionToken.mockReturnValue("signed-token");

    const formData = new FormData();
    formData.set("login", "529.982.247-25");
    formData.set("senha", "senha");
    formData.set("redirect", "/agenda");

    const { POST } = await import("@/app/api/auth/login/route");
    const response = await POST(
      new Request("https://example.com/api/auth/login", {
        method: "POST",
        body: formData,
      }),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://example.com/agenda");
    expect(setAuthCookie).toHaveBeenCalledWith(response, "signed-token");
  });

  it("returns the current authenticated user", async () => {
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

    const { GET } = await import("@/app/api/auth/me/route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(getActivePublicUserByCpf).toHaveBeenCalledWith("52998224725");
    expect(body).toEqual({
      ok: true,
      data: {
        user: {
          name: "Cliente Teste",
          cpfMasked: "529.***.***-25",
          email: "cliente@example.com",
        },
      },
    });
  });

  it("clears the cookie when the authenticated user no longer exists", async () => {
    getAuthSession.mockResolvedValue({
      sub: "52998224725",
    });
    getActivePublicUserByCpf.mockResolvedValue(null);

    const { GET } = await import("@/app/api/auth/me/route");
    const response = await GET();
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

  it("registers a new public user and opens a session", async () => {
    getProfileCityById.mockResolvedValue({
      id: 9668,
      name: "Sao Paulo",
      uf: "SP",
    });
    findPublicUserByCpf.mockResolvedValue(null);
    findPublicUserByEmail.mockResolvedValue(null);
    createPublicUser.mockResolvedValue({
      cpf: "52998224725",
      cpfMasked: "529.***.***-25",
      name: "Cliente Teste",
      email: "cliente@example.com",
      status: "ati",
    });
    createAuthSessionToken.mockReturnValue("signed-token");

    const { POST } = await import("@/app/api/auth/register/route");
    const response = await POST(
      new Request("https://example.com/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          cpf: "529.982.247-25",
          password: "senha123",
          confirmPassword: "senha123",
          name: "Cliente Teste",
          email: "cliente@example.com",
          rg: "123456789",
          birthDate: "1990-01-01",
          sex: "m",
          phone: "1155550000",
          mobile: "11999990000",
          address: "Rua Teste",
          number: "123",
          cep: "04870425",
          district: "Jardim Casa Grande",
          uf: "SP",
          cityId: 9668,
          complement: "Casa",
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(findPublicUserByCpf).toHaveBeenCalledWith("52998224725");
    expect(findPublicUserByEmail).toHaveBeenCalledWith("cliente@example.com");
    expect(createPublicUser).toHaveBeenCalledWith(
      expect.objectContaining({
        cpf: "52998224725",
        email: "cliente@example.com",
        cityId: 9668,
        phone: "1155550000",
        mobile: "11999990000",
      }),
    );
    expect(setAuthCookie).toHaveBeenCalledWith(response, "signed-token");
    expect(body).toEqual({
      ok: true,
      data: {
        user: {
          name: "Cliente Teste",
          cpfMasked: "529.***.***-25",
          email: "cliente@example.com",
        },
      },
    });
  });

  it("returns conflict when cpf is already registered", async () => {
    getProfileCityById.mockResolvedValue({
      id: 9668,
      name: "Sao Paulo",
      uf: "SP",
    });
    findPublicUserByCpf.mockResolvedValue({
      cpf: "52998224725",
      cpfMasked: "529.***.***-25",
      name: "Cliente Teste",
      email: "cliente@example.com",
      status: "ati",
    });
    findPublicUserByEmail.mockResolvedValue(null);

    const { POST } = await import("@/app/api/auth/register/route");
    const response = await POST(
      new Request("https://example.com/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          cpf: "529.982.247-25",
          password: "senha123",
          confirmPassword: "senha123",
          name: "Cliente Teste",
          email: "cliente@example.com",
          birthDate: "1990-01-01",
          sex: "m",
          address: "Rua Teste",
          cep: "04870425",
          district: "Jardim Casa Grande",
          uf: "SP",
          cityId: 9668,
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(createPublicUser).not.toHaveBeenCalled();
    expect(body).toEqual({
      ok: false,
      error: {
        code: "cpf_in_use",
        message: "Seu CPF ja esta vinculado a uma conta.",
      },
    });
  });

  it("returns public registration reference data", async () => {
    listProfileCitiesByUf.mockResolvedValue([
      { id: 9668, name: "Sao Paulo" },
    ]);

    const { GET } = await import("@/app/api/auth/registration-data/route");
    const response = await GET(
      new Request("https://example.com/api/auth/registration-data?uf=SP"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(listProfileCitiesByUf).toHaveBeenCalledWith("SP");
    expect(body).toEqual({
      ok: true,
      data: {
        ufs: [
          { id: "SP", name: "Sao Paulo" },
          { id: "RJ", name: "Rio de Janeiro" },
        ],
        cities: [{ id: 9668, name: "Sao Paulo" }],
        selectedUf: "SP",
      },
    });
  });
});
