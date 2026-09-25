import { NextResponse } from "next/server";
import { requirePainelApiAccess } from "@/lib/painel-api-auth";
import { asPainelComprasError, getPainelPurchaseDetail } from "@/lib/painel-compras";
import { renderPainelPurchaseSummaryPdf } from "@/lib/painel-purchase-summary-pdf";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ purchaseId: string }> },
) {
  const access = await requirePainelApiAccess(request, "vis_compra");

  if (!access.ok) return access.response;

  const purchaseId = Number((await context.params).purchaseId);

  try {
    const detail = await getPainelPurchaseDetail(purchaseId);
    const pdf = await renderPainelPurchaseSummaryPdf(detail);

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="resumo-compra-${detail.purchaseId}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    const mapped = asPainelComprasError(error);

    return NextResponse.json(
      { ok: false, error: { code: mapped.code, message: mapped.message } },
      { status: mapped.status },
    );
  }
}
