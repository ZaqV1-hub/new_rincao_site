'use client';
import { OperationalDialog,closeDialogOnBackdrop } from './operational-dialog';
import { useEffect,useRef,useState } from 'react';
import { useRouter } from 'next/navigation';
import { CountingQrIcon } from './counting-qr-icon';
import { CountingVehicleIcon } from './counting-vehicle-icon';
import { CountingTripCompletions } from './counting-trip-completions';
import type { CountingDay } from '@/lib/trip-counting';
import type { CountingAttendance } from '@/lib/counting-attendance';
import { getSaoPauloToday } from '@/lib/operational-date';
import { CountingCommandStatus,countingButton,countingInput,countingPrimary,countTime,useCountingCommand,useCountingLeaveWarning,useCountingRead } from './counting-controls';

export const vehicleColors = {
  waiting: 'border-[#cbd6e3] bg-[#e6ecf3] text-[#5c6f86]',
  counting: 'border-[#f2b33d] bg-[#fff1cf] text-[#8a5a00]',
  completed: 'border-[#58b57a] bg-[#e3f4e9] text-[#1f7440]',
};
const feedActions = { start: 'começou',takeover: 'assumiu',complete: 'concluiu',add: 'adicionou',recount: 'abriu recontagem de' };
export function CountingDayPage({ date,manager,actorCpf,canGate = false,trip }: { date: string; manager: boolean; actorCpf: string; canGate?: boolean; trip?: { agendaId: number; clientId: number } }) {
  const [selectedVehicle,setSelectedVehicle] = useState<CountingDay["groups"][number]["vehicles"][number] | null>(null);
  const selectedDay = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    const selected = selectedDay.current,strip = selected?.parentElement;
    if (selected && strip) strip.scrollLeft += selected.getBoundingClientRect().left-strip.getBoundingClientRect().left-(strip.clientWidth-selected.offsetWidth)/2;
  },[date,trip]);
  const router = useRouter(),startAfterAdd = useRef(false),extraDialog = useRef<HTMLDialogElement>(null);
  const addIntentKey = `rincao:count:add-intent:${actorCpf}:${date}`;
  const [addedVehicle,setAddedVehicle] = useState<number | null>(null);
  const attendance = useCountingRead<CountingAttendance>(`/api/contagem/dias/${date}/entradas`);
  const { data,error,checkedAt,refresh } = useCountingRead<CountingDay>(`/api/contagem/dias/${date}`);
  const [adding,setAdding] = useState<string | null>(null),[type,setType] = useState('bus'),[planned,setPlanned] = useState('40'),[reason,setReason] = useState(''),[carrier,setCarrier] = useState('');
  useEffect(() => { if (adding) extraDialog.current?.showModal(); },[adding]);
  const startCommand = useCountingCommand(`rincao:count:start:${actorCpf}:${date}`,async result => { router.push(`/contagem/veiculos/${result.vehicleId}`); });
  const command = useCountingCommand(`rincao:count:add:${actorCpf}:${date}`,async result => {
    setAdding(null); setCarrier(''); setAddedVehicle(result.vehicleId); await refresh();
    if (startAfterAdd.current || sessionStorage.getItem(addIntentKey) === 'count') { startAfterAdd.current = false; sessionStorage.removeItem(addIntentKey); await startCommand.submit(`/api/contagem/veiculos/${result.vehicleId}/start`,{ version: result.version,reason }); }
  });
  useCountingLeaveWarning(command.pending !== null || startCommand.pending !== null);
  const blocked = command.blocked || startCommand.blocked;
  const groups = data?.groups.filter(group => !trip || (group.agendaId === trip.agendaId && group.clientId === trip.clientId)) ?? [];
  const empty = !blocked && !trip && data && !data.closed && data.groups.length === 0 && !error && !attendance.error && attendance.data?.hasDayUse === false && attendance.data.sold === 0 && attendance.data.admitted === 0;
  const today = data?.today ?? getSaoPauloToday(),editable = date <= today && (manager || date === today) && !data?.closed;
  const vehicles = groups.flatMap(group => group.vehicles);
  const completed = vehicles.filter(vehicle => vehicle.state === 'completed'),counting = vehicles.filter(vehicle => vehicle.state === 'counting');
  const total = completed.reduce((sum,vehicle) => sum+(vehicle.total ?? 0),0);
  const knownForecast = groups.reduce((sum,group) => sum+(group.plannedPeople ?? 0),0) ?? 0;
  const forecastMissing = groups.some(group => group.plannedPeople === null);
  const dates = Array.from({ length: 8 },(_,index) => {
    const day = new Date(`${date}T12:00:00Z`); day.setUTCDate(day.getUTCDate()+index-3);
    return { date: day.toISOString().slice(0,10),day: day.getUTCDate(),label: day.toLocaleDateString('pt-BR',{ weekday: 'short',timeZone: 'UTC' }).replace('.','') };
  });
  return <div className="space-y-6">
    {!trip && <nav aria-label="Dias de contagem" className="-mx-4 -mt-5 flex gap-2 overflow-x-auto [scrollbar-width:thin] [scrollbar-color:#b9cce2_#133a62] bg-[#133a62] px-4 pb-4">
      {dates.map(day => <a key={day.date} ref={day.date === date ? selectedDay : undefined} href={`/contagem?date=${day.date}`} aria-current={day.date === date ? 'date' : undefined} className={`grid min-w-[58px] shrink-0 place-items-center rounded-xl border py-2 ${day.date === date ? 'border-white bg-white text-[#0b1f36]' : 'border-white/20 text-white'}`}><span className="text-[11px] uppercase">{day.date === today ? 'hoje' : day.label}</span><b className="text-xl">{day.day}</b></a>)}
    </nav>}
    {empty ? <div className="px-2.5 py-10 text-center text-sm text-[#6a7c92]"><h1 className="mb-1.5 text-base font-bold text-[#0b1f36]">Sem movimento em {new Date(`${date}T12:00:00Z`).toLocaleDateString('pt-BR',{ weekday: 'long',day: 'numeric',month: 'long',timeZone: 'UTC' })}</h1><p>Não há passeios nem day use nesta data.</p></div> : <>
    {trip && <a className="inline-flex min-h-11 items-center underline" href={`/contagem?date=${date}`}>← Voltar aos passeios</a>}
    {trip ? <h1 className="text-xl font-bold">{groups[0]?.clientName ?? "Passeio"}</h1> : <h1 className="sr-only">{new Date(`${date}T12:00:00Z`).toLocaleDateString('pt-BR',{ day: 'numeric',month: 'long',timeZone: 'UTC' })}</h1>}
    {date > today && <p className="rounded-xl border border-[#d9e3ee] bg-[#eaf2fb] p-3 text-sm">A contagem desta data abre no próprio dia. Aqui você já vê o que está previsto.</p>}
    {data?.closed && <p className="rounded-xl border border-[#58b57a] bg-[#e3f4e9] p-3 text-sm">Contagem indisponível para alterações. Consulte os relatórios do dia para conferir o encerramento.</p>}
    {error && <p role="alert" className="rounded-xl border border-[#b84137] bg-[#fff5f3] p-3 text-sm">{error} Os dados anteriores podem estar desatualizados.</p>}
    <CountingCommandStatus command={command}/><CountingCommandStatus command={startCommand}/>{addedVehicle && <a href={`/contagem/veiculos/${addedVehicle}`} className="inline-flex min-h-11 items-center text-sm underline">Veículo adicionado · abrir contagem</a>}
    <section className="rounded-2xl border border-[#d9e3ee] bg-white p-4" aria-label={trip ? "Resumo do passeio" : "Resumo do parque"}>
      <div className="flex items-end justify-between gap-3"><div><strong className="text-[40px] leading-none tabular-nums">{data && (trip || attendance.data) ? total+(trip ? 0 : attendance.data!.admitted) : '—'}</strong><p className="mt-1 text-xs text-[#6a7c92]">{trip ? 'pessoas contadas neste passeio' : 'pessoas contadas no parque'}</p><p className="mt-1 text-xs text-[#6a7c92]">{data ? `previsão ${forecastMissing ? 'conhecida ' : 'de '}${knownForecast+(trip ? 0 : attendance.data?.sold ?? 0)}${!trip && !attendance.data ? ' · day use não consultado' : ''}${forecastMissing ? ' · há passeios sem previsão' : ''}` : 'Consultando previsão…'}</p></div><div className="shrink-0 text-right"><b className="text-2xl">{completed.length}<small className="ml-1 text-sm font-normal text-[#6a7c92]">/ {vehicles.length}</small></b><p className="text-xs text-[#6a7c92]">veículos</p></div></div>
      {!!vehicles.length && <><div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-[#e6ecf3]" aria-hidden="true"><span className="bg-[#2e8b4e]" style={{ width: `${completed.length/vehicles.length*100}%` }}/><span className="bg-[#f2b33d]" style={{ width: `${counting.length/vehicles.length*100}%` }}/></div><div className="mt-2 flex flex-wrap gap-3 text-xs text-[#6a7c92]"><span className="inline-flex items-center gap-1.5"><i aria-hidden="true" className="h-[9px] w-[9px] rounded-[3px] bg-[#2e8b4e]"/>{completed.length} concluídos</span><span className="inline-flex items-center gap-1.5"><i aria-hidden="true" className="h-[9px] w-[9px] rounded-[3px] bg-[#f2b33d]"/>{counting.length} contando</span><span className="inline-flex items-center gap-1.5"><i aria-hidden="true" className="h-[9px] w-[9px] rounded-[3px] bg-[#cbd6e3]"/>{vehicles.length-completed.length-counting.length} livres</span></div></>}
    </section>
    {!trip && (!attendance.data || attendance.error || attendance.data.hasDayUse || attendance.data.sold > 0 || attendance.data.admitted > 0) && <section><h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-[#6a7c92]">Day use</h2><div className="flex items-center gap-3 rounded-2xl border border-[#d9e3ee] bg-white px-4 py-3.5"><span className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-xl bg-[#eaf2fb] text-[#2f6fb2]"><CountingQrIcon/></span><div className="min-w-0 flex-1"><b className="block">{attendance.data ? `${attendance.data.admitted} ingressos lidos` : 'Consultando entradas…'}</b><p className="text-xs text-[#6a7c92]">{attendance.data ? `${attendance.data.sold} vendidos para a data · ${attendance.data.expected} ainda previstos` : 'Total do parque ainda não disponível'}</p></div>{canGate && date === today && <a href={`/contagem/day-use?date=${date}`} className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-[10px] bg-[#2f6fb2] px-3 py-2 text-[13px] font-semibold text-white">Ler QR</a>}</div>{attendance.error && <p role="alert" className="mt-2 text-sm">{attendance.error} Total do parque pode estar desatualizado.</p>}</section>}
    <section className="space-y-3"><h2 className="text-xs font-bold uppercase tracking-widest text-[#6a7c92]">{trip ? 'Veículos do passeio' : `Passeios · ${data?.groups.length ?? '—'}`}</h2>
      {data && groups.length === 0 && <p className="rounded-2xl border border-[#d9e3ee] bg-white p-6 text-sm">{trip ? 'Passeio não encontrado nesta data.' : 'Nenhum passeio cadastrado nesta data.'}</p>}
      {groups.map(group => {
        const groupKey = `${group.agendaId}:${group.clientId}`,groupTotal = group.vehicles.reduce((sum,v) => sum+(v.state === 'completed' ? v.total ?? 0 : 0),0);
        return <article key={groupKey} className="rounded-2xl border border-[#d9e3ee] bg-white p-3.5">
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="font-semibold leading-snug"><a className="inline-flex min-h-11 items-center underline-offset-4 hover:underline" href={`/contagem/passeios/${group.agendaId}/${group.clientId}?date=${date}`}>{group.clientName}</a></h3><p className="mt-1 text-xs text-[#6a7c92]">{group.groupType === 'school' ? 'Escola' : group.groupType === 'group' ? 'Grupo' : 'Passeio'} · {group.transportName ?? 'Transportador não informado'} · prev. {group.plannedPeople ?? 'não informada'}</p>{group.vehicleCounts.extra > 0 && <p className="mt-1 text-xs font-semibold text-[#2f6fb2]">{group.vehicleCounts.planned} previstos · +{group.vehicleCounts.extra} a mais no dia</p>}</div><div className="shrink-0 text-right"><b className="text-lg tabular-nums">{groupTotal}</b><small className="block text-[#6a7c92]">{group.vehicleCounts.completed}/{group.vehicles.length} veíc.</small></div></div>
          <div className="mt-3 grid grid-cols-2 gap-2">{group.vehicles.map(vehicle => <a key={vehicle.id} href={`/contagem/veiculos/${vehicle.id}`} onClick={event => {
              if (vehicle.state !== 'waiting' && !event.ctrlKey && !event.metaKey) { event.preventDefault(); setSelectedVehicle(vehicle); return; }
              if (vehicle.state !== 'waiting' || !editable || vehicle.financiallyFinalized || date !== today || event.ctrlKey || event.metaKey) return;
              event.preventDefault(); if (!blocked) void startCommand.submit(`/api/contagem/veiculos/${vehicle.id}/start`,{ version: vehicle.version,reason: '' });
            }} aria-disabled={vehicle.state === 'waiting' && blocked ? true : undefined} className={`flex min-h-[74px] min-w-0 flex-col gap-0.5 rounded-xl border-[1.5px] p-2.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f6fb2] ${vehicleColors[vehicle.state]}`}>
            <strong className="flex flex-wrap items-center gap-[7px] text-sm"><CountingVehicleIcon type={vehicle.type}/> {vehicle.type === 'bus' ? 'Ônibus' : 'Van'} {vehicle.ordinal}{vehicle.isExtra && <small className="rounded border border-current px-1 text-[9px] uppercase">extra</small>}{vehicle.state === 'counting' && <span aria-hidden="true" className="ml-auto h-2 w-2 shrink-0 rounded-full bg-[#f2b33d] motion-safe:animate-pulse"/>}</strong>
            <span className="truncate text-xs" title={vehicle.ownerName ?? undefined}>{vehicle.state === 'completed' ? `Contado por ${vehicle.ownerName ?? 'não informado'}` : vehicle.state === 'counting' ? `${vehicle.ownerName ?? 'Operador'} está contando` : editable && !vehicle.financiallyFinalized ? 'Livre · toque para contar' : 'Livre · somente consulta'}</span>
            <span className="text-xs font-semibold tabular-nums" aria-label={vehicle.state === 'counting' ? `Contagem provisória: ${vehicle.draftSubtotal ?? 'não disponível'}` : undefined}>{vehicle.state === 'completed' ? `${vehicle.total ?? '—'} ${vehicle.total === 1 ? 'pessoa' : 'pessoas'}` : vehicle.state === 'counting' ? `${vehicle.draftSubtotal ?? '—'} até agora` : `prev. ${vehicle.plannedPeople ?? 'não informada'}`}</span>
            {vehicle.transportName !== group.transportName && <small className="text-[11px]">{vehicle.transportName ?? 'Transportador não informado'}</small>}
          </a>)}
            {editable && <button type="button" className="min-h-[74px] rounded-xl border-[1.5px] border-dashed border-[#cbd6e3] p-3 text-sm font-semibold text-[#2f6fb2] disabled:opacity-50" disabled={blocked || group.vehicles.some(v => v.financiallyFinalized)} onClick={() => { setAdding(adding === groupKey ? null : groupKey); setCarrier(''); setType('bus'); setPlanned('40'); }}>+ Chegou mais um ônibus ou van</button>}
          </div>
          {adding === groupKey && <dialog ref={extraDialog} onCancel={event => { if (command.busy) event.preventDefault(); else setAdding(null); }} onClick={event => closeDialogOnBackdrop(event, () => { if (!command.busy) setAdding(null); })} aria-label="Chegou mais um veículo" className="counting-sheet"><div className="counting-sheet-grab" aria-hidden="true"/><form className="space-y-3" onSubmit={event => { event.preventDefault(); startAfterAdd.current = (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'count'; sessionStorage.setItem(addIntentKey,startAfterAdd.current ? 'count' : 'only'); void command.submit('/api/contagem/veiculos',{ agendaId: group.agendaId,clientId: group.clientId,type,plannedPeople: planned === '' ? null : Number(planned),carrierId: carrier === '' ? null : Number(carrier),reason }); }}>
            <CountingCommandStatus command={command}/>
            <fieldset disabled={blocked} className="space-y-3"><legend className="mb-3 font-bold">Chegou mais um veículo</legend>
              <div role="group" aria-label="Tipo do veículo" className="grid grid-cols-2 gap-1 rounded-xl bg-[#eaf2fb] p-1">{([ ['bus','Ônibus'],['van','Van'] ] as const).map(([value,label]) => <button key={value} type="button" aria-pressed={type === value} className={`${countingButton} ${type === value ? '!border-[#2f6fb2] !bg-[#2f6fb2] !text-white' : '!bg-transparent'}`} onClick={() => { setType(value); setPlanned(value === 'van' ? '16' : '40'); }}>{label}</button>)}</div>
              <label className="grid gap-1 text-sm">Transportador<select className={countingInput} value={carrier} onChange={e => setCarrier(e.target.value)}><option value="">Do passeio: {group.transportName ?? 'não informado'}</option>{data?.carriers.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
              <label className="grid gap-1 text-sm">Previsão de pessoas (opcional)<input className={countingInput} type="number" min="0" max="100000" step="1" inputMode="numeric" value={planned} onChange={e => setPlanned(e.target.value)}/></label>
              {manager && date !== today && <label className="grid gap-1 text-sm">Motivo da correção<input className={countingInput} maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} required/></label>}
              <button className={`${countingPrimary} w-full`} type="submit" value="count">Adicionar e contar agora</button><button className={`${countingButton} w-full`} type="submit" value="only">Só adicionar</button><button className={`${countingButton} w-full`} type="button" onClick={() => setAdding(null)}>Cancelar</button>
            </fieldset>
          </form></dialog>}
        </article>;
      })}
    </section>
    {selectedVehicle && <OperationalDialog sheet title={`${selectedVehicle.type === 'bus' ? 'Ônibus' : 'Van'} ${selectedVehicle.ordinal}${selectedVehicle.state === 'completed' ? ' concluído' : ''}`} onClose={() => setSelectedVehicle(null)}>
      <p className="mb-3 text-sm">{selectedVehicle.clientName}</p>
      <p className="mb-4 text-sm">{selectedVehicle.state === 'completed' ? `Contado por ${selectedVehicle.ownerName ?? 'Operador'} · ${selectedVehicle.total ?? '—'} pessoas.` : `${selectedVehicle.ownerName ?? 'Outro monitor'} está contando · ${selectedVehicle.draftSubtotal ?? '—'} pessoas até agora${selectedVehicle.startedAt ? `, desde ${countTime(selectedVehicle.startedAt).slice(0,5)}` : ''}.`}</p>
      {selectedVehicle.state === 'completed' && selectedVehicle.lastCompletedRevision && <a className={`${countingPrimary} w-full`} href={`/contagem/filipetas/${selectedVehicle.lastCompletedRevision}`}>Ver filipeta</a>}
      {editable && !selectedVehicle.financiallyFinalized && <a className={`${countingButton} mt-2 w-full`} href={`/contagem/veiculos/${selectedVehicle.id}`}>{selectedVehicle.state === 'completed' ? 'Recontar este veículo' : 'Assumir esta contagem'}</a>}
      <button type="button" className={`${countingButton} mt-2 w-full`} onClick={() => setSelectedVehicle(null)}>Fechar</button>
    </OperationalDialog>}
    {trip && <CountingTripCompletions date={date} agendaId={trip.agendaId} clientId={trip.clientId}/>}
    {!!data?.feed.length && <section><h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-[#6a7c92]">Agora na equipe</h2><ul className="divide-y divide-[#d9e3ee] rounded-2xl border border-[#d9e3ee] bg-white px-4">{data.feed.slice(0,4).map(event => {
      const vehicle = vehicles.find(item => item.id === event.vehicleId);
      return <li key={event.id} className="flex items-center gap-2.5 py-2.5 text-[13.5px]"><span aria-hidden="true" className={`h-[9px] w-[9px] shrink-0 rounded-full ${event.action === 'complete' ? 'bg-[#2e8b4e]' : event.action === 'add' ? 'bg-[#2f6fb2]' : 'bg-[#f2b33d]'}`}/><span className="min-w-0 flex-1">{event.actorName ?? 'Operador'} {feedActions[event.action]} {vehicle ? `${vehicle.type === 'bus' ? 'ônibus' : 'van'} ${vehicle.ordinal} · ${vehicle.clientName}` : 'um veículo'}{event.action === 'complete' && vehicle?.state === 'completed' ? ` (${vehicle.total ?? '—'} ${vehicle.total === 1 ? 'pessoa' : 'pessoas'})` : ''}</span><time className="shrink-0 text-xs text-[#6a7c92]" dateTime={event.at}>{countTime(event.at).slice(0,5)}</time></li>;
    })}</ul></section>}
    <p className="text-center text-xs text-[#6a7c92]">{checkedAt ? `Consultado às ${countTime(checkedAt)} · atualização a cada 5 s` : 'Consultando passeios…'}</p>
    {!trip && date <= today && <div className="counting-footer sticky bottom-0 -mx-4 bg-[#f4f7fb]/95 px-4 pb-[max(14px,env(safe-area-inset-bottom))] pt-3"><a href={`/contagem/relatorios?date=${date}${date === today && !data?.closed ? '&finalizar=1' : ''}`} className={`${countingPrimary} w-full`}>{data?.closed || date !== today ? 'Ver relatórios do dia' : 'Finalizar contagem do dia'}</a></div>}
    </>}
  </div>;
}
