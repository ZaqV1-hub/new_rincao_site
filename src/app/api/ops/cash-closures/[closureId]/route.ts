import { NextResponse } from "next/server";
import type { AuthErrorResponse } from "@/lib/auth-contracts";
import { authenticateOperationsRequest } from "@/lib/ops-auth";
import { authorizePainelApiAccess } from "@/lib/painel-api-auth";
import {
  asOperationalCashClosureError,
  getOperationalCashClosureDetail,
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

export async function GET(
  request: Request,
  context: { params: Promise<{ closureId: string }> },
) {
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

  const { closureId } = await context.params;

  try {
    const data = await getOperationalCashClosureDetail(Number(closureId));

    return NextResponse.json({
      ok: true,
      data,
    });
  } catch (error) {
    const operationError = asOperationalCashClosureError(error);

    console.error("ops-cash-closure-detail-bff-failed", error);

    return errorResponse(
      operationError.code,
      operationError.message,
      operationError.status,
    );
  }
}
