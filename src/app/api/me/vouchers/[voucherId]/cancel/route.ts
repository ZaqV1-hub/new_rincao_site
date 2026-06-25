import { NextResponse } from "next/server";
import {
  customerApiErrorResponse,
} from "@/lib/customer-api-route";
import { requireAuthenticatedVoucherRouteId } from "@/lib/customer-voucher-route";
import type { UserVoucherCancelResponse } from "@/lib/voucher-contracts";
import {
  cancelReservationPurchase,
  getUserVoucherPurchaseById,
} from "@/lib/voucher-repository";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  context: { params: Promise<{ voucherId: string }> },
) {
  const route = await requireAuthenticatedVoucherRouteId(context, {
    invalidCode: "invalid_purchase_id",
    invalidMessage: "Informe um identificador de compra valido.",
  });

  if (!route.ok) {
    return route.response;
  }

  const purchaseId = route.routeId;

  try {
    const user = route.subject;

    const purchase = await getUserVoucherPurchaseById(user.cpf, purchaseId);

    if (!purchase) {
      return customerApiErrorResponse(
        "purchase_not_found",
        "Compra nao encontrada para esta conta.",
        404,
      );
    }

    if (!purchase.canCancelReservation) {
      return customerApiErrorResponse(
        "reservation_cancel_unavailable",
        "Esta reserva nao pode mais ser cancelada.",
        409,
      );
    }

    const cancelledPurchaseId = await cancelReservationPurchase(user.cpf, purchaseId);

    if (!cancelledPurchaseId) {
      return customerApiErrorResponse(
        "reservation_cancel_unavailable",
        "Esta reserva nao pode mais ser cancelada.",
        409,
      );
    }

    return NextResponse.json<UserVoucherCancelResponse>({
      ok: true,
      data: {
        purchaseId: cancelledPurchaseId,
        status: "canc",
        statusLabel: "Cancelado",
      },
    });
  } catch (error) {
    console.error("user-voucher-cancel-bff-failed", error);

    return customerApiErrorResponse(
      "reservation_cancel_unavailable",
      "Nao foi possivel cancelar a reserva agora.",
      502,
    );
  }
}
