import { NextResponse } from "next/server";
import { readJsonPayload } from "@/lib/ops-route-utils";
import {
  asPurchaseOperationError,
  cancelOperationalPurchase,
} from "@/lib/ops-purchase-management";
import { requirePainelApiAccess } from "@/lib/painel-api-auth";

export const runtime = "nodejs";

type CancelPurchasePayload = {
  purchaseId?: unknown;
  reason?: unknown;
};

async function run(request: Request) {
  const access = await requirePainelApiAccess(request, "vis_bilhet");

  if (!access.ok) {
    return access.response;
  }

  const payload = await readJsonPayload<CancelPurchasePayload>(request);
  if (payload && typeof payload === "object" && "actor" in payload) return NextResponse.json({ ok: false, error: { code: "invalid_operations_payload", message: "O operador é identificado pela sessão." } }, { status: 400 });
  const purchaseId = Number(payload?.purchaseId);
  const reason = typeof payload?.reason === "string" ? payload.reason.trim() : "";

  if (!Number.isInteger(purchaseId) || purchaseId <= 0) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "invalid_purchase_id", message: "Compra invalida." },
      },
      { status: 400 },
    );
  }

  if (!reason) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "invalid_update_reason",
          message: "Informe o motivo da exclusao.",
        },
      },
      { status: 400 },
    );
  }

  try {
    const result = await cancelOperationalPurchase(purchaseId, reason, {
      name: access.session.actorName,
      cpf: access.session.actorCpf,
    });

    return NextResponse.json({
      ok: true,
      data: result,
    });
  } catch (error) {
    const operationError = asPurchaseOperationError(error);

    console.error("painel-bilheteria-purchase-cancel-failed", error);

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

export async function POST(request: Request) {
  const response = await run(request);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
