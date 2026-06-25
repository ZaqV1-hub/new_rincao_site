import { NextResponse } from "next/server";
import { requestPainelPasswordReset } from "@/lib/painel-password-reset";

export const runtime = "nodejs";

type RequestPayload = {
  email?: unknown;
};

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json(
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

export async function POST(request: Request) {
  let payload: RequestPayload | null = null;

  try {
    payload = (await request.json()) as RequestPayload;
  } catch {
    payload = null;
  }

  const email = typeof payload?.email === "string" ? payload.email.trim() : "";

  if (!email || email.length > 120 || !email.includes("@")) {
    return errorResponse("invalid_email", "E-mail invalido.", 400);
  }

  try {
    const result = await requestPainelPasswordReset({
      email,
      origin: new URL(request.url).origin,
    });

    if (result.blocked) {
      return errorResponse("password_reset_throttled", result.message, 429);
    }

    if (!result.userFound) {
      return errorResponse(
        "user_not_found",
        "Nenhum usuario foi encontrado utilizando este endereco de e-mail.",
        404,
      );
    }

    return NextResponse.json({
      ok: true,
      data: {
        sent: true,
        email: result.email,
      },
    });
  } catch (error) {
    console.error("painel-password-reset-request-bff-failed", error);

    return errorResponse(
      "password_reset_unavailable",
      "Nao foi possivel processar a recuperacao de senha agora.",
      502,
    );
  }
}
