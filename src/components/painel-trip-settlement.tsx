'use client';

import Link from 'next/link';
import { useCallback,useEffect,useState } from 'react';
import { CurrencyInput,parseCurrencyInput } from './currency-input';
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
function Participants({ source,run,sessions,locked }: { source: PublicTripDetail['source']; run: Action; sessions: CashSession[]; locked: boolean }) {
  const [search,setSearch] = useState('');
  const needle = search.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const rows = source.participants.filter(p => `${p.name} ${p.voucherId} ${p.purchaseId}`.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(needle));
  return <section className={card}><h3 className="text-lg font-bold">Pagos no site · {source.participants.length}</h3><p className="text-sm">Confira o número do ingresso ao selecionar ausentes, inclusive quando os nomes forem iguais. A marcação calcula a pendência; a devolução deve ser feita e comprovada separadamente.</p>
    <label className="grid gap-1 font-semibold">Buscar nome, ingresso ou compra<input className={field} value={search} onChange={event => setSearch(event.target.value)} type="search" /></label>
    <p role="status" className="text-sm">{rows.length} participante(s) encontrado(s).</p>
    <div className="max-h-[36rem] space-y-2 overflow-y-auto">{rows.map(p => <details key={p.voucherId} className="rounded-lg border border-[#d4dfeb] p-3">
      <summary className="min-h-11 cursor-pointer break-words font-semibold"><span className={p.refundRequested ? "line-through" : ""}>{p.name}</span> · Ingresso #{p.voucherId} · {tripMoney(p.paidCents)}<span className="block text-sm font-normal">{p.category ? COUNT_CATEGORIES[p.category].label : 'Categoria a conferir'} · {p.refundPaidAt ? 'Reembolso registrado' : p.refundRequested ? 'Reembolso pendente' : 'Presente'}{p.held ? ' · Pagamento retido' : ''}</span></summary>
      <p className="my-3 text-sm"><Link className="underline" href={`/painel/compras/${p.purchaseId}`}>Compra #{p.purchaseId}</Link>{p.invalidated ? ' · Ingresso invalidado' : ''}</p>
      <Form action="participant" run={run} disabled={locked || Boolean(source.receiptId)} label="Salvar conferência do participante" payload={data => ({ voucherId: p.voucherId,category: text(data,'category'),refundRequested: data.has('refundRequested') })}>
        <label className="grid gap-1 text-sm font-semibold">Categoria<select className={field} name="category" defaultValue={p.category ?? ''} required><option value="" disabled>Selecione após conferir</option>{countCategories.map(category => <option key={category} value={category}>{COUNT_CATEGORIES[category].label}</option>)}</select></label>
        <label className="flex min-h-11 items-center gap-3"><input name="refundRequested" type="checkbox" defaultChecked={p.refundRequested} /> Ausente: marcar para reembolso</label><Reason required />
      </Form>
      {p.refundRequested && !p.refundPaidAt && <div className="mt-4 border-t border-[#d4dfeb] pt-4"><h4 className="mb-3 font-bold">Registrar devolução já realizada · {tripMoney(p.paidCents)}</h4><p className="mb-3 text-sm">Este registro não solicita estorno à Cielo. Confirme a devolução antes de salvar.</p><Form action="refund_online" run={run} disabled={locked} label="Confirmar devolução realizada" payload={data => ({ voucherId: p.voucherId,method: text(data,'method'),paymentDate: text(data,'paymentDate'),periodId: period(data),reference: text(data,'reference') })}>
        <label className="grid gap-1 font-semibold">Forma da devolução<select className={field} name="method">{Object.entries(TRIP_PAYMENT_METHODS).filter(([value]) => value !== 'bolet').map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label><DateField today={source.today} /><CashSelect sessions={sessions} /><Reference /><Reason required />
      </Form></div>}
    </details>)}</div>
  </section>;
}
export function PainelTripSettlement({ agendaId,clientId,actorCpf,isManager,canCount = false }: { canCount?: boolean; agendaId: number; clientId: number; actorCpf: string; isManager: boolean }) {
  const url = `/api/painel/passeios/${agendaId}/${clientId}`,storageKey = `trip-finance:${actorCpf}:${agendaId}:${clientId}`;
  const [detail,setDetail] = useState<PublicTripDetail | null>(null),[sessions,setSessions] = useState<CashSession[]>([]);
  const [ready,setReady] = useState(false),[busy,setBusy] = useState(false),[pending,setPending] = useState<Record<string,unknown> | null>(null),[message,setMessage] = useState<string | null>(null),[failed,setFailed] = useState(false);
  const [preview,setPreview] = useState(false),[loadedAt,setLoadedAt] = useState(''),[receiveRevision,setReceiveRevision] = useState(0);
  const reload = useCallback(async () => {
    const response = await fetch(url,{ cache: 'no-store' }),body = await response.json();
    if (!response.ok || !body.ok) throw new Error(body.error?.message ?? 'Não foi possível consultar o passeio.');
    const data = body.data as PublicTripDetail; setDetail(data); setLoadedAt(new Date().toLocaleTimeString('pt-BR')); setFailed(false);
    const cash = await fetch(`/api/painel/caixas?date=${data.source.today}`,{ cache: 'no-store' });
    const cashBody = await cash.json();
    if (cash.ok && cashBody.ok) setSessions(cashBody.data); else { setSessions([]); setMessage('Passeio atualizado. Não foi possível consultar os caixas; confira-os antes de receber dinheiro.'); }
  },[url]);
  useEffect(() => {
    let active = true;
    Promise.resolve().then(async () => {
      try { const saved = readStoredCashCommand(storageKey); if (active) { setPending(saved?.payload ?? null); setReady(true); } }
      catch { if (active) setMessage('Não foi possível recuperar a operação anterior. Peça conferência ao responsável antes de continuar.'); }
      try { if (active) await reload(); } catch (error) { if (active) { setMessage(error instanceof Error ? error.message : 'Falha ao consultar o passeio.'); setFailed(true); } }
    });
    return () => { active = false; };
  },[reload,storageKey]);
  const run: Action = async (action,payload) => {
    if (busy || !ready || !detail || pending) return false;
    setBusy(true); setMessage(null);
    const result = await submitCashCommand({ storageKey,url,payload: { action,...payload,version: detail.source.financialVersion,fingerprint: detail.source.fingerprint } });
    if (!result.ok) {
      setMessage(result.message);
      try { setPending(readStoredCashCommand(storageKey)?.payload ?? null); } catch { setReady(false); }
      setBusy(false); return false;
    }
    setPending(null); setPreview(false); setMessage('Operação confirmada.');
    try { await reload(); } catch { setFailed(true); setMessage('Operação confirmada. Falta atualizar os dados abaixo; use Conferir dados atuais antes de continuar.'); }
    setBusy(false); return true;
  };
  async function retry() {
    if (busy) return; setBusy(true);
    const result = await submitCashCommand({ storageKey,url });
    setMessage(result.ok ? 'Operação confirmada.' : result.message);
    try { setPending(readStoredCashCommand(storageKey)?.payload ?? null); } catch { setReady(false); }
    if (result.ok) { if (pending?.action === 'receive') setReceiveRevision(value => value+1); try { await reload(); } catch { setFailed(true); setMessage('Operação confirmada. Confira os dados atuais para continuar.'); } }
    setBusy(false);
  }
  const source = detail?.source,locked = busy || !ready || !!pending || failed || !!source?.closed || !!source?.cancelled;
  return <section className="space-y-5 text-[#123b63]" aria-labelledby="trip-financial-title">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="trip-financial-title" className="text-2xl font-bold">Fechamento do passeio</h2><p className="text-sm">{loadedAt ? `Dados conferidos às ${loadedAt}` : 'Consultando contagem e recebimentos…'}</p></div><button className="min-h-11 px-3 underline disabled:opacity-50" type="button" disabled={busy || !!pending} onClick={async () => { setBusy(true); try { await reload(); setPreview(false); } catch (error) { setFailed(true); setMessage(error instanceof Error ? error.message : 'Falha ao atualizar.'); } finally { setBusy(false); } }}>Conferir dados atuais</button></header>
    {message && <p role="status" className="rounded-lg border border-[#b9cddd] bg-[#f3f7fb] p-3">{message}</p>}
    {pending && <div role="alert" className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950"><p>Há uma tentativa sem confirmação. Seus dados enviados foram preservados; confira o resultado antes de iniciar outra operação.</p><button type="button" className={button} disabled={busy} onClick={() => void retry()}>Conferir tentativa anterior</button></div>}
    {source && detail && <>
      {source.closed && <p role="status">Dia finalizado. Alterações exigem revisão gerencial do fechamento diário.</p>}
      {source.cancelled && <p role="alert">Passeio cancelado ou inativo.</p>}
      <div className={card}><TripSettlementSummary source={detail.receipt?.snapshot ?? source} />{detail.receipt && <p className="font-semibold">Recibo #{detail.receipt.number} finalizado. Os valores acima são os registrados no recibo original.</p>}<div className="flex flex-wrap gap-4"><Link className="min-h-11 py-3 underline" href={`/painel/caixas?date=${source.today}`}>Abrir ou consultar caixa de passeios</Link><Link className="min-h-11 py-3 underline" href={`/painel/agenda/${source.date}?tab=programacao`}>Programação e contatos</Link></div></div>
      <details className={card}><summary className="min-h-11 cursor-pointer font-semibold">Dados do passeio</summary><p>Representante: {source.representative ?? 'Não informado'}</p><p>Contato: {source.contact ?? 'Não informado'} · {source.phone ?? 'Telefone não informado'}</p><p>Transportador: {source.transportName ?? 'Não informado'} · {source.transportPhone ?? 'Telefone não informado'}</p><p>Embarque: {source.boardingTime ?? 'Não informado'}</p><p>Observações: {source.observations ?? 'Nenhuma'}</p><p>Preço no site (somente leitura): adulto {source.sitePrices.adultPriceCents === null ? 'A conferir' : tripMoney(source.sitePrices.adultPriceCents)} · criança {source.sitePrices.childPriceCents === null ? 'A conferir' : tripMoney(source.sitePrices.childPriceCents)}</p></details>
      <PainelTripVehicles source={source} actorCpf={actorCpf} canCount={canCount} disabled={locked} onChanged={reload} />
      {isManager && <details className={card}><summary className="min-h-11 cursor-pointer font-semibold">Previsão de pessoas</summary><Form action="planning" run={run} disabled={locked || !!source.receiptId} label="Salvar previsão" payload={data => ({ plannedPeople: text(data,'plannedPeople') === '' ? null : Number(data.get('plannedPeople')),vehicles: source.vehicles.map(v => ({ id: v.id,plannedPeople: text(data,`planned-${v.id}`) === '' ? null : Number(data.get(`planned-${v.id}`)) })) })}><p>Deixe em branco quando ainda não houver previsão. A contagem realizada é preservada.</p><label className="grid gap-1 font-semibold">Previstos no passeio<input name="plannedPeople" className={field} type="number" min={0} max={100000} defaultValue={source.plannedPeople ?? ''} /></label><div className="grid gap-3 sm:grid-cols-2">{source.vehicles.map(v => <label key={v.id} className="grid gap-1 font-semibold">{v.type === 'bus' ? 'Ônibus' : 'Van'} #{v.id}<input className={field} name={`planned-${v.id}`} type="number" min={0} max={100000} defaultValue={v.plannedPeople ?? ''} /></label>)}</div><Reason /></Form></details>}
      {isManager && <details className={card}><summary className="min-h-11 cursor-pointer font-semibold">Preços e cortesias do passeio</summary><p className="text-sm">A alteração afeta a cobrança da escola. Os valores já pagos no site são preservados.</p><Form action="configure" run={run} disabled={locked || !!source.receiptId} label="Salvar preços e cortesias" payload={data => ({ configuration: { adultPriceCents: cents(data,'adultPrice'),childPriceCents: cents(data,'childPrice'),adultCourtesies: Number(data.get('adultCourtesies')),childCourtesies: Number(data.get('childCourtesies')) } })}>{(source.configuration.adultPriceCents === null || source.configuration.childPriceCents === null) && <label className="flex min-h-11 items-center gap-3"><input type="checkbox" required /> Conferi os dois preços, inclusive eventuais valores zero.</label>}<div className="grid gap-3 sm:grid-cols-2">{(['adult','child'] as const).map(kind => <div key={kind} className="space-y-3"><label className="grid gap-1 font-semibold">Preço {kind === 'adult' ? 'adulto' : 'criança'}<CurrencyInput className={field} name={`${kind}Price`} defaultValue={source.configuration[`${kind}PriceCents`]?.toString() ?? ''} required /></label><label className="grid gap-1 font-semibold">Cortesias {kind === 'adult' ? 'adultos' : 'crianças'}<input className={field} type="number" name={`${kind}Courtesies`} min={0} max={100000} required defaultValue={source.configuration[`${kind}Courtesies`]} /></label></div>)}</div><Reason /></Form></details>}
      <fieldset disabled={busy || !!pending || !ready} className="min-w-0"><Participants source={source} sessions={sessions} run={run} locked={locked} /></fieldset>
      <section className={card}><h3 className="text-lg font-bold">Recebimentos da escola</h3><div className="space-y-3">{source.payments.length === 0 && <p>Nenhum recebimento registrado.</p>}{source.payments.map(p => <details key={p.id} className="rounded-lg border border-[#d4dfeb] p-3"><summary className="min-h-11 cursor-pointer font-semibold">#{p.id} · {TRIP_PAYMENT_METHODS[p.method]} · {tripMoney(p.amountCents)} · {p.reversed ? 'Devolvido' : p.status === 'confirmed' ? 'Recebido' : p.status === 'pending' ? 'Pendente' : 'Cancelado'}</summary><p>Data: {p.paymentDate.split('-').reverse().join('/')} · Comprovante: {p.reference || 'Não informado'}{p.periodId ? ` · Caixa #${p.periodId}` : ''}</p>{p.changeCents > 0 && <p>Entregue: {tripMoney(p.tenderedCents)} · Troco: {tripMoney(p.changeCents)}</p>}
        {p.status === 'pending' && <div className="mt-4 grid gap-5 md:grid-cols-2"><Form action="confirm_payment" run={run} disabled={locked || !!source.receiptId} label="Confirmar boleto recebido" payload={data => ({ paymentId: p.id,paymentDate: text(data,'paymentDate'),reference: text(data,'reference') })}><DateField today={source.today} /><Reference /><Reason /></Form><Form action="cancel_pending" run={run} disabled={locked || !!source.receiptId} label="Cancelar boleto pendente" payload={() => ({ paymentId: p.id })}><Reason required /></Form></div>}
        {isManager && p.status === 'confirmed' && !p.reversed && <details className="mt-3"><summary className="min-h-11 cursor-pointer py-3">Registrar devolução deste recebimento</summary><p className="mb-3">Registre somente após devolver {tripMoney(p.amountCents)} ao pagador. Esta ação não chama o gateway.</p><Form action="reverse_payment" run={run} disabled={locked || !!source.receiptId} label="Confirmar recebimento devolvido" payload={data => ({ paymentId: p.id,paymentDate: text(data,'paymentDate'),periodId: p.method === 'dinhe' ? period(data) : null,reference: text(data,'reference') })}><DateField today={source.today} />{p.method === 'dinhe' && <CashSelect sessions={sessions} />}<Reference /><Reason required /></Form></details>}
      </details>)}</div><ReceiveForm key={receiveRevision} source={source} sessions={sessions} run={run} disabled={locked || !!source.receiptId || source.remainingCents === null || source.remainingCents <= 0} /></section>
      <section className={card}><h3 className="text-lg font-bold">Recibo em duas vias</h3>
        {detail.history.map(receipt => <p key={receipt.id}><a className="inline-flex min-h-11 items-center underline" href={`/api/painel/recibos/${receipt.id}`} target="_blank" rel="noreferrer">Recibo #{receipt.number} · PDF em duas vias</a>{receipt.revised ? ' · Revisado, original preservado' : ''}</p>)}
        {!source.receiptId && <><p>A finalização exige o recebimento integral e a conferência dos dados. O recibo preserva os valores e a contagem desta revisão.</p><button type="button" className={button} disabled={locked || !source.calculation} onClick={() => setPreview(value => !value)}>{preview ? 'Ocultar prévia' : 'Conferir prévia do recibo'}</button>{preview && <div className="space-y-4 border-t border-[#d4dfeb] pt-4">{['Via da escola','Via do Rincão'].map(copy => <div className="space-y-3 rounded-lg border border-[#b9cddd] p-4" key={copy}><h4 className="font-bold">Prévia · {copy}</h4><p>{source.clientName} · {source.date.split('-').reverse().join('/')}</p><p>Representante: {source.representative ?? 'Não informado'} · Veículos: {source.vehicles.length}</p><TripSettlementSummary source={source} /><ul>{source.payments.filter(p => p.status === 'confirmed' && !p.reversed).map(p => <li key={p.id}>{p.paymentDate.split('-').reverse().join('/')} · {TRIP_PAYMENT_METHODS[p.method]} · {tripMoney(p.amountCents)} · {p.reference || 'Dinheiro'}</li>)}</ul><p className="mt-5 border-t border-[#b9cddd] pt-2">{copy === 'Via do Rincão' ? 'Assinatura do responsável da escola' : 'Assinatura do Rincão'}</p></div>)}{isManager ? <Form action="finalize" run={run} label="Confirmar finalização e emitir recibo" disabled={locked || source.remainingCents !== 0 || source.pendingPaymentCents !== 0 || !source.calculation} payload={data => ({ acknowledgeWarnings: data.has('acknowledgeWarnings') })}>{source.warnings.length > 0 && <label className="flex min-h-11 items-center gap-3"><input type="checkbox" name="acknowledgeWarnings" required /> Conferi os avisos e autorizo a exceção abaixo.</label>}<Reason required={source.warnings.length > 0} /></Form> : <p>Um gerente deve confirmar a finalização.</p>}</div>}</>}
        {source.receiptId && isManager && <Form action="reopen" run={run} disabled={locked} label="Reabrir passeio para revisão" payload={() => ({})}><p>O recibo anterior será preservado. Uma nova finalização emitirá outro número.</p><Reason required /></Form>}
      </section>
    </>}
  </section>;
}
