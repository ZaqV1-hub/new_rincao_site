import { NextResponse } from "next/server";
import type { AuthErrorResponse } from "@/lib/auth-contracts";
import { authenticateOperationsRequest } from "@/lib/ops-auth";
import { authorizePainelApiAccess } from "@/lib/painel-api-auth";
import {
  asPurchaseOperationError,
  updateOperationalPurchase,
} from "@/lib/ops-purchase-management";

export const runtime = "nodejs";

type UpdatePurchasePayload = {
  purchaseId?: unknown;
  reason?: unknown;
  status?: unknown;
  purchaseDate?: unknown;
  cpf?: unknown;
  vouchers?: unknown;
  payments?: unknown;
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

  let payload: UpdatePurchasePayload | null = null;

  try {
    payload = (await request.json()) as UpdatePurchasePayload;
  } catch {
    payload = null;
  }

  const purchaseId = Number(payload?.purchaseId);
  const reason =
    typeof payload?.reason === "string" ? payload.reason.trim() : "";
  const purchaseDate =
    typeof payload?.purchaseDate === "string" ? payload.purchaseDate.trim() : "";

  if (!Number.isInteger(purchaseId) || purchaseId <= 0 || !reason || !purchaseDate) {
    return errorResponse(
      "invalid_operations_payload",
      "Informe purchaseId, reason e purchaseDate para editar a compra.",
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
    const result = await updateOperationalPurchase({
      purchaseId,
      reason,
      purchaseDate,
      status:
        typeof payload?.status === "string" ? payload.status.trim() : undefined,
      cpf: typeof payload?.cpf === "string" ? payload.cpf.trim() : undefined,
      vouchers: Array.isArray(payload?.vouchers)
        ? (payload.vouchers as Array<{
            id: number;
            status?: string | null;
            value?: string | number | null;
            exclude?: boolean;
            discountId?: number | null;
            descontoId?: number | null;
            discount_id?: number | null;
          }>)
        : undefined,
      payments: Array.isArray(payload?.payments)
        ? (payload.payments as Array<{
            method: string;
            value: string | number;
          }>)
        : undefined,
      actor,
    });

    return NextResponse.json({
      ok: true,
      data: result,
    });
  } catch (error) {
    const operationError = asPurchaseOperationError(error);

    console.error("ops-purchase-update-bff-failed", error);

    return errorResponse(
      operationError.code,
      operationError.message,
      operationError.status,
    );
  }
}
