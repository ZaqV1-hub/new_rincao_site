import { NextResponse } from "next/server";
import type { AuthErrorResponse } from "@/lib/auth-contracts";
import { requirePainelApiAccess } from "@/lib/painel-api-auth";
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
    { status, headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function GET(
  request: Request,
  context: { params: Promise<{ closureId: string }> },
) {
  const painelAuth = await requirePainelApiAccess(request, "vis_bilhet");

  if (!painelAuth.ok) {
    painelAuth.response.headers.set("Cache-Control", "private, no-store");
    return painelAuth.response;
  }

  const { closureId } = await context.params;

  try {
    const data = await getOperationalCashClosureDetail(Number(closureId));

    return NextResponse.json({
      ok: true,
      data,
    }, { headers: { "Cache-Control": "private, no-store" } });
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
