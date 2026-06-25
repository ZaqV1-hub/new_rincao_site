import { NextResponse } from "next/server";
import type { AuthErrorResponse, AuthMeResponse } from "@/lib/auth-contracts";
import { clearAuthCookie, getAuthSession } from "@/lib/auth-session";
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

    return NextResponse.json<AuthMeResponse>({
      ok: true,
      data: {
        user: {
          name: user.name,
          cpfMasked: user.cpfMasked,
          email: user.email,
        },
      },
    });
  } catch (error) {
    console.error("auth-me-bff-failed", error);

    return errorResponse(
      "auth_unavailable",
      "Nao foi possivel consultar a sessao agora.",
      502,
    );
  }
}
