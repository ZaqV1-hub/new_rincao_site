import { NextResponse } from "next/server";
import {
  asPainelComprasError,
  getPainelPurchaseDetail,
  PainelComprasError,
} from "@/lib/painel-compras";
import { requirePainelApiAccess } from "@/lib/painel-api-auth";

export const runtime = "nodejs";

function privateResponse(response: Response) {
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export async function GET(
  request: Request,
  context: {
    params: Promise<{
      purchaseId: string;
    }>;
  },
) {
  try {
    const access = await requirePainelApiAccess(request, "vis_compra");
    if (!access.ok) return privateResponse(access.response);
    const { purchaseId } = await context.params;
    if (!/^[1-9]\d*$/.test(purchaseId) || !Number.isSafeInteger(Number(purchaseId))) {
      throw new PainelComprasError("invalid_purchase_id", "Compra invalida.", 400);
    }
    const detail = await getPainelPurchaseDetail(Number(purchaseId));

    return privateResponse(NextResponse.json({
      ok: true,
      data: detail,
    }));
  } catch (error) {
    const mapped = asPainelComprasError(error);
    console.error("painel-compras-detail-failed", error instanceof Error ? error.name : "Unknown error");

    return privateResponse(NextResponse.json(
      {
        ok: false,
        error: {
          code: mapped.code,
          message: mapped.message,
        },
      },
      { status: mapped.status },
    ));
  }
}
