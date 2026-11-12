import { asPainelBilheteriaError, payPainelBilheteriaReservation, type PayPainelReservationInput } from "@/lib/painel-bilheteria";
import { readJsonPayload, opsErrorResponse, readRouteActor } from "@/lib/ops-route-utils";
import { requirePainelApiAccess } from "@/lib/painel-api-auth";
export const runtime = "nodejs";
function privateResponse(response: Response) { response.headers.set("Cache-Control", "private, no-store"); return response; }
export async function POST(request: Request, context: { params: Promise<{ purchaseId: string }> }) {
  try {
    const access = await requirePainelApiAccess(request, "vis_bilhet");
    if (!access.ok) return privateResponse(access.response);
    const payload = await readJsonPayload<Record<string, unknown>>(request);
    if (!payload || typeof payload !== "object" || Array.isArray(payload) || Object.keys(payload).some((key) => !["periodId", "idempotencyKey", "payments"].includes(key))) return privateResponse(opsErrorResponse("invalid_reservation_payload", "Informe o caixa, a chave da operação e os pagamentos. O operador é identificado pela sessão.", 400));
    const { purchaseId } = await context.params;
    const result = await payPainelBilheteriaReservation({ ...payload, purchaseId: Number(purchaseId), actor: readRouteActor({ name: access.session.actorName, cpf: access.session.actorCpf }) } as PayPainelReservationInput);
    return privateResponse(Response.json({ ok: true, data: result }));
  } catch (error) {
    const result = asPainelBilheteriaError(error);
    console.error("painel-reservation-pay-failed", error instanceof Error ? error.name : "Unknown error");
    return privateResponse(opsErrorResponse(result.code, result.message, result.status));
  }
}
