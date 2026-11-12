import { DayProgramError, getDayProgram, markDayProgramExported } from "@/lib/day-program";
import { renderDayProgramBundle } from "@/lib/day-program-export";
import { getSaoPauloToday, isCivilDate } from "@/lib/operational-date";
import { requirePainelApiAccess } from "@/lib/painel-api-auth";
import { opsErrorResponse, readJsonPayload, readRouteActor } from "@/lib/ops-route-utils";

export const runtime = "nodejs";
function privateResponse(response: Response) {
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export async function POST(request: Request, context: { params: Promise<{ date: string }> }) {
  try {
    const access = await requirePainelApiAccess(request, "vis_agenda");
    if (!access.ok) return privateResponse(access.response);
    if (access.session.legacyRoleId !== 1) return privateResponse(opsErrorResponse("painel_forbidden", "Apenas gerentes podem gerar a programação.", 403));
    const detailAccess = await requirePainelApiAccess(request, ["vis_clientes", "vis_escola"]);
    if (!detailAccess.ok) return privateResponse(detailAccess.response);
    const { date } = await context.params;
    if (!isCivilDate(date) || new URL(request.url).search || request.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
      throw new DayProgramError("invalid_input", "Informe a data e a revisão da programação em JSON.");
    }
    const input = await readJsonPayload<Record<string, unknown>>(request);
    if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).some((key) => !["version", "sourceFingerprint", "allowPast", "reason"].includes(key)) ||
        !Number.isSafeInteger(input.version) || Number(input.version) < 1 || typeof input.sourceFingerprint !== "string" || !/^[a-f0-9]{64}$/.test(input.sourceFingerprint) ||
        (input.allowPast !== undefined && typeof input.allowPast !== "boolean") || (input.reason !== undefined && (typeof input.reason !== "string" || input.reason.length > 1000 || input.reason.includes("\0")))) {
      throw new DayProgramError("invalid_input", "Informe uma revisão válida para gerar os arquivos.");
    }
    const allowPast = input.allowPast === true;
    const reason = typeof input.reason === "string" ? input.reason.trim() : undefined;
    if ((date < getSaoPauloToday() || allowPast) && (!allowPast || !reason)) throw new DayProgramError("past_readonly", "Informe o motivo para gerar novamente os arquivos de uma data passada.");
    const program = await getDayProgram(date);
    if (program.closed) throw new DayProgramError("day_closed", "O dia está finalizado.");
    if (program.version === null) throw new DayProgramError("uncreated", "Crie a programação antes de gerar os arquivos.");
    if (program.version !== input.version || program.sourceFingerprint !== input.sourceFingerprint) throw new DayProgramError("version_conflict", "A programação mudou. Confira os dados antes de gerar os arquivos.");
    const bundle = await renderDayProgramBundle(program);
    const exported = await markDayProgramExported(date, program.version, readRouteActor({ name: access.session.actorName, cpf: access.session.actorCpf }),
      { expectedFingerprint: program.sourceFingerprint, allowPast, reason });
    return privateResponse(new Response(new Uint8Array(bundle), { headers: {
      "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="programacao-${date}-r${program.version}.zip"`,
      "X-Content-Type-Options": "nosniff", "X-Program-Export-Id": String(exported.exportId),
    } }));
  } catch (error) {
    if (error instanceof DayProgramError) return privateResponse(opsErrorResponse(error.code, error.message, error.code === "invalid_input" ? 400 : error.code === "past_readonly" ? 403 : 409));
    console.error("[painel-program-export]", error instanceof Error ? error.name : "Unknown error");
    return privateResponse(opsErrorResponse("export_failed", "Não foi possível confirmar a geração. Confira o estado da programação antes de tentar novamente.", 503));
  }
}
