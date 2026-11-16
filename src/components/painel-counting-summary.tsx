'use client';
import type { CountingDay } from '@/lib/trip-counting';
import { countStateLabel,countTime,useCountingRead } from './counting-controls';
export function PainelCountingSummary({ date }: { date: string }) {
  const { data,error,checkedAt } = useCountingRead<CountingDay>(`/api/painel/dias/${date}/contagem`);
  return <section className="space-y-4 rounded-xl border border-[#d4dfeb] bg-white p-4 sm:p-6">
    <h2 className="text-lg font-bold">Presença por veículo</h2><p className="text-sm text-[#45647f]">{checkedAt ? `Consultado às ${countTime(checkedAt)}. Atualização a cada 5 segundos.` : 'Consultando contagens…'} Rascunhos não entram no total.</p>
    {error && <p role="alert">{error}</p>}
    {data?.groups.length === 0 && <p>Nenhum passeio nesta data.</p>}
    {data?.groups.map(group => <details key={`${group.agendaId}:${group.clientId}`} className="border-t border-[#d4dfeb] pt-3" open>
      <summary className="min-h-11 cursor-pointer font-semibold">{group.clientName} · {group.vehicles.filter(v => v.state === 'completed').length}/{group.vehicles.length} veículos concluídos</summary><p className="text-sm text-[#45647f]">{group.transportName ?? "Transportador não informado"} · {group.vehicleCounts.planned} previstos · +{group.vehicleCounts.extra} a mais no dia</p>
      {group.vehicles.length === 0 ? <p className="py-3">Sem veículos cadastrados.</p> : <ul className="divide-y divide-[#d4dfeb]">{group.vehicles.map(v => <li key={v.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><span>{v.type === 'bus' ? 'Ônibus' : 'Van'} {v.ordinal}{v.isExtra ? ' · extra' : ''} · {v.ownerName ?? 'Sem contador'}<small className="block">{v.transportName ?? 'Transportador não informado'}{v.startedAt ? ` · desde ${countTime(v.startedAt)}` : ''}</small></span><span className="tabular-nums">{countStateLabel[v.state]} · {v.state === 'counting' ? `${v.draftSubtotal ?? '—'} até agora · provisório` : v.state === 'completed' ? `${v.total ?? '—'} pessoas` : `Prev. ${v.plannedPeople ?? 'não informada'}`}</span></li>)}</ul>}
    </details>)}
  </section>;
}
