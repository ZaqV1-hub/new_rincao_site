import { NextResponse } from "next/server";
import { requestCustomerPasswordReset } from "@/lib/customer-password-reset";
import { isValidCpf, sanitizeCpf } from "@/lib/user-repository";

export const runtime = "nodejs";

type RequestPayload = {
  cpf?: unknown;
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

  const cpf = sanitizeCpf(String(payload?.cpf ?? ""));

  if (!isValidCpf(cpf)) {
    return errorResponse("invalid_cpf", "CPF invalido.", 400);
  }

  try {
    const result = await requestCustomerPasswordReset({
      cpf,
      origin: new URL(request.url).origin,
    });

    if (result.blocked) {
      return errorResponse("password_reset_throttled", result.message, 429);
    }

    if (!result.userFound) {
      return errorResponse(
        "user_not_found",
        "Nenhum usuario foi encontrado utilizando este CPF.",
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
    console.error("customer-password-reset-request-bff-failed", error);

    return errorResponse(
      "password_reset_unavailable",
      "Nao foi possivel processar a recuperacao de senha agora.",
      502,
    );
  }
}
