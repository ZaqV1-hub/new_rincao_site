'use client';
import { useCallback,useEffect,useRef,useState,useSyncExternalStore } from 'react';
import { readCountingJson,sendCountingCommand,type CountingCommandBody } from '@/lib/trip-counting-client';
import type { CountingResult } from '@/lib/trip-counting-contract';
export const countingInput = 'min-h-12 w-full rounded-xl border border-[#d9e3ee] bg-white px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1764a0] disabled:bg-[#edf2f7]';
export const countingButton = 'inline-flex min-h-11 items-center justify-center rounded-xl border border-[#d9e3ee] bg-white px-4 py-2 font-semibold hover:bg-[#e8f1fa] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1764a0] disabled:cursor-not-allowed disabled:opacity-50';
export const countingPrimary = `${countingButton} !border-[#2e8b4e] !bg-[#2e8b4e] !text-white hover:!bg-[#24703e]`;
export const countStateLabel = { waiting: 'Livre',counting: 'Em contagem',completed: 'Concluído' };
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
export function useCountingCommand(storageKey: string,onConfirmed: (result: CountingResult,body?: CountingCommandBody) => Promise<void>) {
  const [pending,setPending] = useState<Pending | null>(null),[ready,setReady] = useState(false),[busy,setBusy] = useState(false),[message,setMessage] = useState(''),[failed,setFailed] = useState(false);
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
  function clearRecovery(key:string){const raw=sessionStorage.getItem(storageKey);if(raw&&JSON.parse(raw).key===key)sessionStorage.removeItem(storageKey);}
  async function submit(url?: string,payload?: Record<string,unknown>) {
    if (active.current || !ready) return;
    if (!navigator.onLine) { setMessage('Sem conexão. Mantenha esta tela aberta; a edição ainda não foi confirmada.'); return; }
    active.current = true; setBusy(true); setFailed(false);
    try {
      let attempt = pending;
      if (!attempt) {
        if (!url || !payload) return;
        const key = crypto.randomUUID(),body = { ...payload,idempotencyKey: key };
        attempt = { url,key,body };
        // Persist only recovery metadata; contacts, notes and signatures remain in memory.
        sessionStorage.setItem(storageKey,JSON.stringify({ url,key }));
        setPending(attempt);
      }
      if (!attempt.body) {
        const result = await readCountingJson<CountingResult | null>(`/api/contagem/comandos/${attempt.key}`);
        if (result) { clearRecovery(attempt.key); setPending(null); setMessage(`Confirmado às ${countTime(result.confirmedAt)}.`); await onConfirmed(result,attempt.body); }
        else { clearRecovery(attempt.key); setPending(null); setMessage('O servidor não registrou essa tentativa. Consulte o veículo e preencha novamente o que não foi salvo.'); }
        return;
      }
      const result = await sendCountingCommand(attempt.url,attempt.body,pending !== null);
      if (result.ok) { clearRecovery(attempt.key); setPending(null); setMessage(`Confirmado às ${countTime(result.data.confirmedAt)}.`); await onConfirmed(result.data,attempt.body); }
      else { setFailed(true); if (!result.uncertain) { clearRecovery(attempt.key); setPending(null); } setMessage(result.message); }
    } catch { setFailed(true); setMessage('Não foi possível confirmar a tentativa. Mantenha esta tela aberta e confira novamente.'); }
    finally { active.current = false; setBusy(false); }
  }
  return { pending,ready,busy,message,failed,resetFailure: () => setFailed(false),submit,blocked: !ready || busy || pending !== null };
}
export function CountingCommandStatus({ command }: { command: ReturnType<typeof useCountingCommand> }) {
  return <div aria-live="polite" className="space-y-3">{command.message && <p className="rounded-lg border border-[#aabed0] bg-white p-3 text-sm">{command.message}</p>}
    {command.pending && <button type="button" className={countingPrimary} disabled={command.busy} onClick={() => void command.submit()}>{command.busy ? 'Conferindo…' : 'Conferir a mesma tentativa'}</button>}
    {command.pending && <a className="ml-3 inline-flex min-h-11 items-center underline" href="/painel/login?redirect=%2Fcontagem" target="_blank" rel="noreferrer">Entrar novamente</a>}
  </div>;
}
export function useCountingLeaveWarning(unsaved: boolean) {
  useEffect(() => {
    if (!unsaved) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    const confirm = () => window.confirm('Há alterações ou assinatura ainda não confirmadas. Sair descarta os dados que não chegaram ao servidor. Deseja sair?');
    const beforeLeave = (event: Event) => { if (!confirm()) event.preventDefault(); };
    const navigate = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest('a') : null;
      if (!link || link.target === '_blank' || link.hasAttribute('download') || link.getAttribute('href')?.startsWith('#') || event.metaKey || event.ctrlKey) return;
      if (!confirm()) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener('beforeunload',warn);
    window.addEventListener('counting:before-leave',beforeLeave);
    document.addEventListener('click',navigate,true);
    return () => {
      window.removeEventListener('beforeunload',warn);
      window.removeEventListener('counting:before-leave',beforeLeave);
      document.removeEventListener('click',navigate,true);
    };
  },[unsaved]);
}

