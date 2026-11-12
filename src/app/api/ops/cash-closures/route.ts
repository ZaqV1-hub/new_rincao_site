import { NextResponse } from "next/server";
import type { AuthErrorResponse } from "@/lib/auth-contracts";
import { requirePainelApiAccess } from "@/lib/painel-api-auth";
import {
  asOperationalCashClosureError,
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
    { status, headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function GET(request: Request) {
  const painelAuth = await requirePainelApiAccess(request, "vis_bilhet");

  if (!painelAuth.ok) {
    painelAuth.response.headers.set("Cache-Control", "private, no-store");
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
    }, { headers: { "Cache-Control": "private, no-store" } });
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

export { POST } from "@/app/api/painel/bilheteria/cash-closures/route";
