'use client';
import { useEffect,useReducer,useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CountingVehicleDetail } from '@/lib/trip-counting';
import { COUNT_CATEGORIES,PCD_TYPES,countCategories,emptyCountDraft,normalizeCountDraft,type CountAction,type CountCategory,type CountDraft,type PcdType } from '@/lib/trip-counting-contract';
import { countingTotals } from '@/lib/counting-slip-contract';
import { CountingSlipCard } from './counting-slip';
import { CountingSignature } from './counting-signature';
import { CountingCommandStatus,CountingStepper,countingButton,countingInput,countingPrimary,countStateLabel,countTime,useCountingCommand,useCountingConnection,useCountingLeaveWarning,useCountingRead } from './counting-controls';

export type CountEditor = { draft: CountDraft; version: number; dirty: boolean };
type EditorEvent = { type: 'edit'; draft: CountDraft } | { type: 'load'; draft: CountDraft; version: number } | { type: 'saved'; version: number; submitted: CountDraft };
export function countEditorReducer(state: CountEditor,event: EditorEvent): CountEditor {
  if (event.type === 'edit') return { ...state,draft: event.draft,dirty: true };
  if (event.type === 'load') return { draft: event.draft,version: event.version,dirty: false };
  return { ...state,version: event.version,dirty: JSON.stringify(state.draft) !== JSON.stringify(event.submitted) };
}
export function changeCount(draft: CountDraft,key: CountCategory,delta: 1 | -1,description?: PcdType): CountDraft {
  const current = draft.counts[key] ?? 0;
  if (key !== 'pcdChild' && key !== 'pcdAdult') return { ...draft,counts: { ...draft.counts,[key]: Math.max(0,Math.min(100000,current+delta)) } };
  if (delta === 1 && !description) return draft;
  const details = draft.pcdDetails.map(item => ({ ...item }));
  if (delta === 1) {
    if (current >= 100000) return draft;
    const row = details.find(item => item.category === key && item.description === description);
    if (row) row.quantity++;
    else details.push({ category: key,description: description!,quantity: 1 });
  } else {
    const index = details.findLastIndex(item => item.category === key && (!description || item.description === description));
    if (index === -1) return current === 0 ? { ...draft,counts: { ...draft.counts,[key]: 0 } } : draft;
    details[index].quantity--;
  }
  return { ...draft,counts: { ...draft.counts,[key]: Math.max(0,current+delta) },pcdDetails: details.filter(item => item.quantity > 0) };
}
export function CountingVehiclePage({ id,manager,actorCpf }: { id: number; manager: boolean; actorCpf: string }) {
  const router = useRouter();
  const { data,error,checkedAt,refresh } = useCountingRead<CountingVehicleDetail>(`/api/contagem/veiculos/${id}`);
  const online = useCountingConnection();
  const [editor,dispatch] = useReducer(countEditorReducer,{ draft: emptyCountDraft(),version: 0,dirty: false });
  const { draft,version,dirty } = editor;
  const [reason,setReason] = useState(''),[signature,setSignature] = useState(''),[step,setStep] = useState<0 | 1 | 2>(0),[validation,setValidation] = useState('');
  const [pcdAsk,setPcdAsk] = useState<'pcdChild' | 'pcdAdult' | null>(null);
  const command = useCountingCommand(`rincao:count:vehicle:${actorCpf}:${id}`,async (result,body) => {
    if (body?.draft && result.state === 'counting') dispatch({ type: 'saved',version: result.version,submitted: body.draft as CountDraft });
    if (result.state === 'completed') {
      dispatch({ type: 'load',draft: body?.draft as CountDraft ?? draft,version: result.version });
      setSignature('');
      if (result.revisionId) { router.push(`/contagem/filipetas/${result.revisionId}`); return; }
    }
    const fresh = await refresh();
    if (fresh && fresh.version >= result.version && !body?.draft) {
      dispatch({ type: 'load',draft: fresh.revision?.draft ?? emptyCountDraft(),version: fresh.version });
      setSignature(''); setStep(0);
    }
  });
  useEffect(() => {
    if (!data || data.version <= version || dirty || command.pending || command.busy || (signature && data.version !== version)) return;
    const timer = setTimeout(() => dispatch({ type: 'load',draft: data.revision?.draft ?? emptyCountDraft(),version: data.version }),0);
    return () => clearTimeout(timer);
  },[data,version,dirty,signature,command.pending,command.busy]);
  useCountingLeaveWarning(dirty || !!signature || command.pending !== null);
  const conflict = data !== null && version !== 0 && data.version > version && !command.busy;
  const catchingUp = data !== null && data.version < version;
  const allowedDate = !!data && data.date <= data.today && (data.date === data.today || manager);
  const canEdit = !!data && !data.closed && !data.financiallyFinalized && allowedDate && data.state === 'counting' && !!data.revision?.ownedByMe;
  const legacy = !!data?.revision && data.revision.catalogVersion === 1;
  const legacyPcd = draft.pcdDetails.some(item => !PCD_TYPES.some(type => type === item.description));
  const pcdMismatch = (['pcdChild','pcdAdult'] as const).some(key => draft.pcdDetails.filter(item => item.category === key).reduce((sum,item) => sum+item.quantity,0) !== (draft.counts[key] ?? 0));
  const needsConversion = legacyPcd || pcdMismatch;
  // Editing stays available while a save is in flight; the acknowledged snapshot never replaces newer edits.
  const editBlocked = !canEdit || conflict || catchingUp || !command.ready || step === 2 ||
    !!(command.pending && (!command.pending.body || !command.pending.url.endsWith('/save'))) ||
    (command.busy && !command.pending?.url.endsWith('/save'));
  const total = countingTotals(draft);
  const canSave = canEdit && !conflict && !catchingUp && !needsConversion && online && (!manager || data?.date === data?.today || !!reason.trim());
  useEffect(() => {
    if (!dirty || !canSave || command.blocked || command.failed || error) return;
    const timer = setTimeout(() => { void command.submit(`/api/contagem/veiculos/${id}/save`,{ version,reason,draft }); },700);
    return () => clearTimeout(timer);
  },[dirty,canSave,command,id,version,reason,draft,error]);
  function edit(next: CountDraft) {
    dispatch({ type: 'edit',draft: next }); setValidation('');
    if (signature) { setSignature(''); setValidation('A contagem mudou. Peça uma nova conferência e assinatura ao responsável.'); }
  }
  async function action(action: CountAction) {
    if (!data) return;
    if (action === 'takeover' && !window.confirm('Assumir esta contagem? Você recupera o último rascunho confirmado. Edições que ficaram apenas no outro aparelho não podem ser recuperadas.')) return;
    if (action === 'recount' && !window.confirm('Abrir uma nova contagem do zero? A contagem e a assinatura anteriores ficam preservadas no histórico.')) return;
    await command.submit(`/api/contagem/veiculos/${id}/${action}`,{ version,reason,...(['save','complete'].includes(action) ? { draft } : {}),...(action === 'complete' ? { signature } : {}) });
  }
  function loadCurrent() {
    if (!data || ((dirty || signature) && !window.confirm('Usar a versão salva no servidor? A edição e a assinatura ainda não confirmadas desta tela serão descartadas.'))) return;
    dispatch({ type: 'load',draft: data.revision?.draft ?? emptyCountDraft(),version: data.version });
    setSignature(''); setStep(0); setValidation(''); command.resetFailure();
  }
  function advance() {
    try {
      if (total.total === 0) throw new Error('Conte ao menos uma pessoa antes de avançar.');
      if (countCategories.some(key => draft.counts[key] === null)) throw new Error('Confirme todas as quantidades, inclusive zeros. Use − para confirmar zero nas categorias ainda vazias.');
      normalizeCountDraft(draft,step === 1);
      if (step === 1 && !signature) throw new Error('Peça a assinatura do responsável antes de avançar.');
      setValidation(''); setStep(step === 0 ? 1 : 2); window.scrollTo({ top: 0,behavior: 'instant' });
    } catch (error) { setValidation(error instanceof Error ? error.message : 'Confira os campos.'); }
  }
  const exceptional = data && !data.closed && !data.financiallyFinalized && allowedDate && ((data.state === 'counting' && !data.revision?.ownedByMe && data.revision?.ownerName) || data.state === 'completed' || data.date !== data.today);
  return <div className="space-y-5">
    <a href={`/contagem${data ? `?date=${data.date}` : ''}`} className="inline-flex min-h-11 items-center text-sm underline underline-offset-4">← Voltar aos passeios</a>
    <header className="flex items-start gap-3"><span className="grid h-13 w-13 shrink-0 place-items-center rounded-2xl border border-[#f2b33d] bg-[#fff1cf] text-2xl text-[#8a5a00]" aria-hidden="true">{data?.state === 'completed' ? '✓' : '◷'}</span><div className="min-w-0"><h1 className="text-xl font-bold">{step === 1 ? 'Responsável' : step === 2 ? 'Resumo para conferir' : data ? `${data.type === 'bus' ? 'Ônibus' : 'Van'} ${data.ordinal}` : 'Consultando veículo…'}</h1>{data && <><p className="mt-1 text-sm">{data.clientName}{data.isExtra ? ' · veículo extra' : ''}</p><p className="mt-1 text-xs text-[#6a7c92]">{data.transportName ?? 'Transportador não informado'} · {countStateLabel[data.state]}</p><p className="text-xs text-[#6a7c92]">Prev. {data.plannedPeople ?? 'não informada'} · {data.startedAt ? `começou ${countTime(data.startedAt).slice(0,5)}` : 'ainda não iniciado'}</p></>}</div></header>
    {canEdit && <ol aria-label="Etapas da contagem" className="flex gap-2 text-xs">{['Contagem','Responsável','Prévia'].map((label,index) => <li key={label} aria-current={step === index ? 'step' : undefined} className={`flex-1 rounded-full px-2 py-2 text-center ${step === index ? 'bg-[#133a62] font-semibold text-white' : 'bg-[#e6ecf3] text-[#5c6f86]'}`}>{index+1}. {label}</li>)}</ol>}
    <p role="status" className="text-xs text-[#6a7c92]">{command.busy ? 'Salvando / conferindo no servidor…' : command.pending || command.failed ? 'Não confirmado · seus campos foram preservados' : dirty ? 'Alterações aguardando salvamento' : checkedAt ? `Salvo / consultado às ${countTime(checkedAt)}` : 'Consultando contagem…'}</p>
    {error && <p role="alert" className="rounded-xl border border-[#b84137] bg-[#fff5f3] p-3 text-sm">{error} Preserve a edição e confira a conexão antes de concluir.</p>}
    {!online && <p role="alert" className="rounded-xl border border-[#b84137] bg-[#fff5f3] p-3 text-sm">Sem conexão. Mantenha esta tela aberta; as alterações ficam apenas na memória até a confirmação do servidor.</p>}
    <CountingCommandStatus command={command}/>
    {data?.closed && <p className="rounded-xl bg-[#eaf2fb] p-3 text-sm">Dia encerrado para contagem. Consulte os relatórios para verificar a reabertura.</p>}
    {data?.financiallyFinalized && <p className="rounded-xl bg-[#eaf2fb] p-3 text-sm">Passeio financeiramente finalizado. Alterações exigem revisão financeira autorizada.</p>}
    {data && data.date !== data.today && <p className="text-sm">{data.date > data.today ? 'A contagem abre no dia do passeio.' : manager ? 'Correção de data passada: toda alteração exige motivo.' : 'Esta data está disponível apenas para consulta.'}</p>}
    {conflict && <div role="alert" className="space-y-3 rounded-xl border border-[#b84137] p-3 text-sm"><p>O veículo mudou em outro aparelho. Seus campos foram preservados. Confira a versão atual antes de continuar.</p><button className={countingButton} disabled={command.blocked} onClick={loadCurrent}>Usar versão salva no servidor</button></div>}
    {exceptional && <label className="grid gap-2 text-sm">Motivo para assumir, recontar ou corrigir<input className={countingInput} maxLength={1000} value={reason} disabled={command.blocked} onChange={e => setReason(e.target.value)}/></label>}
    {data && !data.closed && !data.financiallyFinalized && allowedDate && <div className="space-y-3">
      {(data.state === 'waiting' || (data.state === 'counting' && !data.revision?.ownerName)) && <button className={`${countingPrimary} w-full`} disabled={command.blocked || conflict || !version || (data.date !== data.today && !reason.trim())} onClick={() => void action('start')}>Iniciar contagem</button>}
      {data.state === 'counting' && !data.revision?.ownedByMe && data.revision?.ownerName && <><p className="rounded-xl bg-[#fff1cf] p-3 text-sm">{data.revision.ownerName} está contando · {data.draftSubtotal ?? '—'} pessoas até agora (provisório). Assumir recupera somente o rascunho confirmado.</p><button className={`${countingButton} w-full`} disabled={command.blocked || conflict || !reason.trim()} onClick={() => void action('takeover')}>Assumir contagem</button></>}
      {data.state === 'completed' && <><a href={`/contagem/filipetas/${data.lastCompletedRevision}`} className={`${countingPrimary} w-full`}>Ver filipeta concluída</a><button className={`${countingButton} w-full`} disabled={command.blocked || conflict || !reason.trim()} onClick={() => void action('recount')}>Abrir recontagem</button></>}
    </div>}
    {data?.revision && <>
      {step !== 2 && <div className="sticky top-0 z-10 flex justify-between gap-3 rounded-2xl border border-[#d9e3ee] bg-[#f4f7fb]/95 p-4"><div><b className="text-3xl tabular-nums">{total.total}</b><small className="block text-[#6a7c92]">pessoas · {total.participants} participantes</small></div><div className="text-right"><b className="text-2xl tabular-nums">{total.team}</b><small className="block text-[#6a7c92]">professores e acompanhantes</small></div></div>}
      {step === 0 && <fieldset disabled={editBlocked} className="space-y-5">
        <legend className="sr-only">Passageiros por categoria</legend>
        {legacy && <p className="rounded-xl bg-[#fff1cf] p-3 text-sm">Rascunho do catálogo anterior. Quantidades vazias seguem não informadas (—). Confirme-as explicitamente com − para zero ou + para contar.</p>}
        {needsConversion && <div className="space-y-3 rounded-xl border border-[#f2b33d] bg-[#fff1cf] p-3"><p className="text-sm">Antes de salvar, revise os detalhes PCD antigos e escolha os tipos atuais. A quantidade precisa corresponder aos detalhes; os textos originais ficam preservados no histórico.</p>
          {draft.pcdDetails.map((detail,index) => <label key={index} className="grid gap-1 text-sm">{detail.quantity} {detail.category === 'pcdChild' ? 'criança(s)' : 'adulto(s)'} PCD · {detail.description}<select className={countingInput} value={PCD_TYPES.some(type => type === detail.description) ? detail.description : ''} onChange={event => edit({ ...draft,pcdDetails: draft.pcdDetails.map((row,i) => i === index ? { ...row,description: event.target.value } : row) })}><option value="" disabled>Converter para um tipo</option>{PCD_TYPES.map(type => <option key={type}>{type}</option>)}</select></label>)}
          {pcdMismatch && <button type="button" className={countingButton} onClick={() => { if (window.confirm('Ajustar as quantidades PCD para a soma dos detalhes que você revisou?')) edit({ ...draft,counts: { ...draft.counts,pcdChild: draft.pcdDetails.filter(row => row.category === 'pcdChild').reduce((sum,row) => sum+row.quantity,0),pcdAdult: draft.pcdDetails.filter(row => row.category === 'pcdAdult').reduce((sum,row) => sum+row.quantity,0) } }); }}>Confirmar quantidades dos detalhes PCD</button>}
        </div>}
        {['Modalidade 1','Modalidades 2 e 3','Filho de professor','Por idade'].map(group => <section key={group} className="space-y-2"><h2 className="text-xs font-bold uppercase tracking-widest text-[#6a7c92]">{group === 'Modalidades 2 e 3' ? `${group} · PCD` : group === 'Por idade' ? data.groupType === 'group' ? 'Pessoas do grupo' : 'Alunos e demais pessoas' : group}</h2>
          {countCategories.filter(key => COUNT_CATEGORIES[key].group === group).map(key => {
            const pcd = key === 'pcdChild' || key === 'pcdAdult';
            const label = key === 'coordinator' && data.groupType === 'group' ? 'Coordenador do grupo' : COUNT_CATEGORIES[key].label.split(' · ')[0];
            return <div key={key} className="space-y-2"><CountingStepper label={label} hint={COUNT_CATEGORIES[key].label.split(' · ')[1]} value={draft.counts[key]} disabled={editBlocked || (pcd && needsConversion)} onMinus={() => edit(changeCount(draft,key,-1))} onPlus={() => pcd ? setPcdAsk(pcdAsk === key ? null : key) : edit(changeCount(draft,key,1))}/>
              {pcdAsk === key && <div className="space-y-3 rounded-xl border border-[#2f6fb2] bg-white p-3"><p className="text-sm font-semibold">Qual a deficiência?</p><div className="flex flex-wrap gap-2">{PCD_TYPES.map(type => <button key={type} type="button" className="min-h-11 rounded-full border border-[#d9e3ee] bg-[#f4f7fb] px-3 text-sm font-semibold" onClick={() => { edit(changeCount(draft,key,1,type)); setPcdAsk(null); }}>{type}</button>)}</div><button type="button" className="min-h-11 text-sm underline" onClick={() => setPcdAsk(null)}>Cancelar</button></div>}
              {pcd && <div className="flex flex-wrap gap-2">{draft.pcdDetails.filter(detail => detail.category === key).map((detail,index) => <span key={`${detail.description}:${index}`} className="inline-flex items-center gap-1 rounded-full border border-[#d9e3ee] bg-[#eaf2fb] pl-3 text-xs font-semibold">{detail.quantity > 1 ? `${detail.quantity} × ` : ''}{detail.description}<button type="button" className="grid h-11 w-11 place-items-center rounded-full text-lg" aria-label={`Tirar ${label} ${detail.description}`} disabled={editBlocked || needsConversion} onClick={() => edit(changeCount(draft,key,-1,detail.description as PcdType))}>×</button></span>)}</div>}
            </div>;
          })}
        </section>)}
        <label className="grid gap-2 text-sm font-semibold">Observações<textarea className={countingInput} rows={3} maxLength={2000} placeholder="Restrições alimentares e orientações de atendimento" value={draft.notes} onChange={event => edit({ ...draft,notes: event.target.value })}/><small className="font-normal text-[#6a7c92]">Vai na filipeta e no relatório da cozinha. Evite nomes e diagnósticos.</small></label>
      </fieldset>}
      {step === 1 && <fieldset disabled={editBlocked} className="space-y-4"><legend className="mb-3 font-bold">Quem acompanha este veículo?</legend><p className="text-sm text-[#6a7c92]">Peça ao responsável para conferir a contagem e a lista de presença antes de assinar.</p>
        <label className="grid gap-2 text-sm font-semibold">Nome do responsável<input className={countingInput} autoComplete="off" maxLength={160} value={draft.responsible.name} onChange={e => edit({ ...draft,responsible: { ...draft.responsible,name: e.target.value,confirmed: false } })}/></label>
        <label className="grid gap-2 text-sm font-semibold">WhatsApp com DDD<input className={countingInput} type="tel" autoComplete="off" maxLength={40} placeholder="(11) 90000-0000" value={draft.responsible.phone} onChange={e => edit({ ...draft,responsible: { ...draft.responsible,phone: e.target.value,confirmed: false } })}/></label>
        <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" className="h-5 w-5 shrink-0 accent-[#2f6fb2]" checked={draft.responsible.confirmed} onChange={e => edit({ ...draft,responsible: { ...draft.responsible,confirmed: e.target.checked } })}/>Conferi nome e WhatsApp com o responsável.</label>
        <CountingSignature value={signature} disabled={editBlocked} onChange={setSignature}/>
      </fieldset>}
      {step === 2 && <><p className="rounded-xl border border-[#f2b33d] bg-[#fff1cf] p-3 text-sm">Confira o resumo com o responsável. A conclusão registra a contagem e a assinatura. O compartilhamento é manual, na próxima tela.</p><CountingSlipCard slip={{ revisionId: data.revision.id,vehicleId: id,clientName: data.clientName,date: data.date,type: data.type,ordinal: data.ordinal,transportName: data.transportName,groupType: data.groupType,ownerName: data.revision.ownerName,startedAt: data.startedAt,completedAt: null,draft,signatureUrl: signature || null,legacyContext: false }}/></>}
      {validation && <p role="alert" className="rounded-xl bg-[#fff1cf] p-3 text-sm">{validation}</p>}
      {canEdit && <>
        {command.failed && !command.pending && <button className={`${countingButton} w-full`} disabled={command.blocked || !canSave} onClick={() => void action('save')}>Tentar salvar novamente</button>}
        {step === 0 && <button className="min-h-11 text-sm underline" disabled={command.blocked || dirty || !!signature || conflict} onClick={() => void action('release')}>Liberar para outro contador</button>}
        <div className="sticky bottom-0 z-20 -mx-4 space-y-2 bg-[#f4f7fb]/95 px-4 pb-[max(14px,env(safe-area-inset-bottom))] pt-3">
          <button className={`${countingPrimary} min-h-13 w-full`} disabled={total.total === 0 || !canSave || command.blocked || command.failed || !!error || (step === 2 && dirty)} onClick={() => step === 2 ? void action('complete') : advance()}>{step === 0 ? `Avançar · ${total.total} pessoas` : step === 1 ? 'Avançar · conferir filipeta' : dirty ? 'Aguardando salvar rascunho…' : 'Finalizar contagem'}</button>
          {step > 0 && <button className={`${countingButton} w-full`} disabled={command.busy} onClick={() => setStep(step === 2 ? 1 : 0)}>Voltar{step === 2 ? ' e corrigir' : ' à contagem'}</button>}
        </div>
      </>}
    </>}
    {!!data?.history.length && <section className="space-y-3 border-t border-[#d9e3ee] pt-4"><h2 className="text-xs font-bold uppercase tracking-widest text-[#6a7c92]">Histórico de conclusões</h2><ul className="divide-y divide-[#d9e3ee]">{data.history.map(revision => <li key={revision.id} className="py-3 text-sm"><p>{revision.ownerName ?? 'Operador'} · {new Date(revision.completedAt).toLocaleString('pt-BR',{ timeZone: 'America/Sao_Paulo' })}</p>{revision.canReadSignature && <a href={`/contagem/filipetas/${revision.id}`} className="inline-flex min-h-11 items-center underline">Consultar filipeta e assinatura</a>}</li>)}</ul></section>}
  </div>;
}
