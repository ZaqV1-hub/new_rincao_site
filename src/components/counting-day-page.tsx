'use client';
import Link from 'next/link';
import { useState } from 'react';
import type { CountingDay } from '@/lib/trip-counting';
import { getSaoPauloToday } from '@/lib/operational-date';
import { CountingCommandStatus,countingButton,countingInput,countingPrimary,countStateLabel,countTime,useCountingCommand,useCountingLeaveWarning,useCountingRead } from './counting-controls';
export function CountingDayPage({ date,manager,actorCpf }: { date: string; manager: boolean; actorCpf: string }) {
  const { data,error,checkedAt,refresh } = useCountingRead<CountingDay>(`/api/contagem/dias/${date}`);
  const command = useCountingCommand(`rincao:count:add:${actorCpf}:${date}`,async () => { await refresh(); });
  const [adding,setAdding] = useState<string | null>(null),[type,setType] = useState('bus'),[planned,setPlanned] = useState(''),[reason,setReason] = useState('');
  useCountingLeaveWarning(command.pending !== null);
  const editable = manager || date === getSaoPauloToday();
  return <div className="space-y-6">
    <div><h1 className="text-2xl font-bold">Contagem de passageiros</h1><p className="mt-2 text-[#45647f]">Escolha o passeio e o veículo. Preencha cada categoria, inclusive quando a quantidade for zero.</p></div>
    <form action="/contagem" className="flex flex-wrap items-end gap-3"><label className="grid gap-2 font-semibold">Data<input className={countingInput} type="date" name="date" defaultValue={date} required/></label><button className={countingButton}>Consultar data</button></form>
    <p className="text-sm text-[#45647f]">{checkedAt ? `Última consulta às ${countTime(checkedAt)}. Atualização a cada 5 segundos enquanto esta tela estiver aberta.` : 'Consultando passeios…'}</p>
    {error && <p role="alert" className="rounded-lg border border-[#b84137] bg-[#fff5f3] p-3">{error} Os dados anteriores podem estar desatualizados.</p>}
    <CountingCommandStatus command={command}/>
    {data?.groups.length === 0 && <p className="border-y border-[#d4dfeb] py-8">Nenhum passeio cadastrado nesta data.</p>}
    {data?.groups.map(group => {
      const groupKey = `${group.agendaId}:${group.clientId}`,completed = group.vehicles.filter(v => v.state === 'completed');
      return <section key={groupKey} className="border-t border-[#d4dfeb] pt-5">
        <h2 className="text-xl font-bold">{group.clientName}</h2>
        <p className="mt-1 text-sm text-[#45647f]">Passeio #{group.agendaId} · Previsão: {group.plannedPeople ?? 'não informada'} · {completed.length} de {group.vehicles.length} veículos concluídos</p>
        <ul className="mt-3 divide-y divide-[#d4dfeb]">{group.vehicles.map(vehicle => <li key={vehicle.id}>
          <Link href={`/contagem/veiculos/${vehicle.id}`} className="flex min-h-20 items-center justify-between gap-3 py-4 hover:bg-[#e8f1fa] focus-visible:outline-2 focus-visible:outline-[#1764a0]">
            <span><strong>{vehicle.type === 'bus' ? 'Ônibus' : 'Van'} #{vehicle.id}</strong><span className="mt-1 block text-sm text-[#45647f]">{vehicle.ownerName ?? 'Sem contador'}{vehicle.addedOnDay ? ' · Adicionado no dia' : ''}</span></span>
            <span className="text-right text-sm">{countStateLabel[vehicle.state]}<strong className="block tabular-nums">{vehicle.total === null ? 'Presença não concluída' : `${vehicle.total} pessoas`}</strong></span>
          </Link></li>)}</ul>
        {group.vehicles.length === 0 && <p className="py-4 text-[#45647f]">Nenhum veículo informado. Adicione o veículo que chegou.</p>}
        <button className={countingButton} disabled={command.blocked || !editable} onClick={() => setAdding(adding === groupKey ? null : groupKey)}>{adding === groupKey ? 'Cancelar inclusão' : 'Adicionar veículo'}</button>
        {adding === groupKey && <form className="mt-4 grid gap-4 rounded-xl border border-[#d4dfeb] bg-white p-4" onSubmit={event => { event.preventDefault(); void command.submit('/api/contagem/veiculos',{ agendaId: group.agendaId,clientId: group.clientId,type,plannedPeople: planned === '' ? null : Number(planned),reason }); }}>
          <fieldset disabled={command.blocked} className="grid gap-4"><legend className="mb-3 font-bold">Veículo que chegou</legend>
            <label className="grid gap-1">Tipo<select className={countingInput} value={type} onChange={e => setType(e.target.value)}><option value="bus">Ônibus</option><option value="van">Van</option></select></label>
            <label className="grid gap-1">Previsão de passageiros (opcional)<input className={countingInput} type="number" min="0" max="100000" step="1" inputMode="numeric" value={planned} onChange={e => setPlanned(e.target.value)}/></label>
            {manager && <label className="grid gap-1">Motivo (obrigatório fora de hoje)<input className={countingInput} maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} required={date !== getSaoPauloToday()}/></label>}
            <button className={countingPrimary} type="submit">Confirmar inclusão</button>
          </fieldset>
        </form>}
      </section>;
    })}
  </div>;
}
