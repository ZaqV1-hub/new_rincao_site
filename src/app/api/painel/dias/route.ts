import { applyOperationalPriceTable, getOperationalDay, listOperationalDays, OperationalDayError, saveOperationalDay } from "@/lib/operational-day";
import { requirePainelApiAccess } from "@/lib/painel-api-auth";
import { opsErrorResponse, readJsonPayload, readRouteActor } from "@/lib/ops-route-utils";

function privateResponse(response: Response) {
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
async function run(request: Request, method: "GET" | "POST" | "PATCH") {
  try {
    const access = await requirePainelApiAccess(request, "vis_agenda");
    if (!access.ok) return privateResponse(access.response);
    if (method === "GET") {
      const params = new URL(request.url).searchParams;
      const keys = Array.from(params.keys());
      let data;
      if (keys.length === 1 && keys[0] === "date") data = await getOperationalDay(params.get("date")!);
      else if (keys.length === 2 && keys.includes("startDate") && keys.includes("endDate")) data = await listOperationalDays(params.get("startDate")!, params.get("endDate")!);
      else throw new OperationalDayError("invalid_input", "Informe a data ou o intervalo para consulta.");
      return privateResponse(Response.json({ ok: true, data }));
    }
    if (access.session.legacyRoleId !== 1) return privateResponse(opsErrorResponse("painel_forbidden", "Apenas gerentes podem alterar a programação.", 403));
    if (request.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
      throw new OperationalDayError("invalid_input", "Envie a programação em JSON.");
    }
    const input = await readJsonPayload<unknown>(request);
    const actor = readRouteActor({ name: access.session.actorName, cpf: access.session.actorCpf });
    const data = await (method === "POST" ? saveOperationalDay(input, actor) : applyOperationalPriceTable(input, actor));
    return privateResponse(Response.json({ ok: true, data }));
  } catch (error) {
    if (error instanceof OperationalDayError) return privateResponse(opsErrorResponse(error.code, error.message, error.code === "invalid_input" ? 400 : 409));
    console.error("[painel-dias]", error instanceof Error ? error.name : "Unknown error");
    return privateResponse(opsErrorResponse("day_unavailable", "Não foi possível acessar a programação.", 500));
  }
}
export function GET(request: Request) { return run(request, "GET"); }
export function POST(request: Request) { return run(request, "POST"); }
export function PATCH(request: Request) { return run(request, "PATCH"); }
