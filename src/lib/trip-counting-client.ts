import type { CountingResult } from './trip-counting-contract';
export type CountingCommandBody = Record<string,unknown> & { idempotencyKey: string };
type Outcome = { ok: true; data: CountingResult } | { ok: false; uncertain: boolean; message: string };
export async function readCountingJson<T>(url: string): Promise<T> {
  const response = await fetch(url,{ cache: 'no-store',signal: AbortSignal.timeout(15000) });
  const result = await response.json();
  if (!response.ok || result?.ok !== true) throw new Error(result?.error?.message ?? 'Não foi possível consultar a contagem. Entre novamente se sua sessão expirou.');
  return result.data as T;
}
export async function sendCountingCommand(url: string,body: CountingCommandBody,reconcile: boolean): Promise<Outcome> {
  try {
    if (reconcile) {
      const previous = await readCountingJson<CountingResult | null>(`/api/contagem/comandos/${encodeURIComponent(body.idempotencyKey)}`);
      if (previous) return { ok: true,data: previous };
    }
    const response = await fetch(url,{ method: 'POST',headers: { 'content-type': 'application/json' },body: JSON.stringify(body),signal: AbortSignal.timeout(20000) });
    const result = await response.json().catch(() => null);
    if (response.ok && result?.ok === true && result.data?.vehicleId) return { ok: true,data: result.data };
    const definitive = response.status >= 400 && response.status < 500 && ![401,403].includes(response.status) &&
      result?.ok === false && typeof result?.error?.message === 'string' && result.error.code !== 'count_idempotency_conflict';
    return { ok: false,uncertain: !definitive,message: definitive ? result.error.message : 'Resultado ainda não confirmado. Confira a mesma tentativa antes de continuar. Se necessário, entre novamente com o operador original.' };
  } catch { return { ok: false,uncertain: true,message: 'A conexão não confirmou o resultado. Seus campos foram preservados. Confira a mesma tentativa.' }; }
}
