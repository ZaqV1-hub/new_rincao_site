'use client';
import { useState } from 'react';
import type { CountingDay } from '@/lib/trip-counting';
import type { CountingAttendance } from '@/lib/counting-attendance';
import { getSaoPauloToday } from '@/lib/operational-date';
import { CountingCommandStatus,countingButton,countingInput,countingPrimary,countStateLabel,countTime,useCountingCommand,useCountingLeaveWarning,useCountingRead } from './counting-controls';

export const vehicleColors = {
  waiting: 'border-[#cbd6e3] bg-[#e6ecf3] text-[#5c6f86]',
  counting: 'border-[#f2b33d] bg-[#fff1cf] text-[#8a5a00]',
  completed: 'border-[#58b57a] bg-[#e3f4e9] text-[#1f7440]',
};
const feedActions = { start: 'começou',takeover: 'assumiu',complete: 'concluiu',add: 'adicionou',recount: 'abriu recontagem de' };
function DayUseCard({ date }: { date: string }) {
  const { data,error } = useCountingRead<CountingAttendance>(`/api/contagem/dias/${date}/entradas`);
  return <section><h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-[#6a7c92]">Day use</h2>
    <a href={`/contagem/day-use?date=${date}`} className="flex items-center gap-3 rounded-2xl border border-[#d9e3ee] bg-white p-4">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#eaf2fb] text-2xl" aria-hidden="true">▦</span>
      <span className="min-w-0 flex-1"><b className="block">{data ? `${data.admitted} ingressos lidos` : 'Portaria · day use'}</b><small className="block text-[#6a7c92]">{data ? `${data.sold} vendidos para a data · ${data.expected} ainda previstos` : 'Consultar entradas e ler QR Code'}</small></span>
      <span className="rounded-xl bg-[#2f6fb2] px-3 py-2 text-sm font-semibold text-white">Ler QR</span>
    </a>{error && <p role="alert" className="mt-2 text-sm">{error}</p>}
  </section>;
}
export function CountingDayPage({ date,manager,actorCpf,canGate = false }: { date: string; manager: boolean; actorCpf: string; canGate?: boolean }) {
  const { data,error,checkedAt,refresh } = useCountingRead<CountingDay>(`/api/contagem/dias/${date}`);
  const [adding,setAdding] = useState<string | null>(null),[type,setType] = useState('bus'),[planned,setPlanned] = useState(''),[reason,setReason] = useState(''),[carrier,setCarrier] = useState('');
  const command = useCountingCommand(`rincao:count:add:${actorCpf}:${date}`,async () => { setAdding(null); setPlanned(''); setCarrier(''); await refresh(); });
  useCountingLeaveWarning(command.pending !== null);
  const today = data?.today ?? getSaoPauloToday(),editable = date <= today && (manager || date === today) && !data?.closed;
  const vehicles = data?.groups.flatMap(group => group.vehicles) ?? [];
  const completed = vehicles.filter(vehicle => vehicle.state === 'completed'),counting = vehicles.filter(vehicle => vehicle.state === 'counting');
  const total = completed.reduce((sum,vehicle) => sum+(vehicle.total ?? 0),0);
  const knownForecast = data?.groups.reduce((sum,group) => sum+(group.plannedPeople ?? 0),0) ?? 0;
  const forecastMissing = data?.groups.some(group => group.plannedPeople === null);
  const dates = Array.from({ length: 8 },(_,index) => {
    const day = new Date(`${date}T12:00:00Z`); day.setUTCDate(day.getUTCDate()+index-3);
    return { date: day.toISOString().slice(0,10),day: day.getUTCDate(),label: day.toLocaleDateString('pt-BR',{ weekday: 'short',timeZone: 'UTC' }).replace('.','') };
  });
  return <div className="space-y-6">
    <nav aria-label="Dias de contagem" className="-mx-4 -mt-5 flex gap-2 overflow-x-auto bg-[#133a62] px-4 pb-4">
      {dates.map(day => <a key={day.date} href={`/contagem?date=${day.date}`} aria-current={day.date === date ? 'date' : undefined} className={`grid min-w-[58px] shrink-0 place-items-center rounded-xl border py-2 ${day.date === date ? 'border-white bg-white text-[#0b1f36]' : 'border-white/20 text-white'}`}><span className="text-[11px] uppercase">{day.date === today ? 'hoje' : day.label}</span><b className="text-xl">{day.day}</b></a>)}
    </nav>
    <div className="flex flex-wrap items-center justify-between gap-2"><h1 className="text-lg font-bold">{new Date(`${date}T12:00:00Z`).toLocaleDateString('pt-BR',{ day: 'numeric',month: 'long',timeZone: 'UTC' })}</h1><details><summary className="cursor-pointer py-2 text-sm underline">Outra data</summary><form action="/contagem" className="mt-2 flex flex-wrap gap-2"><label className="sr-only" htmlFor="count-date">Data</label><input id="count-date" className={countingInput} type="date" name="date" defaultValue={date} required/><button className={countingButton}>Consultar</button></form></details></div>
    {date > today && <p className="rounded-xl border border-[#d9e3ee] bg-[#eaf2fb] p-3 text-sm">A contagem desta data abre no próprio dia. Aqui você já vê o que está previsto.</p>}
    {data?.closed && <p className="rounded-xl border border-[#58b57a] bg-[#e3f4e9] p-3 text-sm">Contagem indisponível para alterações. Consulte os relatórios do dia para conferir o encerramento.</p>}
    {error && <p role="alert" className="rounded-xl border border-[#b84137] bg-[#fff5f3] p-3 text-sm">{error} Os dados anteriores podem estar desatualizados.</p>}
    <CountingCommandStatus command={command}/>
    <section className="rounded-2xl border border-[#d9e3ee] bg-white p-4" aria-label="Resumo dos passeios">
      <div className="flex items-end justify-between gap-3"><div><strong className="text-[40px] leading-none tabular-nums">{data ? total : '—'}</strong><p className="mt-1 text-xs text-[#6a7c92]">pessoas confirmadas nos passeios</p><p className="mt-1 text-xs text-[#6a7c92]">{data ? `previsão ${forecastMissing ? 'conhecida ' : 'de '}${knownForecast}${forecastMissing ? ' · há passeios sem previsão' : ''}` : 'Consultando previsão…'}</p></div><div className="shrink-0 text-right"><b className="text-2xl">{completed.length}<small className="ml-1 text-sm font-normal text-[#6a7c92]">/ {vehicles.length}</small></b><p className="text-xs text-[#6a7c92]">veículos</p></div></div>
      {!!vehicles.length && <><div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-[#e6ecf3]" aria-hidden="true"><span className="bg-[#2e8b4e]" style={{ width: `${completed.length/vehicles.length*100}%` }}/><span className="bg-[#f2b33d]" style={{ width: `${counting.length/vehicles.length*100}%` }}/></div><div className="mt-2 flex flex-wrap gap-3 text-xs text-[#6a7c92]"><span>✓ {completed.length} concluídos</span><span>◷ {counting.length} contando</span><span>○ {vehicles.length-completed.length-counting.length} livres</span></div></>}
    </section>
    {canGate && <DayUseCard date={date}/>}
    <section className="space-y-3"><h2 className="text-xs font-bold uppercase tracking-widest text-[#6a7c92]">Passeios · {data?.groups.length ?? '—'}</h2>
      {data?.groups.length === 0 && <p className="rounded-2xl border border-[#d9e3ee] bg-white p-6 text-sm">Nenhum passeio cadastrado nesta data.</p>}
      {data?.groups.map(group => {
        const groupKey = `${group.agendaId}:${group.clientId}`,groupTotal = group.vehicles.reduce((sum,v) => sum+(v.state === 'completed' ? v.total ?? 0 : 0),0);
        return <article key={groupKey} className="rounded-2xl border border-[#d9e3ee] bg-white p-3.5">
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="font-semibold leading-snug">{group.clientName}</h3><p className="mt-1 text-xs text-[#6a7c92]">{group.groupType === 'school' ? 'Escola' : group.groupType === 'group' ? 'Grupo' : 'Passeio'} · {group.transportName ?? 'Transportador não informado'} · prev. {group.plannedPeople ?? 'não informada'}</p>{group.vehicleCounts.extra > 0 && <p className="mt-1 text-xs font-semibold text-[#2f6fb2]">{group.vehicleCounts.planned} previstos · +{group.vehicleCounts.extra} a mais no dia</p>}</div><div className="shrink-0 text-right"><b className="text-lg tabular-nums">{groupTotal}</b><small className="block text-[#6a7c92]">{group.vehicleCounts.completed}/{group.vehicles.length} veíc.</small></div></div>
          <div className="mt-3 grid grid-cols-2 gap-2">{group.vehicles.map(vehicle => <a key={vehicle.id} href={`/contagem/veiculos/${vehicle.id}`} className={`flex min-h-24 min-w-0 flex-col gap-1 rounded-xl border-[1.5px] p-2.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f6fb2] ${vehicleColors[vehicle.state]}`}>
            <strong className="flex flex-wrap items-center gap-1 text-sm"><span aria-hidden="true">{vehicle.state === 'completed' ? '✓' : vehicle.state === 'counting' ? '◷' : '○'}</span> {vehicle.type === 'bus' ? 'Ônibus' : 'Van'} {vehicle.ordinal}{vehicle.isExtra && <small className="rounded border border-current px-1 text-[9px] uppercase">extra</small>}</strong>
            <span className="text-xs">{countStateLabel[vehicle.state]}{vehicle.ownerName ? ` · ${vehicle.ownerName}` : ' · toque para contar'}</span><span className="text-xs font-semibold tabular-nums">{vehicle.state === 'completed' ? `${vehicle.total ?? '—'} pessoas` : vehicle.state === 'counting' ? `${vehicle.draftSubtotal ?? '—'} até agora · provisório` : `prev. ${vehicle.plannedPeople ?? 'não informada'}`}</span>
            {vehicle.transportName !== group.transportName && <small className="text-[11px]">{vehicle.transportName ?? 'Transportador não informado'}</small>}
          </a>)}
            {editable && <button type="button" className="min-h-24 rounded-xl border-[1.5px] border-dashed border-[#cbd6e3] p-3 text-sm font-semibold text-[#2f6fb2] disabled:opacity-50" disabled={command.blocked || group.vehicles.some(v => v.financiallyFinalized)} onClick={() => { setAdding(adding === groupKey ? null : groupKey); setCarrier(''); }}>+ Chegou mais um ônibus ou van</button>}
          </div>
          {adding === groupKey && <form className="mt-4 space-y-3 border-t border-[#d9e3ee] pt-4" onSubmit={event => { event.preventDefault(); void command.submit('/api/contagem/veiculos',{ agendaId: group.agendaId,clientId: group.clientId,type,plannedPeople: planned === '' ? null : Number(planned),carrierId: carrier === '' ? null : Number(carrier),reason }); }}>
            <fieldset disabled={command.blocked} className="space-y-3"><legend className="mb-3 font-bold">Chegou mais um veículo</legend>
              <label className="grid gap-1 text-sm">Tipo<select className={countingInput} value={type} onChange={e => setType(e.target.value)}><option value="bus">Ônibus</option><option value="van">Van</option></select></label>
              <label className="grid gap-1 text-sm">Transportador<select className={countingInput} value={carrier} onChange={e => setCarrier(e.target.value)}><option value="">Do passeio: {group.transportName ?? 'não informado'}</option>{data.carriers.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
              <label className="grid gap-1 text-sm">Previsão de pessoas (opcional)<input className={countingInput} type="number" min="0" max="100000" step="1" inputMode="numeric" value={planned} onChange={e => setPlanned(e.target.value)}/></label>
              {manager && date !== today && <label className="grid gap-1 text-sm">Motivo da correção<input className={countingInput} maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} required/></label>}
              <button className={`${countingPrimary} w-full`} type="submit">Adicionar veículo</button><button className={`${countingButton} w-full`} type="button" onClick={() => setAdding(null)}>Cancelar</button>
            </fieldset>
          </form>}
        </article>;
      })}
    </section>
    {!!data?.feed.length && <section><h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-[#6a7c92]">Agora na equipe</h2><ul className="divide-y divide-[#d9e3ee] rounded-2xl border border-[#d9e3ee] bg-white px-4">{data.feed.slice(0,5).map(event => {
      const vehicle = vehicles.find(item => item.id === event.vehicleId);
      return <li key={event.id} className="flex items-start gap-2 py-3 text-sm"><span aria-hidden="true" className="text-[#2f6fb2]">{event.action === 'complete' ? '✓' : '•'}</span><span className="min-w-0 flex-1">{event.actorName ?? 'Operador'} {feedActions[event.action]} {vehicle ? `${vehicle.type === 'bus' ? 'ônibus' : 'van'} ${vehicle.ordinal} · ${vehicle.clientName}` : 'um veículo'}</span><time className="shrink-0 text-xs text-[#6a7c92]" dateTime={event.at}>{countTime(event.at).slice(0,5)}</time></li>;
    })}</ul></section>}
    <p className="text-center text-xs text-[#6a7c92]">{checkedAt ? `Consultado às ${countTime(checkedAt)} · atualização a cada 5 s` : 'Consultando passeios…'}</p>
    <div className="sticky bottom-0 -mx-4 bg-[#f4f7fb]/95 px-4 pb-[max(14px,env(safe-area-inset-bottom))] pt-3"><a href={`/contagem/relatorios?date=${date}`} className={`${countingPrimary} w-full`}>{data?.closed ? 'Ver relatórios do dia' : 'Finalizar contagem · relatórios'}</a></div>
  </div>;
}
