import { NextResponse } from "next/server";
import type { AuthErrorResponse } from "@/lib/auth-contracts";
import { authenticateOperationsRequest } from "@/lib/ops-auth";
import { authorizePainelApiAccess } from "@/lib/painel-api-auth";
import {
  asPurchaseOperationError,
  cancelOperationalPurchase,
} from "@/lib/ops-purchase-management";

export const runtime = "nodejs";

type CancelPurchasePayload = {
  purchaseId?: unknown;
  reason?: unknown;
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
    requiredPermission: "ops.purchases",
  });

  if (!auth.ok) {
    return auth.response;
  }

  const painelAuth = await authorizePainelApiAccess(request, [
    "vis_compra",
    "vis_bilhet",
  ]);

  if (!painelAuth.ok) {
    return painelAuth.response;
  }

  let payload: CancelPurchasePayload | null = null;

  try {
    payload = (await request.json()) as CancelPurchasePayload;
  } catch {
    payload = null;
  }

  const purchaseId = Number(payload?.purchaseId);
  const reason =
    typeof payload?.reason === "string" ? payload.reason.trim() : "";

  if (!Number.isInteger(purchaseId) || purchaseId <= 0) {
    return errorResponse("invalid_purchase_id", "Compra invalida.", 400);
  }

  if (!reason) {
    return errorResponse(
      "invalid_update_reason",
      "Informe o motivo da exclusao.",
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
    const result = await cancelOperationalPurchase(purchaseId, reason, actor);

    return NextResponse.json({
      ok: true,
      data: result,
    });
  } catch (error) {
    const operationError = asPurchaseOperationError(error);

    console.error("ops-purchase-cancel-bff-failed", error);

    return errorResponse(
      operationError.code,
      operationError.message,
      operationError.status,
    );
  }
}
