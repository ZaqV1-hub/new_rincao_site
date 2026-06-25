import { beforeEach, describe, expect, it, vi } from "vitest";

const createPanelSessionToken = vi.fn();
const setOperationsSessionCookie = vi.fn();
const verifyOperationsSessionToken = vi.fn();
const authenticatePanelUser = vi.fn();
const isValidCpf = vi.fn();
const sanitizeCpf = vi.fn();
const verifyRecaptchaToken = vi.fn();

vi.mock("@/lib/ops-session", () => ({
  createPanelSessionToken,
  setOperationsSessionCookie,
  verifyOperationsSessionToken,
}));

vi.mock("@/lib/user-repository", () => ({
  authenticatePanelUser,
  isValidCpf,
  sanitizeCpf,
}));

vi.mock("@/lib/recaptcha", () => ({
  verifyRecaptchaToken,
}));

describe("painel/session BFF route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sanitizeCpf.mockImplementation((value: string) => value.replace(/\D/g, ""));
    isValidCpf.mockReturnValue(true);
    verifyRecaptchaToken.mockResolvedValue({
      ok: true,
      skipped: false,
      score: 0.9,
    });
  });

  it("creates a painel session cookie from cpf and senha", async () => {
    authenticatePanelUser.mockResolvedValue({
      cpf: "52998224725",
      cpfMasked: "529.***.***-25",
      name: "Operador Teste",
      email: "operador@example.com",
      status: "ati",
      roleId: 2,
      roleName: "Funcionario",
      legacyResources: ["vis_bilhet", "vis_compra"],
      operationsRole: "operator",
      permissions: ["ops.read", "ops.vouchers", "ops.purchases", "ops.cash"],
    });
    createPanelSessionToken.mockReturnValue("panel-session");
    verifyOperationsSessionToken.mockReturnValue({
      actorName: "Operador Teste",
      actorCpf: "52998224725",
      role: "operator",
      permissions: ["ops.read", "ops.vouchers", "ops.purchases", "ops.cash"],
      authSource: "panel",
      legacyRoleId: 2,
      legacyRoleName: "Funcionario",
      legacyResources: ["vis_bilhet", "vis_compra"],
    });

    const { POST } = await import("@/app/api/painel/session/route");
    const response = await POST(
      new Request("https://example.com/api/painel/session", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          login: "529.982.247-25",
          senha: "senha",
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(verifyRecaptchaToken).toHaveBeenCalledWith({
      token: "",
      action: "login",
    });
    expect(authenticatePanelUser).toHaveBeenCalledWith("52998224725", "senha");
    expect(setOperationsSessionCookie).toHaveBeenCalledWith(response, "panel-session");
    expect(body).toEqual({
      ok: true,
      data: {
        authenticated: true,
        actorName: "Operador Teste",
        actorCpf: "52998224725",
        role: "operator",
        permissions: ["ops.read", "ops.vouchers", "ops.purchases", "ops.cash"],
        authSource: "panel",
        legacyRoleId: 2,
        legacyRoleName: "Funcionario",
        legacyResources: ["vis_bilhet", "vis_compra"],
        defaultRedirect: "/painel",
      },
    });
  });

  it("redirects native form submissions back to login with explicit invalid credentials", async () => {
    isValidCpf.mockReturnValue(false);

    const formData = new FormData();
    formData.set("login", "111");
    formData.set("senha", "senha");
    formData.set("redirect", "/painel/bilheteria");

    const { POST } = await import("@/app/api/painel/session/route");
    const response = await POST(
      new Request("https://example.com/api/painel/session", {
        method: "POST",
        body: formData,
      }),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://example.com/painel/login?redirect=%2Fpainel%2Fbilheteria&error=invalid_credentials",
    );
    expect(authenticatePanelUser).not.toHaveBeenCalled();
  });

  it("redirects native form submissions to the target path after login", async () => {
    authenticatePanelUser.mockResolvedValue({
      cpf: "52998224725",
      cpfMasked: "529.***.***-25",
      name: "Operador Teste",
      email: "operador@example.com",
      status: "ati",
      roleId: 2,
      roleName: "Funcionario",
      legacyResources: ["vis_bilhet", "vis_compra"],
      operationsRole: "operator",
      permissions: ["ops.read", "ops.vouchers", "ops.purchases", "ops.cash"],
    });
    createPanelSessionToken.mockReturnValue("panel-session");
    verifyOperationsSessionToken.mockReturnValue({
      actorName: "Operador Teste",
      actorCpf: "52998224725",
      role: "operator",
      permissions: ["ops.read", "ops.vouchers", "ops.purchases", "ops.cash"],
      authSource: "panel",
      legacyRoleId: 2,
      legacyRoleName: "Funcionario",
      legacyResources: ["vis_bilhet", "vis_compra"],
    });

    const formData = new FormData();
    formData.set("login", "529.982.247-25");
    formData.set("senha", "senha");
    formData.set("redirect", "/painel/bilheteria");

    const { POST } = await import("@/app/api/painel/session/route");
    const response = await POST(
      new Request("http://127.0.0.1:3000/api/painel/session", {
        method: "POST",
        body: formData,
      }),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "http://127.0.0.1:3000/painel/bilheteria",
    );
    expect(setOperationsSessionCookie).toHaveBeenCalledWith(response, "panel-session");
    expect(verifyRecaptchaToken).not.toHaveBeenCalled();
  });

  it("rejects invalid credentials payloads before querying the database", async () => {
    isValidCpf.mockReturnValue(false);

    const { POST } = await import("@/app/api/painel/session/route");
    const response = await POST(
      new Request("https://example.com/api/painel/session", {
        method: "POST",
        body: JSON.stringify({
          login: "111",
          senha: "senha",
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(authenticatePanelUser).not.toHaveBeenCalled();
    expect(body).toEqual({
      ok: false,
      error: {
        code: "invalid_credentials",
        message: "CPF ou senha invalidos.",
      },
    });
  });

  it("rejects requests when recaptcha validation fails", async () => {
    verifyRecaptchaToken.mockResolvedValue({
      ok: false,
      code: "recaptcha_rejected",
      message: "Ocorreu um erro ao validar o Recaptcha, tente novamente.",
    });

    const { POST } = await import("@/app/api/painel/session/route");
    const response = await POST(
      new Request("https://example.com/api/painel/session", {
        method: "POST",
        body: JSON.stringify({
          login: "52998224725",
          senha: "senha",
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(authenticatePanelUser).not.toHaveBeenCalled();
    expect(body).toEqual({
      ok: false,
      error: {
        code: "recaptcha_rejected",
        message: "Ocorreu um erro ao validar o Recaptcha, tente novamente.",
      },
    });
  });

  it("rejects users without painel role", async () => {
    authenticatePanelUser.mockResolvedValue({
      cpf: "52998224725",
      cpfMasked: "529.***.***-25",
      name: "Cliente Sem Papel",
      email: "site@example.com",
      status: "ati",
      roleId: null,
      roleName: null,
      legacyResources: [],
      operationsRole: null,
      permissions: [],
    });

    const { POST } = await import("@/app/api/painel/session/route");
    const response = await POST(
      new Request("https://example.com/api/painel/session", {
        method: "POST",
        body: JSON.stringify({
          login: "52998224725",
          senha: "senha",
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({
      ok: false,
      error: {
        code: "invalid_credentials",
        message: "CPF ou senha invalidos.",
      },
    });
  });

  it("rejects inactive painel users", async () => {
    authenticatePanelUser.mockResolvedValue({
      cpf: "52998224725",
      cpfMasked: "529.***.***-25",
      name: "Operador Inativo",
      email: "operador@example.com",
      status: "ina",
      roleId: 1,
      roleName: "Gerente",
      legacyResources: ["vis_bilhet"],
      operationsRole: "admin",
      permissions: ["ops.read"],
    });

    const { POST } = await import("@/app/api/painel/session/route");
    const response = await POST(
      new Request("https://example.com/api/painel/session", {
        method: "POST",
        body: JSON.stringify({
          login: "52998224725",
          senha: "senha",
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({
      ok: false,
      error: {
        code: "inactive_user",
        message: "Este usuario nao esta ativo.",
      },
    });
  });
});
