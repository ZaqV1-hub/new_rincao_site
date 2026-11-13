'use client';
import { useEffect,useState } from 'react';
import { CurrencyInput,parseCurrencyInput } from './currency-input';
import { tripMoney } from './trip-settlement-summary';
import { readStoredCashCommand,submitCashCommand } from '@/lib/cash-command-client';
import type { OperationalExpense } from '@/lib/operational-expenses';
import type { CashSession } from '@/lib/operational-cash-session';
const field = 'min-h-11 w-full rounded-lg border border-[#b9cddd] bg-white px-3 py-2 text-[#123b63]';
const categories = { monitoria: 'Monitoria',alimentacao: 'Alimentação',transporte: 'Transporte',atividades: 'Atividades e brinquedos',materiais: 'Materiais',outros: 'Outros' };
const methods: Record<string,string> = { dinhe: 'Dinheiro do caixa',pix: 'Pix',company_card: 'Cartão da empresa' };
export function OperationalExpensesPanel({ date,today,actorCpf,scope,expenses,sessions,groups = [],closed,onSaved }: {
  date: string; today: string; actorCpf: string; scope: 'day' | 'trips'; expenses: OperationalExpense[] | null; sessions: CashSession[];
  groups?: { agendaId: number; clientId: number; clientName: string }[]; closed: boolean; onSaved: () => Promise<void>;
}) {
  const storageKey = `expense:${actorCpf}:${scope}:${date}`;
  const [ready,setReady] = useState(false),[pending,setPending] = useState(false),[busy,setBusy] = useState(false),[message,setMessage] = useState<string | null>(null),[method,setMethod] = useState('pix'),[version,setVersion] = useState(0);
  useEffect(() => { let active = true; Promise.resolve().then(() => { try { const command = readStoredCashCommand(storageKey); if (active) { setPending(!!command); setReady(true); } } catch { if (active) setMessage('Não foi possível recuperar a tentativa anterior. Solicite conferência antes de lançar outra despesa.'); } }); return () => { active = false; }; },[storageKey]);
  async function save(data?: FormData) {
    if (busy || !ready || (!pending && (closed || !data))) return;
    const group = data ? groups.find(g => `${g.agendaId}:${g.clientId}` === data.get('trip')) : null;
    const payload = data ? { date,scope,agendaId: group?.agendaId ?? null,clientId: group?.clientId ?? null,description: String(data.get('description') ?? ''),category: String(data.get('category') ?? ''),method,amountCents: Math.round(parseCurrencyInput(String(data.get('amount') ?? ''))*100),periodId: method === 'dinhe' ? Number(data.get('periodId')) : null,reference: String(data.get('reference') ?? ''),reason: String(data.get('reason') ?? '') } : undefined;
    setBusy(true); setMessage(null);
    const result = await submitCashCommand({ storageKey,url: '/api/painel/despesas',...(pending ? {} : { payload }) });
    if (result.ok) {
      setPending(false); setVersion(v => v+1); setMessage('Despesa registrada.');
      try { await onSaved(); } catch { setMessage('Despesa registrada. Confira os dados atuais para atualizar a lista.'); }
    } else {
      setMessage(result.message);
      try { setPending(!!readStoredCashCommand(storageKey)); } catch { setReady(false); }
    }
    setBusy(false);
  }
  if (expenses === null) return <p>Despesas da Estância indisponíveis. Regra de negócio pendente de confirmação com o Isaque.</p>;
  return <section className="space-y-4" aria-label="Despesas operacionais"><h3 className="text-lg font-bold">{scope === 'trips' ? 'Despesas dos passeios' : 'Outras despesas do dia'}</h3>
    {expenses.length === 0 ? <p>Nenhuma despesa registrada.</p> : <ul className="divide-y divide-[#d4dfeb]">{expenses.map(e => <li key={e.id} className="py-3"><p className="font-semibold">{e.description} · {tripMoney(e.amountCents)}</p><p className="text-sm">{categories[e.category as keyof typeof categories] ?? e.category} · {e.agendaId ? groups.find(g => g.agendaId === e.agendaId && g.clientId === e.clientId)?.clientName ?? `Passeio #${e.agendaId}/${e.clientId}` : scope === 'trips' ? 'Todos os passeios' : 'Dia'} · {methods[e.method] ?? e.method}{e.periodId ? ` · Caixa #${e.periodId}` : ''}</p><p className="text-sm">Comprovante: {e.reference} · Registrado por {e.actorName ?? 'Operador identificado'}</p></li>)}</ul>}
    {message && <p role="status" className="rounded-lg border border-[#b9cddd] bg-[#f3f7fb] p-3">{message}</p>}
    {pending && <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3"><p>Há uma despesa sem confirmação. Confira a mesma tentativa antes de lançar outra.</p><button type="button" className="min-h-11 underline" disabled={busy} onClick={() => void save()}>Conferir tentativa anterior</button></div>}
    {!closed && <details><summary className="min-h-11 cursor-pointer py-3 font-semibold">Lançar despesa</summary><form key={version} onSubmit={event => { event.preventDefault(); void save(new FormData(event.currentTarget)); }}><fieldset className="grid gap-3 sm:grid-cols-2" disabled={busy || pending || !ready}>
      <label className="grid gap-1 font-semibold sm:col-span-2">Descrição<input className={field} name="description" required maxLength={300} /></label>
      <label className="grid gap-1 font-semibold">Alocação<select className={field} name="category">{Object.entries(categories).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      {scope === 'trips' && <label className="grid gap-1 font-semibold">Passeio<select className={field} name="trip"><option value="">Todos os passeios</option>{groups.map(g => <option key={`${g.agendaId}:${g.clientId}`} value={`${g.agendaId}:${g.clientId}`}>{g.clientName}</option>)}</select></label>}
      <label className="grid gap-1 font-semibold">Valor<CurrencyInput className={field} name="amount" required /></label>
      <label className="grid gap-1 font-semibold">Pago com<select className={field} name="method" value={method} onChange={event => setMethod(event.target.value)}>{Object.entries(methods).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      {method === 'dinhe' && <label className="grid gap-1 font-semibold">Caixa<select className={field} name="periodId" required defaultValue=""><option value="" disabled>Selecione o caixa aberto</option>{sessions.filter(s => !s.closedAt && s.date === date && (scope !== 'trips' || s.type === 'trips')).map(s => <option key={s.id} value={s.id}>{s.locationName} · #{s.id}</option>)}</select></label>}
      <label className="grid gap-1 font-semibold">Referência do comprovante<input className={field} name="reference" required maxLength={200} /></label>
      <label className="grid gap-1 font-semibold sm:col-span-2">Motivo {date === today ? '(opcional)' : '(data fora de hoje; exige gerente)'}<textarea className={field} name="reason" maxLength={1000} required={date !== today} /></label>
      <button className="min-h-11 rounded-lg bg-[#205a7f] px-4 py-2 font-semibold text-white disabled:opacity-50" type="submit">{busy ? 'Registrando…' : 'Registrar despesa'}</button>
    </fieldset></form></details>}
  </section>;
}
