import { asBoxOfficeSaleError, createOperationalBoxOfficeSale, type CreateBoxOfficeSaleInput } from "@/lib/ops-box-office-sales";
import { readJsonPayload, opsErrorResponse, readRouteActor } from "@/lib/ops-route-utils";
import { requirePainelApiAccess } from "@/lib/painel-api-auth";
export const runtime = "nodejs";
function privateResponse(response: Response) { response.headers.set("Cache-Control", "private, no-store"); return response; }
export async function POST(request: Request) {
  try {
    const access = await requirePainelApiAccess(request, "vis_bilhet");
    if (!access.ok) return privateResponse(access.response);
    const payload = await readJsonPayload<Record<string, unknown>>(request);
    const fields = ["agendaId", "periodId", "cpf", "items", "services", "courtesies", "payments", "reason", "idempotencyKey"];
    if (!payload || typeof payload !== "object" || Array.isArray(payload) || Object.keys(payload).some((key) => !fields.includes(key))) return privateResponse(opsErrorResponse("invalid_box_office_payload", "Dados da venda inválidos. O operador é identificado pela sessão.", 400));
    const result = await createOperationalBoxOfficeSale({ ...payload, actor: readRouteActor({ name: access.session.actorName, cpf: access.session.actorCpf }) } as CreateBoxOfficeSaleInput);
    return privateResponse(Response.json({ ok: true, data: result }));
  } catch (error) {
    const result = asBoxOfficeSaleError(error);
    console.error("painel-bilheteria-sales-failed", error instanceof Error ? error.name : "Unknown error");
    return privateResponse(opsErrorResponse(result.code, result.message, result.status));
  }
}
