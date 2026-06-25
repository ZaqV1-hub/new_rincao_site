import { NextResponse } from "next/server";
import type { AuthErrorResponse } from "@/lib/auth-contracts";
import { authenticateOperationsRequest } from "@/lib/ops-auth";
import { authorizePainelApiAccess } from "@/lib/painel-api-auth";
import {
  asOperationalCashClosureError,
  closeOperationalCashClosure,
  listOperationalCashClosures,
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

export async function GET(request: Request) {
  const auth = authenticateOperationsRequest(request, {
    requiredPermission: "ops.read",
  });

  if (!auth.ok) {
    return auth.response;
  }

  const painelAuth = await authorizePainelApiAccess(request, "vis_bilhet");

  if (!painelAuth.ok) {
    return painelAuth.response;
  }

  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? 20);
  const offset = Number(url.searchParams.get("offset") ?? 0);

  try {
    const data = await listOperationalCashClosures({
      limit,
      offset,
    });

    return NextResponse.json({
      ok: true,
      data,
    });
  } catch (error) {
    const operationError = asOperationalCashClosureError(error);

    console.error("ops-cash-closures-bff-failed", error);

    return errorResponse(
      operationError.code,
      operationError.message,
      operationError.status,
    );
  }
}

type CloseCashClosurePayload = {
  reason?: unknown;
  operatorName?: unknown;
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

  let payload: CloseCashClosurePayload | null = null;

  try {
    payload = (await request.json()) as CloseCashClosurePayload;
  } catch {
    payload = null;
  }

  try {
    const result = await closeOperationalCashClosure({
      reason: typeof payload?.reason === "string" ? payload.reason : "",
      operatorName:
        typeof payload?.operatorName === "string" ? payload.operatorName : "",
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

    console.error("ops-cash-close-bff-failed", error);

    return errorResponse(
      operationError.code,
      operationError.message,
      operationError.status,
    );
  }
}
