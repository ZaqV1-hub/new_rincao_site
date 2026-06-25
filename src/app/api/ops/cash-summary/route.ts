import { NextResponse } from "next/server";
import type { AuthErrorResponse } from "@/lib/auth-contracts";
import { authenticateOperationsRequest } from "@/lib/ops-auth";
import { authorizePainelApiAccess } from "@/lib/painel-api-auth";
import {
  asOperationalCashError,
  getOperationalCashSummary,
} from "@/lib/ops-cash-management";

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

  try {
    const data = await getOperationalCashSummary();

    return NextResponse.json({
      ok: true,
      data,
    });
  } catch (error) {
    const operationError = asOperationalCashError(error);

    console.error("ops-cash-summary-bff-failed", error);

    return errorResponse(
      operationError.code,
      operationError.message,
      operationError.status,
    );
  }
}
