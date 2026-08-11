import { NextResponse } from "next/server";
import type { AuthErrorResponse } from "@/lib/auth-contracts";
import {
  createPanelSessionToken,
  setOperationsSessionCookie,
  verifyOperationsSessionToken,
} from "@/lib/ops-session";
import {
  sanitizePainelRedirect,
  shouldBypassPainelRecaptcha,
} from "@/lib/painel-login";
import { verifyRecaptchaToken } from "@/lib/recaptcha";
import {
  authenticatePanelUser,
  sanitizeCpf,
} from "@/lib/user-repository";
import { isValidCpf } from "@/lib/cpf";
import { getDefaultPainelPath } from "@/lib/painel-access";

export const runtime = "nodejs";

type LoginPayload = {
  cpf?: unknown;
  login?: unknown;
  senha?: unknown;
  password?: unknown;
  recaptchaToken?: unknown;
  redirect?: unknown;
};

type ParsedPayload = {
  payload: LoginPayload | null;
  nativeFormSubmit: boolean;
};

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json<AuthErrorResponse>(
    {
      ok: false,
      error: {
        code,
        message,
      },
    },
    { status },
  );
}

async function parsePayload(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (
    contentType.includes("multipart/form-data") ||
    contentType.includes("application/x-www-form-urlencoded")
  ) {
    try {
      const formData = await request.formData();

      return {
        payload: {
          cpf: formData.get("cpf"),
          login: formData.get("login"),
          senha: formData.get("senha"),
          password: formData.get("password"),
          recaptchaToken: formData.get("recaptchaToken"),
          redirect: formData.get("redirect"),
        },
        nativeFormSubmit: true,
      } satisfies ParsedPayload;
    } catch {
      return {
        payload: null,
        nativeFormSubmit: true,
      } satisfies ParsedPayload;
    }
  }

  try {
    return {
      payload: (await request.json()) as LoginPayload,
      nativeFormSubmit: false,
    } satisfies ParsedPayload;
  } catch {
    return {
      payload: null,
      nativeFormSubmit: false,
    } satisfies ParsedPayload;
  }
}

function painelLoginRedirectResponse(
  requestUrl: string,
  redirectTo: string,
  errorCode?: string,
) {
  if (!errorCode) {
    return NextResponse.redirect(new URL(redirectTo, requestUrl), 303);
  }

  const url = new URL("/painel/login", requestUrl);
  url.searchParams.set("redirect", redirectTo);
  url.searchParams.set("error", errorCode);

  return NextResponse.redirect(url, 303);
}

export async function POST(request: Request) {
  const { payload, nativeFormSubmit } = await parsePayload(request);
  const redirectTo = sanitizePainelRedirect(
    typeof payload?.redirect === "string" ? payload.redirect : undefined,
  );
  const rawLogin =
    typeof payload?.cpf === "string"
      ? payload.cpf
      : typeof payload?.login === "string"
        ? payload.login
        : "";
  const login = rawLogin.trim();
  const cpf = sanitizeCpf(login);
  const isEmailLogin = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(login);
  const isContractLogin = redirectTo === "/contrato";
  const password =
    typeof payload?.senha === "string"
      ? payload.senha
      : typeof payload?.password === "string"
        ? payload.password
        : "";
  const recaptchaToken =
    typeof payload?.recaptchaToken === "string" ? payload.recaptchaToken : "";

  const isPanelSeedLogin = cpf === "22181922845";
  const invalidLogin = isContractLogin
    ? !isEmailLogin && !isValidCpf(cpf) && !isPanelSeedLogin
    : !isValidCpf(cpf) && !isPanelSeedLogin;
  const invalidMessage = isContractLogin
    ? "E-mail ou senha invalidos."
    : "CPF ou senha invalidos.";

  if (invalidLogin || password.length < 1 || password.length > 20) {
    if (nativeFormSubmit) {
      return painelLoginRedirectResponse(
        request.url,
        redirectTo,
        "invalid_credentials",
      );
    }

    return errorResponse(
      "invalid_credentials",
      invalidMessage,
      401,
    );
  }

  try {
    const recaptcha = shouldBypassPainelRecaptcha(request.url)
      ? {
          ok: true as const,
          skipped: true as const,
        }
      : await verifyRecaptchaToken({
          token: recaptchaToken,
          action: "login",
        });

    if (!recaptcha.ok) {
      if (nativeFormSubmit) {
        return painelLoginRedirectResponse(
          request.url,
          redirectTo,
          recaptcha.code,
        );
      }

      return errorResponse(recaptcha.code, recaptcha.message, 400);
    }

    const user = await authenticatePanelUser(isEmailLogin ? login : cpf, password);

    if (!user || user.roleId === null) {
      if (nativeFormSubmit) {
        return painelLoginRedirectResponse(
          request.url,
          redirectTo,
          "invalid_credentials",
        );
      }

      return errorResponse(
        "invalid_credentials",
        invalidMessage,
        401,
      );
    }

    if (isContractLogin && user.roleId !== 4) {
      if (nativeFormSubmit) {
        return painelLoginRedirectResponse(
          request.url,
          redirectTo,
          "invalid_contract_role",
        );
      }

      return errorResponse(
        "invalid_contract_role",
        "Apenas representantes podem acessar o contrato.",
        403,
      );
    }

    if (user.status !== "ati") {
      if (nativeFormSubmit) {
        return painelLoginRedirectResponse(
          request.url,
          redirectTo,
          "inactive_user",
        );
      }

      return errorResponse(
        "inactive_user",
        "Este usuario nao esta ativo.",
        403,
      );
    }

    const sessionToken = createPanelSessionToken(user);
    const session = verifyOperationsSessionToken(sessionToken);

    if (!session) {
      if (nativeFormSubmit) {
        return painelLoginRedirectResponse(
          request.url,
          redirectTo,
          "operations_session_invalid",
        );
      }

      return errorResponse(
        "operations_session_invalid",
        "Nao foi possivel abrir a sessao do painel.",
        500,
      );
    }

    if (nativeFormSubmit) {
      const response = painelLoginRedirectResponse(
        request.url,
        redirectTo === "/painel"
          ? getDefaultPainelPath(session.legacyRoleId)
          : redirectTo,
      );
      setOperationsSessionCookie(response, sessionToken);
      return response;
    }

    const response = NextResponse.json({
      ok: true,
      data: {
        authenticated: true,
        actorName: session.actorName,
        actorCpf: session.actorCpf,
        role: session.role,
        permissions: session.permissions,
        authSource: session.authSource ?? "panel",
        legacyRoleId: session.legacyRoleId ?? null,
        legacyRoleName: session.legacyRoleName ?? null,
        legacyResources: session.legacyResources ?? [],
        defaultRedirect: getDefaultPainelPath(session.legacyRoleId),
      },
    });

    setOperationsSessionCookie(response, sessionToken);

    return response;
  } catch (error) {
    console.error("painel-session-login-bff-failed", error);

    if (nativeFormSubmit) {
      return painelLoginRedirectResponse(
        request.url,
        redirectTo,
        "auth_unavailable",
      );
    }

    return errorResponse(
      "auth_unavailable",
      "Nao foi possivel autenticar agora.",
      502,
    );
  }
}
