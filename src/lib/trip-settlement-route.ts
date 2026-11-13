import { requirePainelApiAccess } from './painel-api-auth';
import { hasLegacyPanelResource } from './painel-access';
import { CashSessionError } from './operational-cash-session';
import { TripSettlementError,invalidTrip,type TripFinancialActor } from './trip-settlement-contract';
import type { TripSettlementDetail } from './trip-settlement';
import type { TripKey,TripSettlementSource } from './trip-settlement-source';
export type TripRouteActor = TripFinancialActor & { canReadSignatures: boolean };
function privateResponse(response: Response) { response.headers.set('Cache-Control','private, no-store'); response.headers.set('X-Content-Type-Options','nosniff'); return response; }
export async function runTripFinancialRoute(request: Request,run: (actor: TripRouteActor) => Promise<Response>) {
  try {
    const access = await requirePainelApiAccess(request,'vis_bilhet'); if (!access.ok) return privateResponse(access.response);
    const agenda = await requirePainelApiAccess(request,'vis_agenda'); if (!agenda.ok) return privateResponse(agenda.response);
    const groups = await requirePainelApiAccess(request,['vis_clientes','vis_escola']); if (!groups.ok) return privateResponse(groups.response);
    return privateResponse(await run({ name: access.session.actorName,cpf: access.session.actorCpf,manager: access.session.legacyRoleId === 1,canReadSignatures: hasLegacyPanelResource(access.legacyResources,'vis_contagem') }));
  } catch (error) {
    const known = error instanceof TripSettlementError || error instanceof CashSessionError;
    return privateResponse(Response.json({ ok: false,error: { code: known ? error.code : 'trip_unavailable',message: known ? error.message : 'Não foi possível confirmar a operação financeira. Preserve os campos e confira a mesma tentativa.' } },{ status: known ? error.status : 503 }));
  }
}
export async function readTripFinancialBody(request: Request): Promise<unknown> {
  if (new URL(request.url).search || request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json' || !request.body || Number(request.headers.get('content-length')) > 65536) return invalidTrip();
  const reader = request.body.getReader(),decoder = new TextDecoder('utf-8',{ fatal: true }); let size = 0,text = '';
  try {
    while (true) { const chunk = await reader.read(); if (chunk.done) break; size += chunk.value.byteLength; if (size > 65536) return invalidTrip(); text += decoder.decode(chunk.value,{ stream: true }); }
    return JSON.parse(text+decoder.decode()) as unknown;
  } catch { await reader.cancel().catch(() => undefined); return invalidTrip(); } finally { reader.releaseLock(); }
}
export function financialTripKey(params: { agendaId: string; clientId: string }): TripKey {
  if (![params.agendaId,params.clientId].every(value => /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) <= 2147483647)) return invalidTrip();
  return { agendaId: Number(params.agendaId),clientId: Number(params.clientId) };
}
export function publicTripDetail(detail: TripSettlementDetail,actor: TripRouteActor) {
  function source(value: TripSettlementSource) { return { ...value,vehicles: value.vehicles.map(({ ownerCpf,...vehicle }) => ({ ...vehicle,canReadSignature: actor.canReadSignatures && (actor.manager || ownerCpf === actor.cpf) })) }; }
  return { ...detail,source: source(detail.source),receipt: detail.receipt ? { ...detail.receipt,snapshot: source(detail.receipt.snapshot) } : null };
}
export type PublicTripDetail = ReturnType<typeof publicTripDetail>;
