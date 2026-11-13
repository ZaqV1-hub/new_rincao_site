import {createHash,randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import {getIngressoSistemaDbPool} from './ingresso-db';
import {getOperationalParkId} from './operational-day-contract';
import {getSaoPauloToday,isCivilDate} from './operational-date';
import {lockOperationalDay} from './operational-day-lock';
import {readCountingDayReport} from './counting-day-report';
import {countingReportTotals,type CountingDayReport} from './counting-day-report-contract';
import {TripCountingError,type CountingActor} from './trip-counting-contract';
import {registerOpsAuditLog,ensureOpsAuditLogTable} from './ops-audit-log';
export type CountingDayRevision={id:string;version:number;snapshot:CountingDayReport;createdAt:string;actorName:string|null};
async function tx<T>(fn:(client:PoolClient)=>Promise<T>,write=false){const client=await getIngressoSistemaDbPool().connect();try{if(write)await ensureOpsAuditLogTable(client,'postgres');await client.query(write?'BEGIN':'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');const result=await fn(client);await client.query('COMMIT');return result;}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}}
const deny=(code:string,message:string,status=409):never=>{throw new TripCountingError(code,message,status);};
export async function getCountingDayClosure(date:string){if(!isCivilDate(date))return deny('count_date','Data inválida.',400);return tx(async client=>{
 const live=await readCountingDayReport(client,date),park=getOperationalParkId();
 const state=(await client.query<{estado:string;revision_id:string}>('SELECT estado,revision_id FROM contagem_dias WHERE parque=$1 AND data=$2::date',[park,date])).rows[0];
 const history=(await client.query<CountingDayRevision>('SELECT id,versao AS version,snapshot,created_at::text AS "createdAt",actor_name AS "actorName" FROM contagem_dia_revisoes WHERE parque=$1 AND data=$2::date ORDER BY versao DESC',[park,date])).rows;
 const current=history.find(r=>r.id===state?.revision_id)??null;
 return {live,current,history,closed:state?.estado==='closed',diverged:!!current&&current.snapshot.fingerprint!==live.fingerprint};
 });}
export type CountingDayClosure=Awaited<ReturnType<typeof getCountingDayClosure>>;
export async function changeCountingDayClosure(date:string,value:unknown,actor:CountingActor){
 if(!isCivilDate(date)||!actor.cpf||!/^\d{11}$/.test(actor.cpf))return deny('count_day_actor','Data ou operador inválido.',403);
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!['action','fingerprint','idempotencyKey','acknowledgePending'].includes(k)))return deny('count_day_input','Confira o encerramento.',400);
 const v=value as {action:string;fingerprint:string;idempotencyKey:string;acknowledgePending:boolean};
 if(!['close','reopen'].includes(v.action)||typeof v.fingerprint!=='string'||! /^[a-f0-9]{64}$/.test(v.fingerprint)||typeof v.idempotencyKey!=='string'||! /^[a-zA-Z0-9:_-]{1,100}$/.test(v.idempotencyKey)||typeof v.acknowledgePending!=='boolean')return deny('count_day_input','Confira o encerramento.',400);
 const park=getOperationalParkId(),hash=createHash('sha256').update(JSON.stringify({date,action:v.action,fingerprint:v.fingerprint,acknowledgePending:v.acknowledgePending})).digest('hex');
 return tx(async client=>{
 await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`count-day:${park}:${v.idempotencyKey}`]);
 const prior=(await client.query<{actor_cpf:string;request_hash:string;result:{date:string;closed:boolean;revisionId:string|null}}>('SELECT actor_cpf,request_hash,result FROM contagem_dia_comandos WHERE parque=$1 AND idempotency_key=$2',[park,v.idempotencyKey])).rows[0];
 if(prior){if(prior.actor_cpf!==actor.cpf||prior.request_hash!==hash)return deny('count_day_conflict','A tentativa pertence a outro comando.');return prior.result;}
 if(date!==getSaoPauloToday())return deny('count_day_date','O encerramento da contagem está disponível somente hoje.');
 await lockOperationalDay(client,park,date);
 if((await client.query("SELECT 1 FROM operacao_dias WHERE parque=$1 AND data=$2::date AND estado='closed'",[park,date])).rowCount)return deny('count_day_financial_closed','O financeiro do dia está fechado.');
 await client.query('INSERT INTO contagem_dias(parque,data) VALUES($1,$2::date) ON CONFLICT DO NOTHING',[park,date]);
 const state=(await client.query<{estado:string;versao:number}>('SELECT estado,versao FROM contagem_dias WHERE parque=$1 AND data=$2::date FOR UPDATE',[park,date])).rows[0];
 const live=await readCountingDayReport(client,date);if(live.fingerprint!==v.fingerprint)return deny('count_day_changed','A contagem mudou. Confira os números atualizados antes de encerrar.');
 let revisionId:string|null=null;
 if(v.action==='reopen'){if(state.estado!=='closed')return deny('count_day_open','A contagem já está aberta.');await client.query("UPDATE contagem_dias SET estado='open' WHERE parque=$1 AND data=$2::date",[park,date]);}
 else{
 if(countingReportTotals(live).pending&&!v.acknowledgePending)return deny('count_day_pending','Confirme os veículos e grupos ainda não contados.');
 revisionId=randomUUID();await client.query('INSERT INTO contagem_dia_revisoes(id,parque,data,versao,snapshot,actor_cpf,actor_name) VALUES($1,$2,$3::date,$4,$5::jsonb,$6,$7)',[revisionId,park,date,state.versao+1,JSON.stringify(live),actor.cpf,actor.name?.slice(0,160)]);
 await client.query("UPDATE contagem_dias SET estado='closed',versao=versao+1,revision_id=$3 WHERE parque=$1 AND data=$2::date",[park,date,revisionId]);}
 await registerOpsAuditLog(client,{origem:'painel-contagem',acao:v.action==='close'?'day_close':'day_reopen',descricao:`Conferência da portaria em ${date}.`,motivo:'Ação explícita do monitor',usuarioNome:actor.name,detalhes:{park,date,revisionId,actorCpf:actor.cpf,acknowledgePending:v.acknowledgePending}},'postgres');
 const result={date,closed:v.action==='close',revisionId};await client.query('INSERT INTO contagem_dia_comandos(parque,idempotency_key,actor_cpf,request_hash,result) VALUES($1,$2,$3,$4,$5::jsonb)',[park,v.idempotencyKey,actor.cpf,hash,JSON.stringify(result)]);return result;
 },true);
}
