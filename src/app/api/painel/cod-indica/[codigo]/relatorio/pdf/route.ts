import {
  asPainelCodIndicaError,
  loadPainelCodIndicaReport,
} from "@/lib/painel-cod-indica";
import { requirePainelApiAccess } from "@/lib/painel-api-auth";
import { renderPainelCodIndicaReportPdfBuffer } from "@/lib/painel-cod-indica-report-pdf";
import { createInlinePdfResponse } from "@/lib/ops-route-utils";
import { opsErrorResponse } from "@/lib/ops-route-utils";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ codigo: string }> },
) {
  const access = await requirePainelApiAccess(request, ["vis_indica"]);
  if (!access.ok) {
    return access.response;
  }

  try {
    const { codigo } = await context.params;
    const { searchParams } = new URL(request.url);
    const report = await loadPainelCodIndicaReport(codigo, {
      dtini: searchParams.get("dtini") ?? "",
      dtfim: searchParams.get("dtfim") ?? "",
    });
    const pdfBuffer = await renderPainelCodIndicaReportPdfBuffer(report);
    return createInlinePdfResponse(`cod-indica-${report.codigo}.pdf`, pdfBuffer);
  } catch (error) {
    const mapped = asPainelCodIndicaError(error);
    return opsErrorResponse(mapped.code, mapped.message, mapped.status);
  }
}
