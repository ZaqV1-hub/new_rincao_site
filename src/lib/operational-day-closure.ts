import { readOperationalDayReceipts } from "./operational-day-receipts";
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { getOperationalCatalogPool } from './painel-operational-catalog';
import { getOperationalParkId } from './operational-day-contract';
import { isCivilDate } from './operational-date';
import { lockOperationalDay } from './operational-day-lock';
import { readOperationalDaySummary } from './operational-day-summary';
import { readOperationalTripDay } from './operational-trip-day';
import { listCashSessions,readCashSessionSnapshot,closeLockedCashSession,type CashSessionDetail } from './operational-cash-session';
import { listOperationalExpenses } from './operational-expenses';
import { registerOpsAuditLog } from './ops-audit-log';
import { tripFingerprint } from './trip-settlement-source';
import { invalidTrip,tripInteger,tripRecord,tripText,TripSettlementError,type TripFinancialActor } from './trip-settlement-contract';
export type DailyPurchaseItem = { voucherId:number;purchaseId:number;status:string;channel:string;type:string;kind:string;service:string|null;visitDate:string;usedOn:string|null;used:string;amountCents:number|null;schoolId:number|null };
export type DailyAdjustment = {id:string;status:'pending'|'resolved'|'rejected';resolutionReason:string|null;resolvedAt:string|null;purchaseId:number;sourceDates:string[];requestedChange:unknown;createdAt:string};
function deny(code:string,message:string,status=409):never { throw new TripSettlementError(code,message,status); }
function dateInput(date:string) { if(!isCivilDate(date))return invalidTrip();return date; }
// Runtime timestamps are not financial changes. All remaining fields participate in the comparison.
function stable(value:unknown):unknown {
  if(Array.isArray(value))return value.map(stable);
  if(value && typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key])=>!['generatedAt','today','navigation'].includes(key)).sort(([a],[b])=>a.localeCompare(b)).map(([key,v])=>[key,stable(v)]));
  return value;
}
export async function readOperationalDaySnapshot(client:PoolClient,date:string) {
  dateInput(date);const park=getOperationalParkId(),summary=await readOperationalDaySummary(client,date,park),tripDay=await readOperationalTripDay(client,date);
  const sessions:CashSessionDetail[]=[];
  for(const session of await listCashSessions(date,client))sessions.push({...session,snapshot:await readCashSessionSnapshot(client,session)});
  const expenses=park==='rincao'?await listOperationalExpenses(date,client):null;
  const items=(await client.query<Omit<DailyPurchaseItem,'amountCents'> & {amountCents:string|null}>(`SELECT v.idvoucher AS "voucherId",v.idcompra AS "purchaseId",btrim(c.stcompra) AS status,btrim(c.tpcompra) AS channel,btrim(v.tpvoucher) AS type,v.descricao AS service,
    CASE WHEN v.idescola IS NOT NULL OR v.tpvoucher='escol' OR a.tpagenda IN ('escol','igrej','casam','melho','confr','ongs','grmix') THEN 'school'
      WHEN EXISTS(SELECT 1 FROM servicos_adicionais z WHERE z.parque=$1 AND (z.id=v.servico_id OR (v.tpvoucher='espec' AND z.legacy_ticket_id=v.item_id))) THEN 'service'
      WHEN v.tpvoucher IN ('norma','infan','isent','corte') AND a.tpagenda IN ('padra','promo') AND NOT EXISTS(SELECT 1 FROM agenda_extras ae WHERE ae.idagenda=a.idagenda) THEN 'admission' ELSE 'unknown' END AS kind,
    COALESCE(v.dtinicio_validade,a.dtagenda)::text AS "visitDate",v.dtuso::text AS "usedOn",btrim(v.stusado) AS used,(v.vlunicompra*100)::text AS "amountCents",v.idescola AS "schoolId"
    FROM voucher v JOIN compra c ON c.idcompra=v.idcompra JOIN agenda a ON a.idagenda=v.idagenda
    WHERE (COALESCE(v.dtinicio_validade,a.dtagenda)=$2::date OR v.dtuso=$2::date) AND (v.parque_operacional IS NULL OR v.parque_operacional=$1) ORDER BY v.idvoucher`,[park,date])).rows.map(row=>({...row,amountCents:row.amountCents===null?null:tripInteger(Number(row.amountCents),Number.MAX_SAFE_INTEGER)}));
  const purchases=(await client.query<{id:number;total:string;discount:string|null}>(`SELECT idcompra AS id,(vltotcompra*100)::text AS total,(vltotdesc*100)::text AS discount FROM compra WHERE idcompra=ANY($1::int[]) ORDER BY idcompra`,[[...new Set(items.map(i=>i.purchaseId))]])).rows.map(p=>({id:p.id,totalCents:p.total===null?null:tripInteger(Number(p.total),Number.MAX_SAFE_INTEGER),discountCents:p.discount===null?null:tripInteger(Number(p.discount),Number.MAX_SAFE_INTEGER)}));
  const adjustments=(await client.query<DailyAdjustment>(`SELECT id,status,resolution->>'reason' AS "resolutionReason",resolved_at::text AS "resolvedAt",purchase_id::int AS "purchaseId",ARRAY(SELECT x::text FROM unnest(source_dates) x) AS "sourceDates",requested_change AS "requestedChange",created_at::text AS "createdAt" FROM purchase_adjustments WHERE parque=$1 AND source_dates @> ARRAY[$2::date] ORDER BY created_at,id`,[park,date])).rows;
  const trips=tripDay.trips.map(({source,receipt})=>({agendaId:source.agendaId,clientId:source.clientId,name:source.clientName,cancelled:source.cancelled,receiptId:receipt?.id??null,receiptNumber:receipt?.number??null,
    receiptSourceChanged:!!receipt && tripFingerprint({calculation:source.calculation,configuration:source.configuration,payments:source.payments})!==tripFingerprint({calculation:receipt.snapshot.calculation,configuration:receipt.snapshot.configuration,payments:receipt.snapshot.payments}),sourceFingerprint:source.fingerprint,calculation:receipt?.snapshot.calculation??source.calculation,remainingCents:source.remainingCents,pendingPaymentCents:source.pendingPaymentCents,
    payments:source.payments,refunds:source.participants.filter(p=>p.refundRequested).map(p=>({voucherId:p.voucherId,amountCents:p.paidCents,paidCents:p.refundPaidCents,paidAt:p.refundPaidAt})),
    vehicles:source.vehicles.map(v=>({id:v.id,type:v.type,state:v.state,revisionId:v.revisionId,counts:v.draft?.counts??null,responsible:v.draft?.responsible.name??null,ownerName:v.ownerName})),
    issues:source.blockingIssues,warnings:source.warnings}));
  const receipts=(await readOperationalDayReceipts(client,date,park)).rows;
  // Raw movements still expose changes made by legacy writers after a cash snapshot was frozen.
  const cashFacts=(await client.query<{facts:unknown}>(`SELECT jsonb_build_object('payments',COALESCE((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.id) FROM compra_pagamentos p JOIN caixa_periodos c ON c.id=p.periodo_id WHERE c.parque=$1 AND c.data_operacional=$2::date),'[]'::jsonb),
    'movements',COALESCE((SELECT jsonb_agg(to_jsonb(m) ORDER BY m.id) FROM movimentacao_caixa m JOIN caixa_periodos c ON c.id=m.periodo_id WHERE c.parque=$1 AND c.data_operacional=$2::date),'[]'::jsonb)) AS facts`,[park,date])).rows[0].facts;
  const warnings=[...summary.warnings];
  if(trips.some(t=>t.receiptSourceChanged))warnings.push({code:'trip_receipt_changed',message:'Há dados de passeio alterados após o recibo. Confira a revisão do passeio antes de fechar o dia.'});
  if(adjustments.some(a=>a.status==='pending'))warnings.push({code:'purchase_adjustments',message:`${adjustments.filter(a=>a.status==='pending').length} ajuste(s) de compra aguardam resolução.`});
  if(tripDay.refundsPendingCents)warnings.push({code:'pending_refunds',message:'Há reembolsos de passeios ainda não comprovados.'});
  if(sessions.some(s=>s.snapshot.pending.length))warnings.push({code:'cash_pending',message:'Há caixas com valores ou classificações pendentes de conferência.'});
  const revenueCents=summary.revenue.totalCents.value,expenseCents=summary.expenses.value;
  const snapshot={schemaVersion:1 as const,cashReviews:[] as {periodId:number;originalCountedCents:number|null;countedCents:number;reason:string}[],park,date,today:tripDay.today,generatedAt:summary.generatedAt,summary,sessions,trips,items,purchases,expenses,receipts,adjustments,warnings,
    revenueCents,expenseCents,resultCents:revenueCents===null||expenseCents===null?null:revenueCents-expenseCents,refundsPendingCents:tripDay.refundsPendingCents};
  return {...snapshot,fingerprint:tripFingerprint(stable({snapshot,cashFacts}))};
}
export type OperationalDaySnapshot=Awaited<ReturnType<typeof readOperationalDaySnapshot>>;
export type OperationalDayRevision={id:string;revision:number;snapshot:OperationalDaySnapshot;reason:string;actorName:string|null;createdAt:string};
async function transaction<T>(run:(client:PoolClient)=>Promise<T>,write=false) {
  const client=await getOperationalCatalogPool().connect();let discard=false;
  try {await client.query(write?'BEGIN ISOLATION LEVEL SERIALIZABLE':'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');const result=await run(client);await client.query('COMMIT');return result;}
  catch(error){try{await client.query('ROLLBACK');}catch{discard=true;}if(error && typeof error==='object' && 'code' in error && ['40001','40P01'].includes(String(error.code)))return deny('day_concurrent_change','A data mudou durante a conferência. Confira novamente a mesma tentativa antes de fechar.',503);throw error;}finally{client.release(discard);}
}
async function readRevision(client:PoolClient,date:string,id:string) {
  const row=(await client.query<OperationalDayRevision>(`SELECT id,revisao AS revision,snapshot,motivo AS reason,actor_name AS "actorName",created_at::text AS "createdAt" FROM operacao_fechamentos WHERE parque=$1 AND data=$2::date AND id=$3`,[getOperationalParkId(),date,id])).rows[0];
  if(!row)return deny('day_revision_missing','Revisão não encontrada.',404);return row;
}
export async function getOperationalDayRevision(date:string,id:string) {
  dateInput(date);if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id))return invalidTrip();return transaction(client=>readRevision(client,date,id));
}
export async function getOperationalDayClosure(date:string) {
  dateInput(date);return transaction(async client=>{
    const live=await readOperationalDaySnapshot(client,date),park=getOperationalParkId();
    const row=(await client.query<{id:string|null;closed:boolean}>("SELECT fechamento_id AS id,estado='closed' AS closed FROM operacao_dias WHERE parque=$1 AND data=$2::date",[park,date])).rows[0];
    const current=row?.id?await readRevision(client,date,row.id):null;
    const history=(await client.query<{id:string;revision:number;createdAt:string;reopened:boolean}>(`SELECT f.id,f.revisao AS revision,f.created_at::text AS "createdAt",EXISTS(SELECT 1 FROM operacao_reaberturas r WHERE r.fechamento_id=f.id) AS reopened FROM operacao_fechamentos f WHERE f.parque=$1 AND f.data=$2::date ORDER BY f.revisao DESC`,[park,date])).rows;
    return {live,current,history,closed:row?.closed??false,diverged:!!current && current.snapshot.fingerprint!==live.fingerprint};
  });
}
export type OperationalDayClosure=Awaited<ReturnType<typeof getOperationalDayClosure>>;
export type DayClosureCommandResult={commandId:string;closureId:string|null;revision:number|null;date:string};
export async function changeOperationalDayClosure(date:string,value:unknown,actor:TripFinancialActor):Promise<DayClosureCommandResult> {
  dateInput(date);const data=tripRecord(value,['action','fingerprint','idempotencyKey','reason','acknowledgeWarnings','counts']),action=data.action;
  if(!['close','reopen'].includes(String(action)) || typeof data.fingerprint!=='string'||!/^[a-f0-9]{64}$/.test(data.fingerprint))return invalidTrip();
  const reason=tripText(data.reason??'',2000),key=tripText(data.idempotencyKey,100,true),park=getOperationalParkId(),requestHash=tripFingerprint({date,data});
  if(!/^[A-Za-z0-9:_-]+$/.test(key))return invalidTrip();
  if(!actor.cpf || !/^\d{11}$/.test(actor.cpf) || !actor.manager)return deny('day_manager_required','O fechamento ou a reabertura exige um gerente identificado.',403);
  return transaction(async client=>{
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`finance-command:${park}:${key}`]);
    const previous=(await client.query<{actor_cpf:string;request_hash:string;result:DayClosureCommandResult}>('SELECT actor_cpf,request_hash,result FROM financeiro_comandos WHERE parque=$1 AND idempotency_key=$2',[park,key])).rows[0];
    if(previous){if(previous.actor_cpf!==actor.cpf)return deny('day_command_forbidden','Esta tentativa pertence a outro operador.',403);if(previous.request_hash!==requestHash)return deny('day_idempotency_conflict','A chave pertence a outra tentativa.');return previous.result;}
    await lockOperationalDay(client,park,date);
    await client.query('SELECT id FROM caixa_periodos WHERE parque=$1 AND data_operacional=$2::date ORDER BY id FOR UPDATE',[park,date]);
    const before=await readOperationalDaySnapshot(client,date);
    if(before.fingerprint!==data.fingerprint)return deny('day_source_changed','Os dados mudaram. Seus campos foram preservados; confira uma nova prévia.');
    const row=(await client.query<{closed:boolean;id:string|null}>("SELECT estado='closed' AS closed,fechamento_id AS id FROM operacao_dias WHERE parque=$1 AND data=$2::date FOR UPDATE",[park,date])).rows[0];
    let closureId:string|null=null,revision:number|null=null;
    if(action==='reopen'){
      if(!row?.closed||!row.id)return deny('day_not_closed','Não há fechamento deste painel para reabrir.');
      if(!reason)return invalidTrip('Informe o motivo da reabertura.');
      await client.query('INSERT INTO operacao_reaberturas(id,fechamento_id,motivo,actor_cpf,actor_name) VALUES($1,$2,$3,$4,$5)',[randomUUID(),row.id,reason,actor.cpf,actor.name]);
      await client.query("UPDATE operacao_dias SET estado='open',fechamento_id=NULL,versao=versao+1,updated_at=clock_timestamp() WHERE parque=$1 AND data=$2::date",[park,date]);
    }else{
      if(row?.closed)return deny('day_already_closed','Esta data já está fechada.');
      if(date>before.today)return deny('day_future','Não é possível fechar uma data futura.');
      if(typeof data.acknowledgeWarnings!=='boolean'||!Array.isArray(data.counts))return invalidTrip();
      if(before.warnings.length && (!data.acknowledgeWarnings||!reason))return deny('day_pending','Confira as pendências. Para fechar por exceção, o gerente deve reconhecê-las e informar o motivo.');
      const counts=new Map<number,number|null>();
      for(const raw of data.counts){const count=tripRecord(raw,['periodId','countedCashCents']),id=tripInteger(count.periodId,2147483647,1);if(counts.has(id)||!before.sessions.some(s=>s.id===id))return invalidTrip('Confira os caixas abertos.');counts.set(id,count.countedCashCents===null?null:tripInteger(count.countedCashCents,999999999999));}
      if(before.sessions.some(s=>s.closedAt&&counts.get(s.id)!=null)&&!reason)return invalidTrip('Informe o motivo da conferência de um caixa já fechado.');
      for(const session of before.sessions)if(!session.closedAt)await closeLockedCashSession(client,session,{countedCashCents:counts.get(session.id)??null,automatic:false,reason},actor);
      await client.query("INSERT INTO operacao_dias(parque,data,estado,tabela_preco_id,day_use_agenda_id) VALUES($1,$2::date,'closed',$3,$4) ON CONFLICT(parque,data) DO UPDATE SET estado='closed',versao=operacao_dias.versao+1,updated_at=clock_timestamp()",[park,date,before.summary.configuration?.priceTableId??null,before.summary.configuration?.dayUseAgendaId??null]);
      const snapshot=await readOperationalDaySnapshot(client,date);
      // A later count belongs to this daily revision; the original cash closure remains immutable.
      for(const session of snapshot.sessions){const counted=counts.get(session.id);if(before.sessions.find(s=>s.id===session.id)?.closedAt&&counted!=null){snapshot.cashReviews.push({periodId:session.id,originalCountedCents:session.snapshot.countedCashCents,countedCents:counted,reason});session.snapshot.countedCashCents=counted;session.snapshot.differenceCents=counted-session.snapshot.expectedCashCents;session.snapshot.pending=session.snapshot.pending.filter(p=>p!=='cash_count_missing');}}
      if(!snapshot.sessions.some(s=>s.snapshot.pending.length))snapshot.warnings=snapshot.warnings.filter(w=>w.code!=='cash_pending');
      if(snapshot.sessions.some(s=>s.snapshot.differenceCents!==null&&s.snapshot.differenceCents!==0))snapshot.warnings.push({code:'cash_difference',message:'Há diferença entre dinheiro esperado e contado. Confira os caixas desta revisão.'});
      revision=(await client.query<{revision:number}>('SELECT COALESCE(MAX(revisao),0)+1 AS revision FROM operacao_fechamentos WHERE parque=$1 AND data=$2::date',[park,date])).rows[0].revision;
      closureId=randomUUID();
      await client.query('INSERT INTO operacao_fechamentos(id,parque,data,revisao,snapshot,source_fingerprint,motivo,actor_cpf,actor_name) VALUES($1,$2,$3::date,$4,$5::jsonb,$6,$7,$8,$9)',[closureId,park,date,revision,JSON.stringify(snapshot),snapshot.fingerprint,reason,actor.cpf,actor.name]);
      await client.query('UPDATE operacao_dias SET fechamento_id=$3 WHERE parque=$1 AND data=$2::date',[park,date,closureId]);
    }
    const result={commandId:randomUUID(),closureId,revision,date};
    await registerOpsAuditLog(client,{origem:'painel-fechamento',acao:String(action),descricao:action==='close'?'Dia fechado com snapshot imutável.':'Dia reaberto; caixas e revisões anteriores preservados.',motivo:reason,usuarioNome:actor.name,detalhes:{...result,actorCpf:actor.cpf}},'postgres');
    await client.query('INSERT INTO financeiro_comandos(id,parque,idempotency_key,action,request_hash,actor_cpf,result) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb)',[result.commandId,park,key,`day_${action}`,requestHash,actor.cpf,JSON.stringify(result)]);
    return result;
  },true);
}
