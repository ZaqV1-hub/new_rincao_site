'use client';
import type { CountingDayClosure } from '@/lib/counting-day-closure';
import { COUNT_CATEGORIES,countCategories } from '@/lib/trip-counting-contract';
import { countingTime,countingTotals } from '@/lib/counting-slip-contract';
import { useCountingRead } from './counting-controls';
export function CountingTripCompletions({ date,agendaId,clientId }: { date: string; agendaId: number; clientId: number }) {
  const { data,error } = useCountingRead<CountingDayClosure>(`/api/contagem/dias/${date}/relatorios`);
  const group = data?.live.groups.find(item => item.agendaId === agendaId && item.clientId === clientId);
  return <section className="space-y-3"><h2 className="text-lg font-bold">Quem contou</h2>
    {error && <p role="alert">{error}</p>}
    {!data && !error && <p role="status">Consultando conclusões…</p>}
    {group?.slips.length === 0 && <p className="text-sm">Nenhum veículo concluído neste passeio.</p>}
    <ul className="divide-y divide-[#d9e3ee] rounded-2xl border border-[#d9e3ee] bg-white px-4">{group?.slips.map(slip => <li key={slip.revisionId}>
      <a className="block py-4 focus-visible:outline-2 focus-visible:outline-[#2f6fb2]" href={`/contagem/filipetas/${slip.revisionId}`}>
        <div className="flex justify-between gap-3"><b>{slip.type === 'bus' ? 'Ônibus' : 'Van'} {slip.ordinal} · {slip.ownerName ?? 'Operador'}</b><b className="tabular-nums">{countingTotals(slip.draft).total}</b></div>
        <p className="mt-1 text-xs text-[#5c6f86]">Concluído em {countingTime(slip.completedAt)}</p>
        <p className="mt-1 text-sm">{countCategories.filter(key => slip.draft.counts[key]).map(key => `${slip.draft.counts[key]} ${COUNT_CATEGORIES[key].label}`).join(' · ')}</p>
        <p className="mt-1 text-sm">Responsável: {slip.draft.responsible.name}</p><span className="mt-2 block text-sm underline">Ver filipeta e assinatura</span>
      </a>
    </li>)}</ul>
  </section>;
}
