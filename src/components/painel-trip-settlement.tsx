'use client';

import Link from 'next/link';
import { Fragment,useCallback,useEffect,useRef,useState } from 'react';
import { CurrencyInput,parseCurrencyInput } from './currency-input';
import { TripDataEditor } from './painel-trip-settlement-data';
import { PainelTripVehicles } from './painel-trip-vehicles';
import { TripSettlementSummary,tripMoney } from './trip-settlement-summary';
import { readStoredCashCommand,submitCashCommand } from '@/lib/cash-command-client';
import { COUNT_CATEGORIES,countCategories } from '@/lib/trip-counting-contract';
import { allocateTripPayments,TRIP_PAYMENT_METHODS,type TripPaymentInput } from '@/lib/trip-settlement-contract';
import type { PublicTripDetail } from '@/lib/trip-settlement-route';
import type { CashSession } from '@/lib/operational-cash-session';

const field = 'min-h-11 w-full rounded-lg border border-[#b9cddd] bg-white px-3 py-2 text-[#123b63] disabled:opacity-60';
const button = 'inline-flex min-h-11 items-center justify-center rounded-lg bg-[#205a7f] px-4 py-2 font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed';
const card = 'space-y-4 rounded-xl border border-[#d4dfeb] bg-white p-4 sm:p-5';
type Action = (action: string,payload: Record<string,unknown>) => Promise<boolean>;
const text = (data: FormData,key: string) => String(data.get(key) ?? '');
const cents = (data: FormData,key: string) => Math.round(parseCurrencyInput(text(data,key))*100);
function Reason({ required = false }: { required?: boolean }) { return <label className="grid gap-1 text-sm font-semibold">Motivo {required ? '' : '(quando exigido)'}<textarea className={field} name="reason" maxLength={1000} required={required} rows={2} /></label>; }
function Form({ action,run,payload,children,label,disabled = false }: { action: string; run: Action; payload: (data: FormData) => Record<string,unknown>; children: React.ReactNode; label: string; disabled?: boolean }) {
  const [revision,setRevision] = useState(0);
  return <form className="space-y-3" onSubmit={async event => { event.preventDefault(); if (disabled) return; const form = event.currentTarget,data = new FormData(form); if (await run(action,{ ...payload(data),reason: text(data,'reason') })) setRevision(value => value+1); }}><fieldset key={revision} disabled={disabled} className="space-y-3">{children}<button className={button} type="submit">{label}</button></fieldset></form>;
}
function CashSelect({ sessions }: { sessions: CashSession[] }) {
  return <label className="grid gap-1 text-sm font-semibold">Caixa de passeios (para dinheiro)<select className={field} name="periodId" defaultValue=""><option value="">Selecione se houver dinheiro</option>{sessions.filter(s => s.type === 'trips' && !s.closedAt).map(s => <option key={s.id} value={s.id}>{s.locationName} · #{s.id}</option>)}</select></label>;
}
function DateField({ today }: { today: string }) { return <label className="grid gap-1 text-sm font-semibold">Data do recebimento ou devolução<input className={field} name="paymentDate" type="date" required defaultValue={today} /></label>; }
function Reference({ required = true }: { required?: boolean }) { return <label className="grid gap-1 text-sm font-semibold">Referência do comprovante<input className={field} name="reference" required={required} maxLength={200} /></label>; }
const period = (data: FormData) => text(data,'periodId') ? Number(data.get('periodId')) : null;
function ReceiveForm({ source,sessions,run,disabled }: { source: PublicTripDetail['source']; sessions: CashSession[]; run: Action; disabled: boolean }) {
  type Row = TripPaymentInput & { id: number; automatic: boolean };
  const empty = (id: number): Row => ({ id,method: 'pix',amountCents: 0,status: 'confirmed',reference: '',automatic: false });
  const [rows,setRows] = useState<Row[]>([empty(0)]),[next,setNext] = useState(1);
  const payments = rows.map((row,index) => ({ ...row,amountCents: row.automatic && index === rows.length-1 ? Math.max(0,(source.remainingCents ?? 0)-rows.slice(0,-1).reduce((sum,p) => sum+p.amountCents,0)) : row.amountCents }));
  function update(id: number,patch: Partial<Row>) { setRows(values => values.map(row => row.id === id ? { ...row,...patch } : row)); }
  let preview: ReturnType<typeof allocateTripPayments> | null = null;
  try { preview = allocateTripPayments(source.remainingCents ?? 0,payments.map(({ method,amountCents,status,reference }) => ({ method,amountCents,status,reference }))); } catch { /* The server validates the submitted amounts and proof. */ }
  const receive: Action = async (action,payload) => { const saved = await run(action,payload); if (saved) { setRows([empty(next)]); setNext(next+1); } return saved; };
  return <Form action="receive" run={receive} disabled={disabled} label="Registrar recebimento" payload={data => ({ paymentDate: text(data,'paymentDate'),periodId: period(data),payments: payments.map(({ method,amountCents,status,reference }) => ({ method,amountCents,status,reference })) })}>
    <p className="text-sm">Você pode receber uma parte agora e completar depois. Ao adicionar uma forma, o saldo restante é preenchido automaticamente na última linha. O excedente só pode ser devolvido em dinheiro.</p>
    {payments.map((row,index) => <div className="grid gap-3 rounded-lg border border-[#d4dfeb] p-3 sm:grid-cols-2" key={row.id}>
      <label className="grid gap-1 text-sm font-semibold">Forma<select className={field} name={`method-${row.id}`} value={row.method} onChange={event => update(row.id,{ method: event.target.value as Row['method'],...(event.target.value !== 'bolet' ? { status: 'confirmed' as const } : {}) })}>{Object.entries(TRIP_PAYMENT_METHODS).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="grid gap-1 text-sm font-semibold">Valor entregue<CurrencyInput key={row.automatic ? `${row.id}:${row.amountCents}` : row.id} className={field} name={`amount-${row.id}`} defaultValue={String(row.amountCents)} disabled={row.automatic} onValueChange={value => update(row.id,{ amountCents: Math.round(parseCurrencyInput(value)*100) })} required /></label>
      {index === payments.length-1 && payments.length > 1 && <label className="flex min-h-11 items-center gap-3 sm:col-span-2"><input type="checkbox" checked={row.automatic} onChange={event => update(row.id,{ automatic: event.target.checked,amountCents: row.amountCents })} /> Usar saldo restante nesta forma</label>}
      <label className="grid gap-1 text-sm font-semibold">Situação<select className={field} name={`status-${row.id}`} value={row.status} onChange={event => update(row.id,{ status: event.target.value as Row['status'] })}><option value="confirmed">Recebido e confirmado</option>{row.method === 'bolet' && <option value="pending">Boleto ainda não recebido</option>}</select></label>
      <label className="grid gap-1 text-sm font-semibold">Comprovante {row.method !== 'dinhe' && row.status === 'confirmed' ? '(obrigatório)' : '(opcional)'}<input className={field} name={`reference-${row.id}`} maxLength={200} required={row.method !== 'dinhe' && row.status === 'confirmed'} value={row.reference} onChange={event => update(row.id,{ reference: event.target.value })} /></label>
      {rows.length > 1 && <button type="button" className="min-h-11 text-left underline" onClick={() => setRows(payments.filter(value => value.id !== row.id))}>Remover esta forma</button>}
    </div>)}
    <button type="button" className="min-h-11 underline disabled:opacity-50" disabled={rows.length >= 20} onClick={() => { setRows([...payments.map(row => ({ ...row,automatic: false })),{ ...empty(next),automatic: true }]); setNext(next+1); }}>Adicionar outra forma de pagamento</button>
    {preview && <p role="status" className="rounded-lg border border-[#b9cddd] bg-[#f3f7fb] p-3">Após este registro: {preview.remainingCents > 0 ? `falta receber ${tripMoney(preview.remainingCents)}` : 'pagamento confirmado completo'}{preview.changeCents > 0 ? ` · Devolver troco: ${tripMoney(preview.changeCents)}` : ''}.</p>}
    <div className="grid gap-3 sm:grid-cols-2"><DateField today={source.today} /><CashSelect sessions={sessions} /></div><Reason />
  </Form>;
}
export function Participants({ source,run,locked }: { source: PublicTripDetail['source']; run: Action; locked: boolean }) {
  const [search,setSearch] = useState('');
  const rows = source.participants.filter(p => participantMatches(p,search));
  return <details className={card}><summary className="min-h-11 cursor-pointer text-lg font-bold">Lista de presença · pagos no site · {source.participants.length}</summary>
    <label className="grid gap-1 font-semibold">Buscar nome, ingresso ou compra<input className={field} value={search} onChange={event => setSearch(event.target.value)} type="search" /></label>
    <p role="status" className="text-sm">{rows.length} participante(s) encontrado(s). Ausências e devoluções são conferidas no fechamento abaixo.</p>
    <div className="max-h-[36rem] overflow-auto"><table className="w-full text-left text-sm"><thead className="bg-[#eaf2fb]"><tr>{['Nome','Tipo','Compra','Valor pago','Presença','Conferência'].map(label => <th className="p-3" key={label} scope="col">{label}</th>)}</tr></thead><tbody>{rows.map(p => <tr key={p.voucherId} className="border-b border-[#d4dfeb] align-top">
      <td className="p-3"><span className={p.refundRequested ? 'line-through' : ''}>{p.name}</span><small className="block">Ingresso #{p.voucherId}</small></td><td className="p-3">{p.category ? COUNT_CATEGORIES[p.category].label : 'A conferir'}</td><td className="p-3"><Link className="inline-flex min-h-11 items-center underline" href={`/painel/compras/${p.purchaseId}`}>Compra #{p.purchaseId}</Link></td><td className="whitespace-nowrap p-3 tabular-nums">{tripMoney(p.paidCents)}</td><td className="p-3">{p.refundRequested ? 'Não veio · reembolso' : 'Presente'}{p.held ? ' · Pagamento retido' : ''}{p.invalidated ? ' · Ingresso invalidado' : ''}</td>
      <td className="p-3"><details><summary className="min-h-11 cursor-pointer py-3 underline">Conferir categoria</summary><Form action="participant" run={run} disabled={locked || Boolean(source.receiptId)} label="Salvar conferência do participante" payload={data => ({ voucherId: p.voucherId,category: text(data,'category'),refundRequested: p.refundRequested })}><label className="grid gap-1 font-semibold">Categoria<select className={field} name="category" defaultValue={p.category ?? ''} required><option value="" disabled>Selecione após conferir</option>{countCategories.map(category => <option key={category} value={category}>{COUNT_CATEGORIES[category].label}</option>)}</select></label><Reason required /></Form></details></td>
    </tr>)}</tbody></table>{rows.length === 0 && <p className="py-4">Nenhum participante encontrado.</p>}</div>
  </details>;
}
function participantMatches(p: PublicTripDetail['source']['participants'][number],search: string) {
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  return normalize(`${p.name} ${p.voucherId} ${p.purchaseId}`).includes(normalize(search.trim()));
}
export function TripRefunds({ source,run,sessions,locked }: { source: PublicTripDetail['source']; run: Action; sessions: CashSession[]; locked: boolean }) {
  const [search,setSearch] = useState(''),[selected,setSelected] = useState<number | null>(null);
  const participant = source.participants.find(p => p.voucherId === selected);
  const absent = source.participants.filter(p => p.refundRequested);
  const matches = search.trim() ? source.participants.filter(p => !p.refundRequested && participantMatches(p,search)) : [];
  return <section className={card} aria-label="Pessoas do site que precisam de reembolso"><h3 className="text-lg font-bold">Pessoas do site que precisam de reembolso</h3>
    <p>Selecione o ingresso correto, inclusive quando os nomes forem iguais. Marcar ausência não devolve dinheiro ao comprador.</p>
    <div className="relative"><label className="grid gap-1 font-semibold">Buscar pessoa para reembolso<input className={field} type="search" value={search} disabled={locked || !!source.receiptId} onChange={event => { setSearch(event.target.value); setSelected(null); }} onKeyDown={event => { if (event.key === 'Escape') setSearch(''); }} /></label>
      {search.trim() && <div className="absolute inset-x-0 top-full z-10 mt-1 max-h-72 overflow-auto rounded-lg border border-[#b9cddd] bg-white p-2 shadow-lg"><ul aria-label="Pessoas encontradas">{matches.map(p => <li key={p.voucherId}><button className="min-h-11 w-full rounded-lg p-3 text-left hover:bg-[#eaf2fb] focus-visible:outline-2" type="button" disabled={locked} onClick={() => { setSelected(p.voucherId); setSearch(''); }}><strong className="block">{p.name}</strong><span>{p.category ? COUNT_CATEGORIES[p.category].label : 'Categoria a conferir'} · Compra #{p.purchaseId} · Ingresso #{p.voucherId} · {tripMoney(p.paidCents)}</span></button></li>)}</ul>{matches.length === 0 && <p className="p-3">Nenhuma pessoa encontrada.</p>}</div>}
    </div>
    {participant && <div className="space-y-3 border-y border-[#d4dfeb] py-4"><p className="font-semibold">{participant.refundRequested ? 'Tirar da lista de reembolso' : 'Marcar ausência'}: {participant.name} · Compra #{participant.purchaseId} · {tripMoney(participant.paidCents)}</p><Form key={`${participant.voucherId}:${participant.refundRequested}`} action="participant" run={async (action,payload) => { const saved = await run(action,payload); if (saved) setSelected(null); return saved; }} disabled={locked || !!source.receiptId || !!participant.refundPaidAt} label={participant.refundRequested ? 'Confirmar retirada da lista' : 'Confirmar ausência e incluir na lista'} payload={data => ({ voucherId: participant.voucherId,category: participant.category ?? text(data,'category'),refundRequested: !participant.refundRequested })}>{!participant.category && <label className="grid gap-1 font-semibold">Categoria<select className={field} name="category" required defaultValue=""><option value="" disabled>Selecione após conferir</option>{countCategories.map(category => <option key={category} value={category}>{COUNT_CATEGORIES[category].label}</option>)}</select></label>}<Reason required /></Form><button className="min-h-11 underline" type="button" onClick={() => setSelected(null)}>Cancelar conferência</button></div>}
    <p className="text-lg font-bold">Total a reembolsar: {tripMoney(absent.filter(p => !p.refundPaidAt).reduce((sum,p) => sum+p.paidCents,0))}</p>
    <div className="overflow-auto"><table className="w-full text-left text-sm"><thead className="bg-[#eaf2fb]"><tr>{['Nome','Compra','Valor pago','Devolução','Ação'].map(label => <th className="p-3" scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{absent.map(p => <tr key={p.voucherId} className="border-b border-[#d4dfeb] align-top"><td className="p-3">{p.name}<small className="block">Ingresso #{p.voucherId}</small></td><td className="p-3"><Link className="inline-flex min-h-11 items-center underline" href={`/painel/compras/${p.purchaseId}`}>Compra #{p.purchaseId}</Link></td><td className="whitespace-nowrap p-3 tabular-nums">{tripMoney(p.paidCents)}</td><td className="p-3">{p.refundPaidAt ? 'Reembolso registrado' : <details><summary className="min-h-11 cursor-pointer py-3 underline">Registrar devolução realizada</summary><p>Este registro não solicita estorno à Cielo. Confirme a devolução antes de salvar.</p><Form action="refund_online" run={run} disabled={locked} label="Confirmar devolução realizada" payload={data => ({ voucherId: p.voucherId,method: text(data,'method'),paymentDate: text(data,'paymentDate'),periodId: period(data),reference: text(data,'reference') })}><label className="grid gap-1 font-semibold">Forma da devolução<select className={field} name="method">{Object.entries(TRIP_PAYMENT_METHODS).filter(([value]) => value !== 'bolet').map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label><DateField today={source.today} /><CashSelect sessions={sessions} /><Reference /><Reason required /></Form></details>}</td><td className="p-3"><button type="button" className="min-h-11 underline disabled:opacity-50" disabled={locked || !!source.receiptId || !!p.refundPaidAt} onClick={() => setSelected(p.voucherId)}>Tirar <span className="sr-only">{p.name} da lista de reembolso</span></button></td></tr>)}</tbody></table>{absent.length === 0 && <p className="py-4">Nenhuma pessoa marcada para reembolso.</p>}</div>
  </section>;
}
export function PainelTripSettlement({ agendaId,clientId,actorCpf,isManager,canCount = false }: { canCount?: boolean; agendaId: number; clientId: number; actorCpf: string; isManager: boolean }) {
  const url = `/api/painel/passeios/${agendaId}/${clientId}`,storageKey = `trip-finance:${actorCpf}:${agendaId}:${clientId}`;
  const [detail,setDetail] = useState<PublicTripDetail | null>(null),[sessions,setSessions] = useState<CashSession[]>([]);
  const [ready,setReady] = useState(false),[busy,setBusy] = useState(false),[pending,setPending] = useState<Record<string,unknown> | null>(null),[message,setMessage] = useState<string | null>(null),[failed,setFailed] = useState(false);
  const [preview,setPreview] = useState(false),[loadedAt,setLoadedAt] = useState(''),[receiveRevision,setReceiveRevision] = useState(0);
  const requests = useRef(0);
  const [draftSource,setDraftSource] = useState<PublicTripDetail['source'] | null>(null);
  const reload = useCallback(async () => {
    const sequence = ++requests.current;
    let response: Response,body;
    try { response = await fetch(url,{ cache: 'no-store' }); body = await response.json(); }
    catch (error) { if (sequence === requests.current) throw error; return; }
    if (sequence !== requests.current) return;
    if (!response.ok || !body.ok) throw new Error(body.error?.message ?? 'Não foi possível consultar o passeio.');
    const data = body.data as PublicTripDetail; setDetail(data); setLoadedAt(new Date().toLocaleTimeString('pt-BR')); setFailed(false);
    let cash: Response,cashBody;
    try { cash = await fetch(`/api/painel/caixas?date=${data.source.today}`,{ cache: 'no-store' }); cashBody = await cash.json(); }
    catch { if (sequence === requests.current) { setSessions([]); setMessage('Passeio atualizado. Não foi possível consultar os caixas; confira-os antes de receber dinheiro.'); } return; }
    if (sequence !== requests.current) return;
    if (cash.ok && cashBody.ok) setSessions(cashBody.data); else { setSessions([]); setMessage('Passeio atualizado. Não foi possível consultar os caixas; confira-os antes de receber dinheiro.'); }
  },[url]);
  useEffect(() => {
    const sequence = requests;
    let active = true;
    Promise.resolve().then(async () => {
      try { const saved = readStoredCashCommand(storageKey); if (active) { setPending(saved?.payload ?? null); setReady(true); } }
      catch { if (active) setMessage('Não foi possível recuperar a operação anterior. Peça conferência ao responsável antes de continuar.'); }
      try { if (active) await reload(); } catch (error) { if (active) { setMessage(error instanceof Error ? error.message : 'Falha ao consultar o passeio.'); setFailed(true); } }
    });
    return () => { active = false; sequence.current++; };
  },[reload,storageKey]);
  useEffect(() => {
    if (busy || pending || preview) return;
    let active = true,refreshing = false;
    const refresh = async () => {
      if (document.visibilityState !== 'visible' || refreshing) return;
      refreshing = true;
      try { await reload(); }
      catch { if (active) { setFailed(true); setMessage('Atualização automática indisponível. Seus campos foram preservados; confira os dados atuais antes de continuar.'); } }
      finally { refreshing = false; }
    };
    const interval = setInterval(() => void refresh(),5000);
    document.addEventListener('visibilitychange',refresh);
    return () => { active = false; clearInterval(interval); document.removeEventListener('visibilitychange',refresh); };
  },[reload,busy,pending,preview]);
  const run: Action = async (action,payload) => {
    if (busy || !ready || !detail || pending) return false;
    requests.current++; setBusy(true); setMessage(null);
    const result = await submitCashCommand({ storageKey,url,payload: { action,...payload,version: (draftSource ?? detail.source).financialVersion,fingerprint: (draftSource ?? detail.source).fingerprint } });
    if (!result.ok) {
      setMessage(result.message);
      try { setPending(readStoredCashCommand(storageKey)?.payload ?? null); } catch { setReady(false); }
      setBusy(false); return false;
    }
    setDraftSource(null); setReceiveRevision(value => value+1); setPending(null); setPreview(false); setMessage('Operação confirmada. Os formulários foram atualizados com os dados salvos.');
    try { await reload(); } catch { setFailed(true); setMessage('Operação confirmada. Falta atualizar os dados abaixo; use Conferir dados atuais antes de continuar.'); }
    setBusy(false); return true;
  };
  async function retry() {
    if (busy) return; setBusy(true);
    const result = await submitCashCommand({ storageKey,url });
    setMessage(result.ok ? 'Operação confirmada.' : result.message);
    try { setPending(readStoredCashCommand(storageKey)?.payload ?? null); } catch { setReady(false); }
    if (result.ok) { setDraftSource(null); setReceiveRevision(value => value+1); try { await reload(); } catch { setFailed(true); setMessage('Operação confirmada. Confira os dados atuais para continuar.'); } }
    setBusy(false);
  }
  const source = detail?.source,locked = busy || !ready || !!pending || failed || !!source?.closed || !!source?.cancelled;
  return <section className="space-y-5 text-[#123b63]" aria-labelledby="trip-financial-title" onChangeCapture={event => { if ((event.target as HTMLElement).closest('form') && detail && !draftSource) setDraftSource(detail.source); }}>
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-bold">{source?.clientName ?? 'Passeio'}</h2><p className="text-sm">{loadedAt ? `Atualização automática · dados conferidos às ${loadedAt}` : 'Consultando contagem e recebimentos…'}</p></div><button className="min-h-11 px-3 underline disabled:opacity-50" type="button" disabled={busy || !!pending} onClick={async () => { setBusy(true); try { await reload(); setDraftSource(null); setReceiveRevision(value => value+1); setPreview(false); setMessage('Dados conferidos. Os campos não salvos foram substituídos pelos valores atuais.'); } catch (error) { setFailed(true); setMessage(error instanceof Error ? error.message : 'Falha ao atualizar.'); } finally { setBusy(false); } }}>Conferir dados atuais</button></header>
    {message && <p role="status" className="rounded-lg border border-[#b9cddd] bg-[#f3f7fb] p-3">{message}</p>}
    {pending && <div role="alert" className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950"><p>Há uma tentativa sem confirmação. Seus dados enviados foram preservados; confira o resultado antes de iniciar outra operação.</p><button type="button" className={button} disabled={busy} onClick={() => void retry()}>Conferir tentativa anterior</button></div>}
    {source && detail && <Fragment key={`${draftSource?.fingerprint ?? source.fingerprint}:${receiveRevision}`}>
      {source.closed && <p role="status">Dia finalizado. Alterações exigem revisão gerencial do fechamento diário.</p>}
      {source.cancelled && <p role="alert">Passeio cancelado ou inativo.</p>}

      <details className={card}><summary className="min-h-11 cursor-pointer font-semibold">Dados do passeio</summary><p>Representante: {source.representative ?? 'Não informado'}</p><p>Contato: {source.contact ?? 'Não informado'} · {source.phone ?? 'Telefone não informado'}</p><p>Transportador: {source.transportName ?? 'Não informado'} · {source.transportPhone ?? 'Telefone não informado'}</p><p>Embarque: {source.boardingTime ?? 'Não informado'}</p><p>Observações: {source.observations ?? 'Nenhuma'}</p><p>Preço no site (somente leitura): adulto {source.sitePrices.adultPriceCents === null ? 'A conferir' : tripMoney(source.sitePrices.adultPriceCents)} · criança {source.sitePrices.childPriceCents === null ? 'A conferir' : tripMoney(source.sitePrices.childPriceCents)}</p><Link className="inline-flex min-h-11 items-center underline" href={`/painel/agenda/${source.date}/dia-seguinte`}>Programação e contatos</Link>{isManager && <TripDataEditor source={source} disabled={locked || !!source.receiptId} onChanged={async () => { await reload(); setDraftSource(null); setReceiveRevision(value => value+1); }} />}      {isManager && <div><Form action="planning" run={run} disabled={locked || !!source.receiptId} label="Salvar previsão" payload={data => ({ plannedPeople: text(data,'plannedPeople') === '' ? null : Number(data.get('plannedPeople')),vehicles: source.vehicles.map(v => ({ id: v.id,plannedPeople: v.plannedPeople })) })}><p>Deixe em branco quando ainda não houver previsão. A contagem realizada é preservada.</p><label className="grid gap-1 font-semibold">Previstos no passeio<input name="plannedPeople" className={field} type="number" min={0} max={100000} defaultValue={source.plannedPeople ?? ''} /></label><Reason /></Form></div>}</details>
      <PainelTripVehicles source={source} actorCpf={actorCpf} canCount={canCount} disabled={locked} onChanged={reload} run={isManager ? run : undefined} />

      <fieldset disabled={busy || !!pending || !ready} className="min-w-0"><Participants source={source} run={run} locked={locked} /></fieldset>
      <h2 id="trip-financial-title" className="text-2xl font-bold">Fechamento do passeio</h2>
      {isManager && <section className={card}><h3 className="text-lg font-bold">Preços e cortesias do passeio</h3><p className="text-sm">A alteração afeta a cobrança da escola. Os valores já pagos no site são preservados.</p><Form action="configure" run={run} disabled={locked || !!source.receiptId} label="Salvar preços e cortesias" payload={data => ({ configuration: { adultPriceCents: cents(data,'adultPrice'),childPriceCents: cents(data,'childPrice'),adultCourtesies: Number(data.get('adultCourtesies')),childCourtesies: Number(data.get('childCourtesies')) } })}>{(source.configuration.adultPriceCents === null || source.configuration.childPriceCents === null) && <label className="flex min-h-11 items-center gap-3"><input type="checkbox" required /> Conferi os dois preços, inclusive eventuais valores zero.</label>}<div className="grid gap-3 sm:grid-cols-2">{(['adult','child'] as const).map(kind => <div key={kind} className="space-y-3"><label className="grid gap-1 font-semibold">Preço {kind === 'adult' ? 'adulto' : 'criança'}<CurrencyInput className={field} name={`${kind}Price`} defaultValue={source.configuration[`${kind}PriceCents`]?.toString() ?? ''} required /></label><label className="grid gap-1 font-semibold">Cortesias {kind === 'adult' ? 'adultos' : 'crianças'}<input className={field} type="number" name={`${kind}Courtesies`} min={0} max={100000} required defaultValue={source.configuration[`${kind}Courtesies`]} /></label></div>)}</div><Reason /></Form></section>}
      <div className={card}><TripSettlementSummary source={detail.receipt?.snapshot ?? source} />{detail.receipt && <p className="font-semibold">Recibo #{detail.receipt.number} finalizado. Os valores acima são os registrados no recibo original.</p>}</div>
      <fieldset disabled={busy || !!pending || !ready} className="min-w-0"><TripRefunds source={source} sessions={sessions} run={run} locked={locked} /></fieldset>
      <section className={card}><h3 className="text-lg font-bold">Recebimentos da escola</h3><div className="space-y-3">{source.payments.length === 0 && <p>Nenhum recebimento registrado.</p>}{source.payments.map(p => <details key={p.id} className="rounded-lg border border-[#d4dfeb] p-3"><summary className="min-h-11 cursor-pointer font-semibold">#{p.id} · {TRIP_PAYMENT_METHODS[p.method]} · {tripMoney(p.amountCents)} · {p.reversed ? 'Devolvido' : p.status === 'confirmed' ? 'Recebido' : p.status === 'pending' ? 'Pendente' : 'Cancelado'}</summary><p>Data: {p.paymentDate.split('-').reverse().join('/')} · Comprovante: {p.reference || 'Não informado'}{p.periodId ? ` · Caixa #${p.periodId}` : ''}</p>{p.changeCents > 0 && <p>Entregue: {tripMoney(p.tenderedCents)} · Troco: {tripMoney(p.changeCents)}</p>}
        {p.status === 'pending' && <div className="mt-4 grid gap-5 md:grid-cols-2"><Form action="confirm_payment" run={run} disabled={locked || !!source.receiptId} label="Confirmar boleto recebido" payload={data => ({ paymentId: p.id,paymentDate: text(data,'paymentDate'),reference: text(data,'reference') })}><DateField today={source.today} /><Reference /><Reason /></Form><Form action="cancel_pending" run={run} disabled={locked || !!source.receiptId} label="Cancelar boleto pendente" payload={() => ({ paymentId: p.id })}><Reason required /></Form></div>}
        {isManager && p.status === 'confirmed' && !p.reversed && <details className="mt-3"><summary className="min-h-11 cursor-pointer py-3">Registrar devolução deste recebimento</summary><p className="mb-3">Registre somente após devolver {tripMoney(p.amountCents)} ao pagador. Esta ação não chama o gateway.</p><Form action="reverse_payment" run={run} disabled={locked || !!source.receiptId} label="Confirmar recebimento devolvido" payload={data => ({ paymentId: p.id,paymentDate: text(data,'paymentDate'),periodId: p.method === 'dinhe' ? period(data) : null,reference: text(data,'reference') })}><DateField today={source.today} />{p.method === 'dinhe' && <CashSelect sessions={sessions} />}<Reference /><Reason required /></Form></details>}
      </details>)}</div><ReceiveForm key={receiveRevision} source={source} sessions={sessions} run={run} disabled={locked || !!source.receiptId || source.remainingCents === null || source.remainingCents <= 0} /></section>
      <section className={card}><h3 className="text-lg font-bold">Recibo em duas vias</h3>
        {detail.history.map(receipt => <p key={receipt.id}><a className="inline-flex min-h-11 items-center underline" href={`/api/painel/recibos/${receipt.id}`} target="_blank" rel="noreferrer">Recibo #{receipt.number} · PDF em duas vias</a>{receipt.revised ? ' · Revisado, original preservado' : ''}</p>)}
        {!source.receiptId && <><p>A finalização exige o recebimento integral e a conferência dos dados. O recibo preserva os valores e a contagem desta revisão.</p><button type="button" className={button} disabled={locked || !source.calculation} onClick={() => { requests.current++; setPreview(value => !value); }}>{preview ? 'Ocultar prévia' : 'Conferir prévia do recibo'}</button>{preview && <div className="space-y-4 border-t border-[#d4dfeb] pt-4">{['Via da escola','Via do Rincão'].map(copy => <div className="space-y-3 rounded-lg border border-[#b9cddd] p-4" key={copy}><h4 className="font-bold">Prévia · {copy}</h4><p>{source.clientName} · {source.date.split('-').reverse().join('/')}</p><p>Representante: {source.representative ?? 'Não informado'} · Veículos: {source.vehicles.length}</p><TripSettlementSummary source={source} /><ul>{source.payments.filter(p => p.status === 'confirmed' && !p.reversed).map(p => <li key={p.id}>{p.paymentDate.split('-').reverse().join('/')} · {TRIP_PAYMENT_METHODS[p.method]} · {tripMoney(p.amountCents)} · {p.reference || 'Dinheiro'}</li>)}</ul><p className="mt-5 border-t border-[#b9cddd] pt-2">{copy === 'Via do Rincão' ? 'Assinatura do responsável da escola' : 'Assinatura do Rincão'}</p></div>)}{isManager ? <Form action="finalize" run={run} label="Confirmar finalização e emitir recibo" disabled={locked || source.remainingCents !== 0 || source.pendingPaymentCents !== 0 || !source.calculation} payload={data => ({ acknowledgeWarnings: data.has('acknowledgeWarnings') })}>{source.warnings.length > 0 && <label className="flex min-h-11 items-center gap-3"><input type="checkbox" name="acknowledgeWarnings" required /> Conferi os avisos e autorizo a exceção abaixo.</label>}<Reason required={source.warnings.length > 0} /></Form> : <p>Um gerente deve confirmar a finalização.</p>}</div>}</>}
        {source.receiptId && isManager && <Form action="reopen" run={run} disabled={locked} label="Reabrir passeio para revisão" payload={() => ({})}><p>O recibo anterior será preservado. Uma nova finalização emitirá outro número.</p><Reason required /></Form>}
      </section>
    </Fragment>}
  </section>;
}
