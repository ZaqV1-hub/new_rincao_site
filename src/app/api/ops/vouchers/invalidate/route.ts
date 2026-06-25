import { NextResponse } from "next/server";
import type { AuthErrorResponse } from "@/lib/auth-contracts";
import { authenticateOperationsRequest } from "@/lib/ops-auth";
import { authorizePainelApiAccess } from "@/lib/painel-api-auth";
import {
  asVoucherOperationError,
  invalidatePurchaseVouchers,
  invalidateSelectedVouchers,
} from "@/lib/ops-voucher-validation";
import type { OpsVoucherOperationResponse } from "@/lib/voucher-contracts";

export const runtime = "nodejs";

type InvalidatePayload = {
  voucherIds?: unknown;
  purchaseId?: unknown;
  actor?: {
    name?: unknown;
    cpf?: unknown;
  } | null;
};

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

export async function POST(request: Request) {
  const auth = authenticateOperationsRequest(request, {
    requiredPermission: "ops.vouchers",
  });

  if (!auth.ok) {
    return auth.response;
  }

  const painelAuth = await authorizePainelApiAccess(request, "vis_bilhet");

  if (!painelAuth.ok) {
    return painelAuth.response;
  }

  let payload: InvalidatePayload | null = null;

  try {
    payload = (await request.json()) as InvalidatePayload;
  } catch {
    payload = null;
  }

  const voucherIds = Array.isArray(payload?.voucherIds)
    ? payload.voucherIds
        .map((voucherId) => Number(voucherId))
        .filter((voucherId) => Number.isInteger(voucherId) && voucherId > 0)
    : [];
  const purchaseId = Number(payload?.purchaseId);

  if (
    voucherIds.length === 0 &&
    (!Number.isInteger(purchaseId) || purchaseId <= 0)
  ) {
    return errorResponse(
      "invalid_operations_payload",
      "Informe voucherIds ou purchaseId para invalidar.",
      400,
    );
  }

  const actor = {
    name:
      typeof payload?.actor?.name === "string"
        ? payload.actor.name.trim()
        : null,
    cpf:
      typeof payload?.actor?.cpf === "string"
        ? payload.actor.cpf.trim()
        : null,
  };

  try {
    const result =
      Number.isInteger(purchaseId) && purchaseId > 0
        ? await invalidatePurchaseVouchers(purchaseId, actor)
        : await invalidateSelectedVouchers(voucherIds, actor);

    return NextResponse.json<OpsVoucherOperationResponse>({
      ok: true,
      data: result,
    });
  } catch (error) {
    const operationError = asVoucherOperationError(error);

    console.error("ops-voucher-invalidate-bff-failed", error);

    return errorResponse(
      operationError.code,
      operationError.message,
      operationError.status,
    );
  }
}
