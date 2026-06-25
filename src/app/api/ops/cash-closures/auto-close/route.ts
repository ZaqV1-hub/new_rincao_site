import { NextResponse } from "next/server";
import type { AuthErrorResponse } from "@/lib/auth-contracts";
import { authenticateOperationsRequest } from "@/lib/ops-auth";
import { authorizePainelApiAccess } from "@/lib/painel-api-auth";
import {
  asOperationalCashClosureError,
  autoCloseOperationalCashClosures,
} from "@/lib/ops-cash-closures";

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

type AutoCloseCashClosuresPayload = {
  reason?: unknown;
  actor?: {
    name?: unknown;
    cpf?: unknown;
  } | null;
};

export async function POST(request: Request) {
  const auth = authenticateOperationsRequest(request, {
    requiredPermission: "ops.cash",
  });

  if (!auth.ok) {
    return auth.response;
  }

  const painelAuth = await authorizePainelApiAccess(request, "vis_bilhet");

  if (!painelAuth.ok) {
    return painelAuth.response;
  }

  let payload: AutoCloseCashClosuresPayload | null = null;

  try {
    payload = (await request.json()) as AutoCloseCashClosuresPayload;
  } catch {
    payload = null;
  }

  try {
    const result = await autoCloseOperationalCashClosures({
      reason: typeof payload?.reason === "string" ? payload.reason : "",
      actor: {
        name:
          typeof payload?.actor?.name === "string"
            ? payload.actor.name.trim()
            : null,
        cpf:
          typeof payload?.actor?.cpf === "string"
            ? payload.actor.cpf.trim()
            : null,
      },
    });

    return NextResponse.json({
      ok: true,
      data: result,
    });
  } catch (error) {
    const operationError = asOperationalCashClosureError(error);

    console.error("ops-cash-auto-close-bff-failed", error);

    return errorResponse(
      operationError.code,
      operationError.message,
      operationError.status,
    );
  }
}
