import { requirePainelApiAccess } from '@/lib/painel-api-auth';
import { invalidCount,TripCountingError,type CountingActor } from './trip-counting-contract';

function privateResponse(response: Response) { response.headers.set('Cache-Control','private, no-store'); response.headers.set('X-Content-Type-Options','nosniff'); return response; }
export function countingRouteId(value: string) { if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) return invalidCount(); return Number(value); }
export async function readCountingBody(request: Request): Promise<unknown> {
  if (new URL(request.url).search || request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json' || !request.body || Number(request.headers.get('content-length')) > 524288) return invalidCount();
  const reader = request.body.getReader(),decoder = new TextDecoder('utf-8',{ fatal: true });
  let size = 0,text = '';
  try {
    while (true) { const chunk = await reader.read(); if (chunk.done) break; size += chunk.value.byteLength; if (size > 524288) return invalidCount(); text += decoder.decode(chunk.value,{ stream: true }); }
    return JSON.parse(text+decoder.decode()) as unknown;
  } catch { await reader.cancel().catch(() => undefined); return invalidCount(); } finally { reader.releaseLock(); }
}
export async function runCountingRoute(request: Request,run: (actor: CountingActor) => Promise<Response>) {
  try {
    const access = await requirePainelApiAccess(request,'vis_contagem');
    if (!access.ok) return privateResponse(access.response);
    if (new URL(request.url).search) return invalidCount();
    return privateResponse(await run({ name: access.session.actorName,cpf: access.session.actorCpf,manager: access.session.legacyRoleId === 1 }));
  } catch (error) {
    const known = error instanceof TripCountingError;
    return privateResponse(Response.json({ ok: false,error: { code: known ? error.code : 'count_unavailable',message: known ? error.message : 'Não foi possível confirmar o estado da contagem. Preserve os campos e confira a mesma tentativa.' } },{ status: known ? error.status : 503 }));
  }
}
