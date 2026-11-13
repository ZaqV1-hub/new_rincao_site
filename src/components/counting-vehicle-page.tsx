'use client';
import { useEffect,useState } from 'react';
import type { CountingVehicleDetail } from '@/lib/trip-counting';
import { COUNT_CATEGORIES,countCategories,emptyCountDraft,normalizeCountDraft,type CountAction,type CountDraft } from '@/lib/trip-counting-contract';
import { CountingSignature } from './counting-signature';
import { CountingCommandStatus,countingButton,countingInput,countingPrimary,countStateLabel,countTime,useCountingCommand,useCountingConnection,useCountingLeaveWarning,useCountingRead } from './counting-controls';
export function CountingVehiclePage({ id,manager,actorCpf }: { id: number; manager: boolean; actorCpf: string }) {
  const { data,error,checkedAt,refresh } = useCountingRead<CountingVehicleDetail>(`/api/contagem/veiculos/${id}`);
  const online = useCountingConnection();
  const [draft,setDraft] = useState<CountDraft>(emptyCountDraft),[baseVersion,setBaseVersion] = useState(0),[dirty,setDirty] = useState(false),[reason,setReason] = useState('');
  const [signature,setSignature] = useState(''),[signatureKey,setSignatureKey] = useState(0),[review,setReview] = useState(false),[validation,setValidation] = useState('');
  const command = useCountingCommand(`rincao:count:vehicle:${actorCpf}:${id}`,async result => {
    setDirty(result.state === 'counting' && !!signature); setReview(false); setBaseVersion(result.version);
    if (result.state !== 'counting') { setSignature(''); setSignatureKey(key => key+1); }
    const fresh = await refresh();
    if (fresh && fresh.version >= result.version) { setDraft(fresh.revision?.draft ?? emptyCountDraft()); setBaseVersion(fresh.version); }
  });
  useEffect(() => {
    if (!data || data.version < baseVersion || dirty || command.pending || command.busy) return;
    const timer = setTimeout(() => { setDraft(data.revision?.draft ?? emptyCountDraft()); setBaseVersion(data.version); },0);
    return () => clearTimeout(timer);
  },[data,baseVersion,dirty,command.pending,command.busy]);
  useCountingLeaveWarning(dirty || command.pending !== null);
  const conflict = data !== null && baseVersion !== 0 && data.version > baseVersion;
  const catchingUp = data !== null && data.version < baseVersion;
  const allowedDate = !!data && (data.date === data.today || manager);
  const canEdit = !!data && !data.closed && allowedDate && data.state === 'counting' && data.revision?.ownedByMe;
  const blocked = command.blocked || !canEdit || conflict || catchingUp || review;
  function edit(next: CountDraft) { setDraft(next); setDirty(true); setValidation(''); }
  async function action(action: CountAction) {
    if (!data) return;
    await command.submit(`/api/contagem/veiculos/${id}/${action}`,{ version: baseVersion,reason,...(['save','complete'].includes(action) ? { draft } : {}),...(action === 'complete' ? { signature } : {}) });
  }
  function loadCurrent() {
    if (!data || (dirty && !window.confirm('Substituir os campos desta tela pela versão salva no servidor? A edição não salva será descartada.'))) return;
    setDraft(data.revision?.draft ?? emptyCountDraft()); setBaseVersion(data.version); setDirty(false); setSignature(''); setSignatureKey(key => key+1); setReview(false);
  }
  const total = countCategories.reduce((sum,key) => sum+(draft.counts[key] ?? 0),0);
  return <div className="space-y-6">
    <a href={`/contagem${data ? `?date=${data.date}` : ''}`} className="inline-flex min-h-11 items-center underline underline-offset-4">Voltar aos passeios</a>
    <div><h1 className="text-2xl font-bold">{data ? `${data.type === 'bus' ? 'Ônibus' : 'Van'} #${data.id}` : 'Consultando veículo…'}</h1>
      {data && <><p className="mt-2 text-lg">{data.clientName}</p><p className="text-sm text-[#45647f]">{data.date.split('-').reverse().join('/')} · {countStateLabel[data.state]} · Previsão: {data.plannedPeople ?? 'não informada'}</p></>}
    </div>
    {checkedAt && <p className="text-sm text-[#45647f]">Estado consultado às {countTime(checkedAt)}. {dirty ? 'Há alterações nesta tela ainda não salvas.' : 'Os dados exibidos foram consultados no servidor.'}</p>}
    {error && <p role="alert" className="rounded-lg border border-[#b84137] bg-[#fff5f3] p-3">{error} Preserve a edição e confira a conexão antes de concluir.</p>}
    {!online && <p role="alert" className="rounded-lg border border-[#b84137] bg-[#fff5f3] p-3">Sem conexão. Mantenha esta tela aberta para preservar a edição. A conclusão fica bloqueada até a conexão voltar.</p>}
    <CountingCommandStatus command={command}/>
    {data?.closed && <p className="font-semibold">Dia finalizado. Contagem disponível apenas para consulta.</p>}
    {data && data.date !== data.today && <p className="text-sm">{manager ? 'Esta data é diferente de hoje. Toda alteração exige motivo.' : 'Esta data está disponível apenas para consulta.'}</p>}
    {conflict && <div role="alert" className="space-y-3 border-y border-[#b84137] py-4"><p>O veículo mudou desde que você começou. Seus campos foram preservados. Confira a versão atual antes de continuar.</p><button className={countingButton} disabled={command.blocked} onClick={loadCurrent}>Usar versão salva no servidor</button></div>}
    {manager && data && !data.closed && <label className="grid gap-2">Motivo da alteração excepcional<input className={countingInput} maxLength={1000} value={reason} disabled={command.blocked} onChange={e => setReason(e.target.value)}/></label>}
    {data && !data.closed && allowedDate && <div className="flex flex-wrap gap-3">
      {(data.state === 'waiting' || (data.state === 'counting' && !data.revision?.ownerName)) && <button className={countingPrimary} disabled={command.blocked || conflict || !baseVersion} onClick={() => void action('start')}>Iniciar contagem</button>}
      {data.state === 'counting' && !data.revision?.ownedByMe && data.revision?.ownerName && <p>Contagem com {data.revision.ownerName}. {manager ? 'Informe o motivo para assumir.' : 'Aguarde a liberação pelo contador ou procure um gerente.'}</p>}
      {manager && data.state === 'counting' && !data.revision?.ownedByMe && data.revision?.ownerName && <button className={countingButton} disabled={command.blocked || conflict || !reason.trim()} onClick={() => void action('takeover')}>Assumir contagem</button>}
      {manager && data.state === 'completed' && <button className={countingButton} disabled={command.blocked || conflict || !reason.trim()} onClick={() => void action('recount')}>Abrir recontagem</button>}
    </div>}
    {data?.revision && <>
      <fieldset disabled={blocked} className="space-y-4"><legend className="mb-3 text-xl font-bold">Passageiros por categoria</legend>
        <p className="text-sm text-[#45647f]">Informe zero nas categorias sem passageiros. Cada pessoa deve aparecer em uma única categoria.</p>
        <div className="divide-y divide-[#d4dfeb]">{countCategories.map(key => <label key={key} className="grid grid-cols-[1fr_6rem] items-center gap-3 py-3"><span>{COUNT_CATEGORIES[key].label}</span>
          <input aria-label={COUNT_CATEGORIES[key].label} className={`${countingInput} text-right tabular-nums`} type="number" min="0" max="100000" step="1" inputMode="numeric" value={draft.counts[key] ?? ''} onChange={e => edit({ ...draft,counts: { ...draft.counts,[key]: e.target.value === '' ? null : Number(e.target.value) } })}/>
        </label>)}</div>
        <p className="text-lg font-bold tabular-nums">{data.state === 'completed' ? 'Total concluído' : 'Subtotal preenchido'}: {total} pessoas</p>
        <div className="space-y-3"><h2 className="font-bold">Detalhes de PCD</h2><p className="text-sm text-[#45647f]">Descreva as necessidades de atendimento e a quantidade. Evite nomes e diagnósticos.</p>
          {draft.pcdDetails.map((detail,index) => <div key={index} className="grid gap-3 border-b border-[#d4dfeb] pb-4">
            <label className="grid gap-1">Categoria<select className={countingInput} value={detail.category} onChange={e => edit({ ...draft,pcdDetails: draft.pcdDetails.map((row,i) => i === index ? { ...row,category: e.target.value as 'pcdChild' | 'pcdAdult' } : row) })}><option value="pcdChild">Criança PCD</option><option value="pcdAdult">Adulto PCD</option></select></label>
            <label className="grid gap-1">Necessidade de atendimento<input className={countingInput} maxLength={120} value={detail.description} onChange={e => edit({ ...draft,pcdDetails: draft.pcdDetails.map((row,i) => i === index ? { ...row,description: e.target.value } : row) })}/></label>
            <label className="grid gap-1">Quantidade<input className={countingInput} type="number" min="1" max="100000" step="1" inputMode="numeric" value={detail.quantity} onChange={e => edit({ ...draft,pcdDetails: draft.pcdDetails.map((row,i) => i === index ? { ...row,quantity: Number(e.target.value) } : row) })}/></label>
            <button type="button" className={countingButton} onClick={() => edit({ ...draft,pcdDetails: draft.pcdDetails.filter((_,i) => i !== index) })}>Remover detalhe {index+1}</button>
          </div>)}
          {canEdit && draft.pcdDetails.length < 40 && <button type="button" className={countingButton} onClick={() => edit({ ...draft,pcdDetails: [...draft.pcdDetails,{ category: 'pcdChild',description: '',quantity: 1 }] })}>Adicionar detalhe de PCD</button>}
        </div>
        <label className="grid gap-2">Observações<textarea className={countingInput} rows={3} maxLength={2000} value={draft.notes} onChange={e => edit({ ...draft,notes: e.target.value })}/></label>
        <h2 className="pt-4 text-xl font-bold">Confirmação do responsável</h2>
        <label className="grid gap-2">Nome do responsável<input className={countingInput} autoComplete="off" maxLength={160} value={draft.responsible.name} onChange={e => edit({ ...draft,responsible: { ...draft.responsible,name: e.target.value,confirmed: false } })}/></label>
        <label className="grid gap-2">WhatsApp com DDD<input className={countingInput} type="tel" autoComplete="off" maxLength={40} value={draft.responsible.phone} onChange={e => edit({ ...draft,responsible: { ...draft.responsible,phone: e.target.value,confirmed: false } })}/></label>
        <label className="flex min-h-11 items-center gap-3"><input type="checkbox" className="h-5 w-5 accent-[#165e96]" checked={draft.responsible.confirmed} onChange={e => edit({ ...draft,responsible: { ...draft.responsible,confirmed: e.target.checked } })}/>Conferi nome e WhatsApp com o responsável.</label>
      </fieldset>
      {canEdit && <CountingSignature key={signatureKey} disabled={blocked} onChange={png => { setSignature(png); setDirty(true); }}/>} 
      {validation && <p role="alert" className="text-[#9e2d24]">{validation}</p>}
      {canEdit && !review && <div className="flex flex-wrap gap-3 border-t border-[#d4dfeb] pt-5">
        <button className={countingButton} disabled={blocked} onClick={() => void action('save')}>Salvar rascunho</button>
        <button className={countingPrimary} disabled={blocked || !!error || !online} onClick={() => { try { normalizeCountDraft(draft,true); if (!signature) throw new Error('Peça a assinatura do responsável antes de concluir.'); setReview(true); setValidation(''); } catch (error) { setValidation(error instanceof Error ? error.message : 'Confira os campos.'); } }}>Revisar e concluir</button>
        <button className={countingButton} disabled={blocked || dirty} onClick={() => void action('release')}>Liberar para outro contador</button>
      </div>}
      {review && <section className="space-y-4 rounded-xl border border-[#aabed0] bg-white p-5"><h2 className="text-xl font-bold">Confira antes de concluir</h2>
        <p className="tabular-nums">{total} passageiros · {data.clientName} · {data.type === 'bus' ? 'Ônibus' : 'Van'} #{id}</p><p>{draft.responsible.name} · {draft.responsible.phone}</p>
        <p className="text-sm">A contagem e a assinatura serão registradas juntas. Uma correção após a conclusão exigirá recontagem autorizada pelo gerente.</p>
        <div className="flex flex-wrap gap-3"><button className={countingButton} disabled={command.blocked} onClick={() => setReview(false)}>Voltar à edição</button><button className={countingPrimary} disabled={command.blocked || conflict || !canEdit || !!error || !online} onClick={() => void action('complete')}>Confirmar contagem e assinatura</button></div>
      </section>}
    </>}
    {!!data?.history.length && <section className="border-t border-[#d4dfeb] pt-5"><h2 className="text-xl font-bold">Histórico de conclusões</h2><ul className="divide-y divide-[#d4dfeb]">{data.history.map(revision => <li key={revision.id} className="py-4"><p>{revision.ownerName ?? 'Operador'} · {new Date(revision.completedAt).toLocaleString('pt-BR',{ timeZone: 'America/Sao_Paulo' })}</p>
      {revision.canReadSignature && <a href={`/api/contagem/assinaturas/${revision.id}`} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center underline underline-offset-4">Consultar assinatura registrada</a>}</li>)}</ul></section>}
  </div>;
}
