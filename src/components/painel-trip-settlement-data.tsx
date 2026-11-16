'use client';
import { useRef,useState } from 'react';
import { GroupEditor } from './painel-day-program-page';
import type { DayProgram,DayProgramGroupInput } from '@/lib/day-program';
import type { PublicTripDetail } from '@/lib/trip-settlement-route';
const button = 'min-h-11 rounded-lg border border-[#b9cddd] px-4 py-2 font-semibold disabled:opacity-50';
export function TripDataEditor({ source,disabled,onChanged }: { source: PublicTripDetail['source']; disabled: boolean; onChanged: () => Promise<void> }) {
  const [program,setProgram] = useState<DayProgram | null>(null),[editing,setEditing] = useState(false),[busy,setBusy] = useState(false);
  const [draft,setDraft] = useState<DayProgramGroupInput | null>(null),[error,setError] = useState<string | null>(null),[message,setMessage] = useState<string | null>(null),[reason,setReason] = useState('');
  const inFlight = useRef(false),endpoint = `/api/painel/dias/${source.date}/programacao`;
  const past = source.date < source.today;
  const group = program?.groups.find(g => g.agendaId === source.agendaId && g.clientId === source.clientId);
  async function request(method = 'GET',payload?: unknown) {
    const response = await fetch(endpoint,method === 'GET' ? { cache: 'no-store' } : { method,headers: { 'Content-Type': 'application/json' },body: JSON.stringify(payload) });
    const body = await response.json();
    if (!response.ok || !body.ok) throw new Error(body.error?.message ?? 'Não foi possível confirmar a programação.');
    return body.data as DayProgram;
  }
  async function open(create = false) {
    if (inFlight.current || disabled || (past && !reason.trim())) return;
    inFlight.current = true; setBusy(true); setError(null); setMessage(null);
    try {
      const current = await request(create ? 'POST' : 'GET',create ? past ? { allowPast: true,reason: reason.trim() } : {} : undefined);
      setProgram(current);
      if (current.closed) setError('O dia está fechado. Reabra o fechamento para editar.');
      else if (current.version === null) setMessage('Crie a programação desta data para editar os dados do passeio.');
      else setEditing(true);
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível consultar os dados.'); }
    finally { inFlight.current = false; setBusy(false); }
  }
  async function save(value: DayProgramGroupInput) {
    if (!program || inFlight.current || disabled) return;
    setDraft(value); setEditing(false); inFlight.current = true; setBusy(true); setError(null); setMessage(null);
    try {
      const saved = await request('PATCH',{ version: program.version,groups: [value],...(past ? { allowPast: true,reason: reason.trim() } : {}) });
      setProgram(saved); setDraft(null); setMessage('Dados do passeio salvos.');
      try { await onChanged(); } catch { setError('Dados salvos. Confira os dados atuais do passeio para atualizar a tela.'); }
    } catch (e) { setError(`${e instanceof Error ? e.message : 'Gravação sem confirmação.'} Rascunho preservado. Consulte os dados atuais antes de tentar novamente.`); }
    finally { inFlight.current = false; setBusy(false); }
  }
  return <div className="space-y-3">
    {past && <label className="grid gap-1 font-semibold">Motivo para editar dados de uma data passada<textarea className="min-h-11 rounded-lg border border-[#b9cddd] p-3" maxLength={1000} value={reason} disabled={disabled || busy} onChange={event => setReason(event.target.value)} /></label>}
    <button type="button" className={button} disabled={disabled || busy || (past && !reason.trim())} onClick={() => void open()}>{busy ? 'Conferindo programação…' : draft ? 'Consultar dados atuais e rever rascunho' : 'Editar dados do passeio'}</button>
    {program?.version === null && !program.closed && <button type="button" className={button} disabled={disabled || busy} onClick={() => void open(true)}>Criar programação e editar dados</button>}
    {message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}
    {editing && program && group && <GroupEditor group={{ ...group,...draft }} carriers={program.carriers} onClose={() => setEditing(false)} onSave={value => void save(value)} />}
    {editing && !group && <p role="alert">O passeio não está mais na programação desta data. Confira os dados atuais.</p>}
  </div>;
}
