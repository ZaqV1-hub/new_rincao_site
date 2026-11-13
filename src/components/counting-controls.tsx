'use client';
import { useCallback,useEffect,useRef,useState,useSyncExternalStore } from 'react';
import { readCountingJson,sendCountingCommand,type CountingCommandBody } from '@/lib/trip-counting-client';
import type { CountingResult } from '@/lib/trip-counting-contract';
export const countingInput = 'min-h-11 w-full rounded-lg border border-[#aabed0] bg-white px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1764a0] disabled:bg-[#edf2f7]';
export const countingButton = 'inline-flex min-h-11 items-center justify-center rounded-lg border border-[#9cb5cb] bg-white px-4 py-2 font-semibold hover:bg-[#e8f1fa] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1764a0] disabled:cursor-not-allowed disabled:opacity-50';
export const countingPrimary = `${countingButton} !border-[#165e96] !bg-[#165e96] !text-white hover:!bg-[#124c79]`;
export const countStateLabel = { waiting: 'Aguardando',counting: 'Em contagem',completed: 'Concluído' };
function subscribeConnection(change: () => void) { window.addEventListener('online',change); window.addEventListener('offline',change); return () => { window.removeEventListener('online',change); window.removeEventListener('offline',change); }; }
export function useCountingConnection() { return useSyncExternalStore(subscribeConnection,() => navigator.onLine,() => true); }
export function countTime(value: string) { return new Date(value).toLocaleTimeString('pt-BR',{ timeZone: 'America/Sao_Paulo',hour: '2-digit',minute: '2-digit',second: '2-digit' }); }
export function useCountingRead<T>(url: string) {
  const [data,setData] = useState<T | null>(null),[error,setError] = useState(''),[checkedAt,setCheckedAt] = useState('');
  const sequence = useRef(0),alive = useRef(false);
  const refresh = useCallback(async () => {
    const attempt = ++sequence.current;
    try { const fresh = await readCountingJson<T>(url); if (alive.current && attempt === sequence.current) { setData(fresh); setError(''); setCheckedAt(new Date().toISOString()); } return fresh; }
    catch (error) { if (alive.current && attempt === sequence.current) setError(error instanceof Error ? error.message : 'Consulta indisponível.'); return null; }
  },[url]);
  useEffect(() => {
    const requests = sequence;
    alive.current = true; const tick = () => { if (document.visibilityState === 'visible') void refresh(); };
    tick(); const interval = setInterval(tick,5000); document.addEventListener('visibilitychange',tick);
    return () => { alive.current = false; requests.current++; clearInterval(interval); document.removeEventListener('visibilitychange',tick); };
  },[refresh]);
  return { data,error,checkedAt,refresh };
}
type Pending = { url: string; key: string; body?: CountingCommandBody };
export function useCountingCommand(storageKey: string,onConfirmed: (result: CountingResult) => Promise<void>) {
  const [pending,setPending] = useState<Pending | null>(null),[ready,setReady] = useState(false),[busy,setBusy] = useState(false),[message,setMessage] = useState('');
  const active = useRef(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const raw = sessionStorage.getItem(storageKey);
        if (raw) {
          const saved = JSON.parse(raw) as Pending;
          if (!saved || typeof saved.key !== 'string' || !/^[A-Za-z0-9:_-]{1,100}$/.test(saved.key) || typeof saved.url !== 'string' || !/^\/api\/contagem\/veiculos(?:\/[1-9]\d*\/(?:start|save|release|takeover|complete|recount))?$/.test(saved.url)) throw new Error();
          setPending(saved); setMessage('Há uma tentativa anterior para conferir. Nenhuma assinatura ou contato ficou salvo neste aparelho.');
        }
        setReady(true);
      } catch { setMessage('Não foi possível recuperar a tentativa deste aparelho. Peça conferência ao responsável antes de continuar.'); }
    },0);
    return () => clearTimeout(timer);
  },[storageKey]);
  async function submit(url?: string,payload?: Record<string,unknown>) {
    if (active.current || !ready) return;
    if (!navigator.onLine) { setMessage('Sem conexão. Mantenha esta tela aberta; a edição ainda não foi confirmada.'); return; }
    active.current = true; setBusy(true);
    try {
      let attempt = pending;
      if (!attempt) {
        if (!url || !payload) return;
        const key = crypto.randomUUID(),body = { ...payload,idempotencyKey: key };
        attempt = { url,key,body };
        // Only vehicle creation has a non-personal payload that can be restored after reload.
        sessionStorage.setItem(storageKey,JSON.stringify({ url,key,...(url === '/api/contagem/veiculos' ? { body } : {}) }));
        setPending(attempt);
      }
      if (!attempt.body) {
        const result = await readCountingJson<CountingResult | null>(`/api/contagem/comandos/${attempt.key}`);
        if (result) { sessionStorage.removeItem(storageKey); setPending(null); setMessage(`Confirmado às ${countTime(result.confirmedAt)}.`); await onConfirmed(result); }
        else { sessionStorage.removeItem(storageKey); setPending(null); setMessage('O servidor não registrou essa tentativa. Consulte o veículo e preencha novamente o que não foi salvo.'); }
        return;
      }
      const result = await sendCountingCommand(attempt.url,attempt.body,pending !== null);
      if (result.ok) { sessionStorage.removeItem(storageKey); setPending(null); setMessage(`Confirmado às ${countTime(result.data.confirmedAt)}.`); await onConfirmed(result.data); }
      else { if (!result.uncertain) { sessionStorage.removeItem(storageKey); setPending(null); } setMessage(result.message); }
    } catch { setMessage('Não foi possível confirmar a tentativa. Mantenha esta tela aberta e confira novamente.'); }
    finally { active.current = false; setBusy(false); }
  }
  return { pending,ready,busy,message,submit,blocked: !ready || busy || pending !== null };
}
export function CountingCommandStatus({ command }: { command: ReturnType<typeof useCountingCommand> }) {
  return <div aria-live="polite" className="space-y-3">{command.message && <p className="rounded-lg border border-[#aabed0] bg-white p-3 text-sm">{command.message}</p>}
    {command.pending && <button type="button" className={countingPrimary} disabled={command.busy} onClick={() => void command.submit()}>{command.busy ? 'Conferindo…' : 'Conferir a mesma tentativa'}</button>}
    {command.pending && <a className="ml-3 inline-flex min-h-11 items-center underline" href="/painel/login?redirect=%2Fcontagem" target="_blank" rel="noreferrer">Entrar novamente</a>}
  </div>;
}
export function useCountingLeaveWarning(unsaved: boolean) {
  useEffect(() => { if (!unsaved) return; const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); }; window.addEventListener('beforeunload',warn); return () => window.removeEventListener('beforeunload',warn); },[unsaved]);
}
