import { NextResponse } from "next/server";
import type {
  AuthErrorResponse,
  AuthLoginResponse,
} from "@/lib/auth-contracts";
import { createAuthSessionToken, setAuthCookie } from "@/lib/auth-session";
import {
  authenticatePublicUser,
  isValidCpf,
  sanitizeCpf,
} from "@/lib/user-repository";
import { sanitizeCustomerRedirect } from "@/lib/customer-area";

export const runtime = "nodejs";

type LoginPayload = {
  cpf?: string;
  login?: string;
  senha?: string;
  password?: string;
  redirect?: string;
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
          cpf: String(formData.get("cpf") ?? ""),
          login: String(formData.get("login") ?? ""),
          senha: String(formData.get("senha") ?? formData.get("password") ?? ""),
          password: String(formData.get("password") ?? ""),
          redirect: String(formData.get("redirect") ?? ""),
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

function loginRedirectResponse(
  requestUrl: string,
  redirectTo: string,
  errorCode?: string,
) {
  if (!errorCode) {
    return NextResponse.redirect(new URL(redirectTo, requestUrl), 303);
  }

  const url = new URL("/login", requestUrl);
  url.searchParams.set("redirect", redirectTo);
  url.searchParams.set("error", errorCode);

  return NextResponse.redirect(url, 303);
}

export async function POST(request: Request) {
  const { payload, nativeFormSubmit } = await parsePayload(request);
  const redirectTo = sanitizeCustomerRedirect(payload?.redirect, "/minha-conta");
  const cpf = sanitizeCpf(payload?.cpf ?? payload?.login ?? "");
  const password = payload?.senha ?? payload?.password ?? "";

  if (!isValidCpf(cpf) || password.length < 1 || password.length > 20) {
    if (nativeFormSubmit) {
      return loginRedirectResponse(request.url, redirectTo, "invalid_credentials");
    }

    return errorResponse(
      "invalid_credentials",
      "CPF ou senha invalidos.",
      401,
    );
  }

  try {
    const user = await authenticatePublicUser(cpf, password);

    if (!user) {
      if (nativeFormSubmit) {
        return loginRedirectResponse(request.url, redirectTo, "invalid_credentials");
      }

      return errorResponse(
        "invalid_credentials",
        "CPF ou senha invalidos.",
        401,
      );
    }

    if (user.status !== "ati") {
      if (nativeFormSubmit) {
        return loginRedirectResponse(request.url, redirectTo, "inactive_user");
      }

      return errorResponse(
        "inactive_user",
        "Este usuario nao esta ativo.",
        403,
      );
    }

    if (nativeFormSubmit) {
      const response = loginRedirectResponse(request.url, redirectTo);
      setAuthCookie(response, createAuthSessionToken(user));
      return response;
    }

    const response = NextResponse.json<AuthLoginResponse>(
      {
        ok: true,
        data: {
          user: {
            name: user.name,
            cpfMasked: user.cpfMasked,
            email: user.email,
          },
        },
      },
    );

    setAuthCookie(response, createAuthSessionToken(user));

    return response;
  } catch (error) {
    console.error("auth-login-bff-failed", error);

    if (nativeFormSubmit) {
      return loginRedirectResponse(request.url, redirectTo, "auth_unavailable");
    }

    return errorResponse(
      "auth_unavailable",
      "Nao foi possivel autenticar agora.",
      502,
    );
  }
}
