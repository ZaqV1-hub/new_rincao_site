import {getIngressoSistemaDbPool} from './ingresso-db';
import {getOperationalParkId} from './operational-day-contract';
import {getCountingSlip} from './counting-slip';
import {TripCountingError,type CountingActor} from './trip-counting-contract';
export async function recordCountingShare(revisionId:string,value:unknown,actor:CountingActor){
 const v=value as {action?:unknown;idempotencyKey?:unknown};
 if(!v||typeof v!=='object'||Object.keys(v).some(k=>!['action','idempotencyKey'].includes(k))||!['opened','declared'].includes(String(v.action))||typeof v.idempotencyKey!=='string'||! /^[a-f0-9-]{36}$/.test(v.idempotencyKey))throw new TripCountingError('share_input','Registro inválido.',400);
 await getCountingSlip(revisionId,actor);
 const pool=getIngressoSistemaDbPool(),park=getOperationalParkId();
 const result=await pool.query(`INSERT INTO contagem_compartilhamentos(id,parque,revision_id,actor_cpf,actor_name,action) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO NOTHING RETURNING created_at::text AS at`,[v.idempotencyKey,park,revisionId,actor.cpf,actor.name?.slice(0,160),v.action]);
 if(result.rowCount)return {action:v.action,at:result.rows[0].at,actorName:actor.name};
 const prior=(await pool.query('SELECT action,created_at::text AS at,actor_name AS "actorName" FROM contagem_compartilhamentos WHERE id=$1 AND parque=$2 AND revision_id=$3 AND actor_cpf=$4 AND action=$5',[v.idempotencyKey,park,revisionId,actor.cpf,v.action])).rows[0];
 if(!prior)throw new TripCountingError('share_conflict','Tentativa pertence a outro registro.');return prior;
}
export async function getCountingShare(revisionId:string,actor:CountingActor){await getCountingSlip(revisionId,actor);return (await getIngressoSistemaDbPool().query('SELECT action,created_at::text AS at,actor_name AS "actorName" FROM contagem_compartilhamentos WHERE parque=$1 AND revision_id=$2 ORDER BY created_at DESC LIMIT 1',[getOperationalParkId(),revisionId])).rows[0]??null;}
