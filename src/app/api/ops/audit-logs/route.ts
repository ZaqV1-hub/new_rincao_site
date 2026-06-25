import { NextResponse } from "next/server";
import type { AuthErrorResponse } from "@/lib/auth-contracts";
import { asOpsAuditHistoryError, listOperationalAuditLogs } from "@/lib/ops-audit-history";
import { authenticateOperationsRequest } from "@/lib/ops-auth";
import { authorizePainelApiAccess } from "@/lib/painel-api-auth";

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

  const painelAuth = await authorizePainelApiAccess(request, [
    "vis_bilhet",
    "vis_compra",
  ]);

  if (!painelAuth.ok) {
    return painelAuth.response;
  }

  const url = new URL(request.url);
  const purchaseIdParam = url.searchParams.get("purchaseId");
  const voucherIdParam = url.searchParams.get("voucherId");
  const agendaIdParam = url.searchParams.get("agendaId");
  const limit = Number(url.searchParams.get("limit") ?? 20);
  const offset = Number(url.searchParams.get("offset") ?? 0);
  const purchaseId =
    purchaseIdParam == null || purchaseIdParam.trim() === ""
      ? null
      : Number(purchaseIdParam);
  const voucherId =
    voucherIdParam == null || voucherIdParam.trim() === ""
      ? null
      : Number(voucherIdParam);
  const agendaId =
    agendaIdParam == null || agendaIdParam.trim() === ""
      ? null
      : Number(agendaIdParam);

  try {
    const data = await listOperationalAuditLogs({
      purchaseId,
      voucherId,
      agendaId,
      limit,
      offset,
    });

    return NextResponse.json({
      ok: true,
      data,
    });
  } catch (error) {
    const operationError = asOpsAuditHistoryError(error);

    console.error("ops-audit-logs-bff-failed", error);

    return errorResponse(
      operationError.code,
      operationError.message,
      operationError.status,
    );
  }
}
