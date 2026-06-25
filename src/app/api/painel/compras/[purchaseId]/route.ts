import { NextResponse } from "next/server";
import {
  asPainelComprasError,
  getPainelPurchaseDetail,
} from "@/lib/painel-compras";
import { requirePainelApiAccess } from "@/lib/painel-api-auth";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: {
    params: Promise<{
      purchaseId: string;
    }>;
  },
) {
  const access = await requirePainelApiAccess(request, "vis_compra");

  if (!access.ok) {
    return access.response;
  }

  try {
    const { purchaseId } = await context.params;
    const detail = await getPainelPurchaseDetail(Number(purchaseId));

    return NextResponse.json({
      ok: true,
      data: detail,
    });
  } catch (error) {
    const mapped = asPainelComprasError(error);
    console.error("painel-compras-detail-failed", error);

    return NextResponse.json(
      {
        ok: false,
        error: {
          code: mapped.code,
          message: mapped.message,
        },
      },
      { status: mapped.status },
    );
  }
}
