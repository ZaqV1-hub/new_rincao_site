import { NextResponse } from "next/server";
import type { AuthErrorResponse } from "@/lib/auth-contracts";
import { clearAuthCookie, getAuthSession } from "@/lib/auth-session";
import { getCielo3dsTokenData, isCielo3dsConfigured } from "@/lib/cielo-3ds";
import { getActivePublicUserByCpf } from "@/lib/user-repository";

export const runtime = "nodejs";

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

function legacyCheckoutError(message: string, status = 400) {
  return NextResponse.json(
    {
      status: "10",
      msg: message,
    },
    { status },
  );
}

export async function GET() {
  const session = await getAuthSession();

  if (!session) {
    return errorResponse(
      "unauthenticated",
      "Sessao nao encontrada ou expirada.",
      401,
    );
  }

  try {
    const user = await getActivePublicUserByCpf(session.sub);

    if (!user) {
      const response = errorResponse(
        "unauthenticated",
        "Sessao nao encontrada ou expirada.",
        401,
      );
      clearAuthCookie(response);

      return response;
    }

    if (!isCielo3dsConfigured()) {
      return legacyCheckoutError(
        "Autenticacao 3DS indisponivel neste ambiente.",
        503,
      );
    }

    try {
      const tokenData = await getCielo3dsTokenData();

      return NextResponse.json({
        status: "00",
        accessToken: tokenData.accessToken,
        tokenType: tokenData.tokenType,
        expiresIn: tokenData.expiresIn,
        environment: tokenData.environment,
        debug: tokenData.debug,
      });
    } catch (error) {
      console.error("checkout-3ds-token-native-failed", error);

      return legacyCheckoutError(
        error instanceof Error && error.message.trim()
          ? error.message
          : "Falha ao obter token 3DS.",
      );
    }
  } catch (error) {
    console.error("checkout-3ds-token-failed", error);

    return errorResponse(
      "checkout_unavailable",
      "Nao foi possivel preparar o checkout seguro.",
      502,
    );
  }
}
