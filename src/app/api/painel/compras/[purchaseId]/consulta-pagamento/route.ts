import { NextResponse } from "next/server";
import {
  asPainelComprasError,
  getPainelPurchaseGatewayConsult,
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
    const consult = await getPainelPurchaseGatewayConsult(Number(purchaseId));

    return NextResponse.json({
      ok: true,
      data: consult,
    });
  } catch (error) {
    const mapped = asPainelComprasError(error);
    console.error("painel-compras-gateway-consult-failed", error);

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