export function CountingAccountMenu({ name }: { name: string }) {
  const [busy,setBusy] = useState(false),[error,setError] = useState('');
  async function logout() {
    if (!window.dispatchEvent(new Event('counting:before-leave',{ cancelable: true }))) return;
    if (!window.confirm('Sair da conta? Contagens atribuídas a você continuam no seu nome. Outro monitor poderá assumir com motivo registrado.')) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/ops/session',{ method: 'DELETE' });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error();
      window.location.assign('/painel/login?redirect=%2Fcontagem');
    } catch { setError('Não foi possível encerrar a sessão. Tente novamente.'); setBusy(false); }
  }
  return <details className="relative">
    <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg focus-visible:outline-2 focus-visible:outline-white" aria-label={`Conta de ${name}`}>
      <span className="max-w-32 truncate text-sm">{name.split(' ')[0]}</span><span className="grid h-9 w-9 place-items-center rounded-full bg-[#8fb9e3] text-sm font-bold text-[#0b1f36]">{name.trim().split(/\s+/).map(word => word[0]).slice(0,2).join('')}</span>
    </summary>
    <div className="absolute right-0 z-50 mt-2 w-64 rounded-2xl border border-[#d9e3ee] bg-white p-4 text-[#0f2d52] shadow-lg">
      <p className="break-words font-semibold">{name}</p><a href="/painel" className="flex min-h-11 items-center underline">Voltar ao painel</a>
      <button type="button" className={`${countingButton} w-full`} disabled={busy} onClick={() => void logout()}>{busy ? 'Saindo…' : 'Sair da conta'}</button>
      {error && <p role="alert" className="mt-2 text-sm">{error}</p>}
    </div>
  </details>;
}

export function CountingStepper({ label,hint,value,onMinus,onPlus,disabled }: {
  label: string; hint?: string; value: number | null; onMinus: () => void; onPlus: () => void; disabled: boolean;
}) {
  return <div className={`flex min-h-18 items-center justify-between gap-2 rounded-2xl border p-3 ${value ? 'border-[#2f6fb2] bg-[#eaf2fb]' : 'border-[#d9e3ee] bg-white'}`}>
    <div className="min-w-0"><b className="block text-[15px] leading-tight">{label}</b>{hint && <small className="mt-1 block text-[#6a7c92]">{hint}</small>}</div>
    <div className="flex shrink-0 items-center gap-1">
      <button type="button" className={`${countingButton} !h-11 !w-11 !px-0 text-2xl`} disabled={disabled || value === 0} onClick={onMinus} aria-label={value === null ? `Confirmar zero: ${label}` : `Tirar ${label}`}>−</button>
      <output className="min-w-9 text-center text-2xl font-bold tabular-nums" aria-label={`Quantidade: ${label}`}>{value ?? '—'}</output>
      <button type="button" className={`${countingButton} !h-11 !w-11 !border-[#2f6fb2] !bg-[#2f6fb2] !px-0 text-2xl !text-white`} disabled={disabled || (value ?? 0) >= 100000} onClick={onPlus} aria-label={`Adicionar ${label}`}>+</button>
    </div>
  </div>;
}
