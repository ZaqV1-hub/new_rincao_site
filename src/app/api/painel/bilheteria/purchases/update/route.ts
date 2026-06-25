import { NextResponse } from "next/server";
import { readJsonPayload } from "@/lib/ops-route-utils";
import {
  asPurchaseOperationError,
  updateOperationalPurchase,
} from "@/lib/ops-purchase-management";
import { requirePainelApiAccess } from "@/lib/painel-api-auth";

export const runtime = "nodejs";

type UpdatePurchasePayload = {
  purchaseId?: unknown;
  reason?: unknown;
  status?: unknown;
  purchaseDate?: unknown;
  cpf?: unknown;
  vouchers?: unknown;
  payments?: unknown;
};

export async function POST(request: Request) {
  const access = await requirePainelApiAccess(request, "vis_bilhet");

  if (!access.ok) {
    return access.response;
  }

  const payload = await readJsonPayload<UpdatePurchasePayload>(request);
  const purchaseId = Number(payload?.purchaseId);
  const reason = typeof payload?.reason === "string" ? payload.reason.trim() : "";
  const purchaseDate =
    typeof payload?.purchaseDate === "string" ? payload.purchaseDate.trim() : "";

  if (!Number.isInteger(purchaseId) || purchaseId <= 0 || !reason || !purchaseDate) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "invalid_operations_payload",
          message: "Informe purchaseId, reason e purchaseDate para editar a compra.",
        },
      },
      { status: 400 },
    );
  }

  try {
    const result = await updateOperationalPurchase({
      purchaseId,
      reason,
      purchaseDate,
      status: typeof payload?.status === "string" ? payload.status.trim() : undefined,
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
      actor: {
        name: access.session.actorName,
        cpf: access.session.actorCpf,
      },
    });

    return NextResponse.json({
      ok: true,
      data: result,
    });
  } catch (error) {
    const operationError = asPurchaseOperationError(error);

    console.error("painel-bilheteria-purchase-update-failed", error);

    return NextResponse.json(
      {
        ok: false,
        error: {
          code: operationError.code,
          message: operationError.message,
        },
      },
      { status: operationError.status },
    );
  }
}
