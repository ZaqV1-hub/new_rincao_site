import { requirePainelApiAccess } from "@/lib/painel-api-auth";
import { getOperationalDayList, OperationalDayListError } from "@/lib/operational-day-lists";
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
    if ((kind !== "purchases" && kind !== "groups") || !/^[1-9]\d{0,6}$/.test(page) ||
        [...query.keys()].some((key) => !["kind", "page"].includes(key) || query.getAll(key).length !== 1)) {
      throw new OperationalDayListError("invalid_input", "Informe a lista e uma página válidas.");
    }
    const detailAccess = await requirePainelApiAccess(request, kind === "purchases" ? "vis_compra" : ["vis_clientes", "vis_escola"]);
    if (!detailAccess.ok) return privateResponse(detailAccess.response);
    const { date } = await context.params;
    return privateResponse(Response.json({ ok: true, data: await getOperationalDayList(date, kind, Number(page)) }));
  } catch (error) {
    if (error instanceof OperationalDayListError) return privateResponse(opsErrorResponse(error.code, error.message, error.code === "invalid_input" ? 400 : 500));
    console.error("[painel-day-list]", error instanceof Error ? error.name : "Unknown error");
    return privateResponse(opsErrorResponse("list_unavailable", "Não foi possível consultar a lista da data.", 500));
  }
}
