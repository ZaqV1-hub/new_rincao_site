'use client';
import Link from 'next/link';
import { useCallback,useEffect,useState } from 'react';
import { tripMoney } from './trip-settlement-summary';
import { OperationalExpensesPanel } from './operational-expenses-panel';
import { TRIP_PAYMENT_METHODS } from '@/lib/trip-settlement-contract';
import type { OperationalTripDay } from '@/lib/operational-trip-day';
import type { PublicTripDetail } from '@/lib/trip-settlement-route';
type TripDay = Omit<OperationalTripDay,'trips'> & { trips: PublicTripDetail[] };
export function PainelTripDay({ date,actorCpf }: { date: string; actorCpf: string }) {
  const [day,setDay] = useState<TripDay | null>(null),[error,setError] = useState<string | null>(null),[busy,setBusy] = useState(false);
  const load = useCallback(async () => {
    const response = await fetch(`/api/painel/dias/${date}/passeios`,{ cache: 'no-store' }),body = await response.json();
    if (!response.ok || !body.ok) throw new Error(body.error?.message ?? 'Não foi possível consultar os passeios.');
    setDay(body.data); setError(null);
  },[date]);
  useEffect(() => { let active = true; Promise.resolve().then(() => { if (active) void load().catch(error => { if (active) setError(error.message); }); }); return () => { active = false; }; },[load]);
  return <div className="space-y-5"><header className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold">Caixa dos passeios</h2><button type="button" className="min-h-11 underline disabled:opacity-50" disabled={busy} onClick={async () => { setBusy(true); try { await load(); } catch (error) { setError(error instanceof Error ? error.message : 'Falha ao atualizar.'); } finally { setBusy(false); } }}>Conferir dados atuais</button></header>
    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-900">{error}</p>}
    {!day && !error && <p role="status">Consultando passeios, despesas e caixas…</p>}
    {day && <>
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[['Resultado dos passeios',day.resultCents],['Receita finalizada',day.revenueCents],['Despesas dos passeios',day.expenseCents],['Dinheiro nos caixas',day.expectedCashCents]].map(([label,value]) => <div key={label} className="border-l-2 border-[#a7c4db] pl-3"><dt>{label}</dt><dd className="text-xl font-bold tabular-nums">{value === null ? 'Indisponível' : tripMoney(value as number)}</dd></div>)}</dl>
      <p className="text-sm text-[#45647f]">Somente passeios finalizados compõem a receita. O dinheiro nos caixas também considera troco, fundos, sangrias, despesas e devoluções. Dados conferidos às {new Date(day.generatedAt).toLocaleTimeString('pt-BR')}.</p>
      <div className="flex flex-wrap gap-4"><Link className="inline-flex min-h-11 items-center underline" href={`/painel/caixas?date=${date}`}>Abrir ou consultar caixas da data</Link><a className="inline-flex min-h-11 items-center underline" href={`/api/painel/dias/${date}/passeios/relatorio`} target="_blank" rel="noreferrer">Exportar relatório dos passeios</a></div>
      <ul className="grid gap-3 sm:grid-cols-2">{day.sessions.map(s => <li key={s.id} className="space-y-2 rounded-lg border border-[#d4dfeb] bg-white p-4"><Link className="font-semibold underline" href={`/painel/caixas/${s.id}`}>{s.locationName} · #{s.id} · {s.closedAt ? 'Fechado' : 'Aberto'}</Link><p>Esperado: {tripMoney(s.snapshot.expectedCashCents)} · Contado: {s.snapshot.countedCashCents === null ? 'Não informado' : tripMoney(s.snapshot.countedCashCents)}</p><p className="text-sm">Troco: {tripMoney(s.snapshot.openingCashCents)} · Fundos: {tripMoney(s.snapshot.fundsCents)} · Sangrias: {tripMoney(s.snapshot.withdrawalsCents)}</p></li>)}</ul>
      <details className="space-y-3 rounded-xl border border-[#d4dfeb] bg-white p-4"><summary className="min-h-11 cursor-pointer font-semibold">Pago por forma de pagamento</summary><p className="text-sm">Valores dos recibos finalizados, por data da visita.</p><dl>{day.payments.map(p => <div key={p.method} className="flex justify-between gap-4 border-b border-[#d4dfeb] py-2"><dt>{p.method === 'online' ? 'Online (site)' : TRIP_PAYMENT_METHODS[p.method as keyof typeof TRIP_PAYMENT_METHODS] ?? p.method}</dt><dd>{tripMoney(p.amountCents)}</dd></div>)}</dl><p>Reembolsos a fazer: {tripMoney(day.refundsPendingCents)}</p>{day.sessions.flatMap(s => s.snapshot.movements.map(m => <p key={`${s.id}:${m.id}`} className="text-sm">Caixa #{s.id} · {m.type} · {m.responsible} · {tripMoney(m.amountCents)} · {m.reason}</p>))}</details>
      <details className="rounded-xl border border-[#d4dfeb] bg-white p-4"><summary className="min-h-11 cursor-pointer font-semibold">Despesas dos passeios · {day.expenses?.length ?? 'Indisponível'}</summary><OperationalExpensesPanel date={date} today={day.today} actorCpf={actorCpf} scope="trips" expenses={day.expenses} sessions={day.sessions} groups={day.trips.map(t => t.source)} closed={day.closed || !!error} onSaved={load} /></details>
      <ul className="grid gap-3 md:grid-cols-2">{day.trips.map(t => { const s = t.receipt?.snapshot ?? t.source; return <li key={`${s.agendaId}:${s.clientId}`} className="space-y-2 rounded-xl border border-[#d4dfeb] bg-white p-4"><Link className="inline-flex min-h-11 items-center text-lg font-bold underline" href={`/painel/clientes/passeios/${s.agendaId}/alunos?clientId=${s.clientId}`}>{s.clientName}</Link><p className="font-semibold">{t.receipt ? `Finalizado · Recibo #${t.receipt.number}` : 'A fechar'} · {s.calculation ? tripMoney(t.receipt ? s.calculation.totalTripCents : s.calculation.schoolChargeCents) : 'Cálculo a conferir'}</p><p>{s.vehicles.length} veículo(s) · {s.vehicles.filter(v => v.state === 'completed').length} concluído(s) · {s.calculation ? Object.values(s.calculation.counts).reduce((sum,n) => sum+n,0) : 'A conferir'} pessoa(s) contada(s)</p>{s.blockingIssues.map(issue => <p key={issue} className="text-sm text-amber-950">{issue}</p>)}</li>; })}</ul>
    </>}
  </div>;
}
