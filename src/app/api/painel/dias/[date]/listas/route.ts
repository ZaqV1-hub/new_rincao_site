import { requirePainelApiAccess } from "@/lib/painel-api-auth";
import { getOperationalDayList, normalizeDayPurchaseFilters, OperationalDayListError } from "@/lib/operational-day-lists";
import { isCivilDate } from "@/lib/operational-date";
import { opsErrorResponse } from "@/lib/ops-route-utils";

function privateResponse(response: Response) {
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export async function GET(request: Request, context: { params: Promise<{ date: string }> }) {
  try {
    const access = await requirePainelApiAccess(request, "vis_agenda");
    if (!access.ok) return privateResponse(access.response);
    const query = new URL(request.url).searchParams;
    const kind = query.get("kind");
    const page = query.get("page") ?? "1";
    const allowedKeys = kind === "purchases" ? ["kind", "page", "origin", "type", "query"] : ["kind", "page"];
    if ((kind !== "purchases" && kind !== "groups") || !/^[1-9]\d{0,6}$/.test(page) || Number(page) > 1000000 ||
        [...query.keys()].some((key) => !allowedKeys.includes(key) || query.getAll(key).length !== 1)) {
      throw new OperationalDayListError("invalid_input", "Informe a lista e uma página válidas.");
    }
    const filters = kind === "purchases" ? normalizeDayPurchaseFilters({
      origin: query.get("origin") ?? undefined,
      type: query.get("type") ?? undefined,
      query: query.get("query") ?? undefined,
    }) : undefined;
    const detailAccess = await requirePainelApiAccess(request, kind === "purchases" ? "vis_compra" : ["vis_clientes", "vis_escola"]);
    if (!detailAccess.ok) return privateResponse(detailAccess.response);
    const { date } = await context.params;
    if (!isCivilDate(date)) throw new OperationalDayListError("invalid_input", "Informe uma data válida no formato AAAA-MM-DD.");
    return privateResponse(Response.json({ ok: true, data: await getOperationalDayList(date, kind, Number(page), filters) }));
  } catch (error) {
    if (error instanceof OperationalDayListError) return privateResponse(opsErrorResponse(error.code, error.message, error.code === "invalid_input" ? 400 : 500));
    console.error("[painel-day-list]", error instanceof Error ? error.name : "Unknown error");
    return privateResponse(opsErrorResponse("list_unavailable", "Não foi possível consultar a lista da data.", 500));
  }
}
