import { NextResponse } from "next/server";
import type { AuthErrorResponse } from "@/lib/auth-contracts";
import { authenticateOperationsRequest } from "@/lib/ops-auth";
import {
  asOperationalPaymentSyncError,
  syncOperationalPaymentStatuses,
} from "@/lib/ops-payment-sync";

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

type PaymentSyncPayload = {
  recentDays?: unknown;
  cancelAfterDays?: unknown;
  limit?: unknown;
  purchaseId?: unknown;
};

export async function POST(request: Request) {
  const auth = authenticateOperationsRequest(request, {
    requiredPermission: "ops.jobs",
  });

  if (!auth.ok) {
    return auth.response;
  }

  let payload: PaymentSyncPayload | null = null;

  try {
    payload = (await request.json()) as PaymentSyncPayload;
  } catch {
    payload = null;
  }

  if (
    payload &&
    Object.prototype.hasOwnProperty.call(payload, "purchaseId") &&
    (typeof payload.purchaseId !== "number" ||
      !Number.isSafeInteger(payload.purchaseId) ||
      payload.purchaseId <= 0 ||
      payload.purchaseId > 2_147_483_647)
  ) {
    return errorResponse(
      "invalid_purchase_id",
      "Compra invalida para conciliacao.",
      400,
    );
  }

  try {
    const data = await syncOperationalPaymentStatuses({
      recentDays:
        typeof payload?.recentDays === "number" ? payload.recentDays : undefined,
      cancelAfterDays:
        typeof payload?.cancelAfterDays === "number" ?
          payload.cancelAfterDays :
          undefined,
      limit: typeof payload?.limit === "number" ? payload.limit : undefined,
      purchaseId:
        typeof payload?.purchaseId === "number" ? payload.purchaseId : undefined,
    });

    return NextResponse.json({
      ok: true,
      data,
    });
  } catch (error) {
    const operationError = asOperationalPaymentSyncError(error);

    console.error("ops-payment-sync-bff-failed", error);

    return errorResponse(
      operationError.code,
      operationError.message,
      operationError.status,
    );
  }
}
