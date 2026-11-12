import { createDayProgram, DayProgramError, getDayProgram, saveDayProgram } from "@/lib/day-program";
import { isCivilDate } from "@/lib/operational-date";
import { requirePainelApiAccess } from "@/lib/painel-api-auth";
import { opsErrorResponse, readJsonPayload, readRouteActor } from "@/lib/ops-route-utils";

type Context = { params: Promise<{ date: string }> };
function privateResponse(response: Response) {
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
async function run(request: Request, context: Context, method: "GET" | "POST" | "PATCH") {
  try {
    const access = await requirePainelApiAccess(request, "vis_agenda");
    if (!access.ok) return privateResponse(access.response);
    const clientAccess = await requirePainelApiAccess(request, ["vis_clientes", "vis_escola"]);
    if (!clientAccess.ok) return privateResponse(clientAccess.response);
    const { date } = await context.params;
    if (!isCivilDate(date) || new URL(request.url).search) throw new DayProgramError("invalid_input", "Informe uma data civil válida, sem parâmetros adicionais.");
    if (method === "GET") return privateResponse(Response.json({ ok: true, data: await getDayProgram(date) }));
    if (access.session.legacyRoleId !== 1) return privateResponse(opsErrorResponse("painel_forbidden", "Apenas gerentes podem alterar a programação.", 403));
    if (request.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase() !== "application/json") throw new DayProgramError("invalid_input", "Envie a programação em JSON.");
    if (Number(request.headers.get("Content-Length")) > 512000) throw new DayProgramError("invalid_input", "A programação excede o limite permitido.");
    const input = await readJsonPayload<unknown>(request);
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new DayProgramError("invalid_input", "Dados da programação inválidos.");
    const actor = readRouteActor({ name: access.session.actorName, cpf: access.session.actorCpf });
    const data = await (method === "POST" ? createDayProgram(date, input, actor) : saveDayProgram(date, input, actor));
    return privateResponse(Response.json({ ok: true, data }));
  } catch (error) {
    if (error instanceof DayProgramError) return privateResponse(opsErrorResponse(error.code, error.message,
      error.code === "invalid_input" ? 400 : error.code === "past_readonly" ? 403 : 409));
    console.error("[painel-day-program]", error instanceof Error ? error.name : "Unknown error");
    return privateResponse(opsErrorResponse("program_unavailable", "Não foi possível acessar a programação.", 503));
  }
}
export function GET(request: Request, context: Context) { return run(request, context, "GET"); }
export function POST(request: Request, context: Context) { return run(request, context, "POST"); }
export function PATCH(request: Request, context: Context) { return run(request, context, "PATCH"); }
