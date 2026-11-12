import { OperationalDayError } from "@/lib/operational-day";
import { getOperationalDaySummary, OperationalDaySummaryError } from "@/lib/operational-day-summary";
import { isCivilDate } from "@/lib/operational-date";
import { requirePainelApiAccess } from "@/lib/painel-api-auth";
import { opsErrorResponse } from "@/lib/ops-route-utils";

function privateResponse(response: Response) {
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export async function GET(request: Request, context: { params: Promise<{ date: string }> }) {
  try {
    const access = await requirePainelApiAccess(request, "vis_agenda");
    if (!access.ok) return privateResponse(access.response);
    const { date } = await context.params;
    if (!isCivilDate(date) || new URL(request.url).search) throw new OperationalDaySummaryError("invalid_input", "Informe uma data civil válida, sem parâmetros adicionais.");
    return privateResponse(Response.json({ ok: true, data: await getOperationalDaySummary(date) }));
  } catch (error) {
    if (error instanceof OperationalDayError) return privateResponse(opsErrorResponse(error.code, error.message, error.code === "invalid_input" ? 400 : 409));
    if (error instanceof OperationalDaySummaryError) {
      const status = error.code === "invalid_input" ? 400 : error.code === "park_forbidden" ? 403 : 500;
      return privateResponse(opsErrorResponse(error.code, error.message, status));
    }
    console.error("[painel-day-summary]", error instanceof Error ? error.name : "Unknown error");
    return privateResponse(opsErrorResponse("summary_unavailable", "Não foi possível consultar o resumo da data.", 500));
  }
}
