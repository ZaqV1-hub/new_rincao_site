import { NextResponse } from "next/server";
import type { AuthErrorResponse } from "@/lib/auth-contracts";
import { requirePainelApiAccess } from "@/lib/painel-api-auth";
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
    { status, headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function GET(request: Request) {
  const painelAuth = await requirePainelApiAccess(request, "vis_bilhet");

  if (!painelAuth.ok) {
    painelAuth.response.headers.set("Cache-Control", "private, no-store");
    return painelAuth.response;
  }

  try {
    const data = await getOperationalCashSummary();

    return NextResponse.json({
      ok: true,
      data,
    }, { headers: { "Cache-Control": "private, no-store" } });
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
