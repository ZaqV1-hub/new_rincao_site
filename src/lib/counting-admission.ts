import { createHash } from 'node:crypto';
import { getIngressoSistemaDbPool } from './ingresso-db';
import { getOperationalParkId } from './operational-day-contract';
import { lockOperationalDay } from './operational-day-lock';
import { getVoucherByNumber,getVouchersByIds } from './ops-voucher-validation-queries';
import { alreadyUsedError,appendTicketWarnings,getSaoPauloDateParts,isOnlinePurchasePaid,isReservationPaid,isVoucherExpired,markVoucherUsed } from './ops-voucher-validation-shared';
import { VoucherOperationError,type VoucherOperationInputActor } from './ops-voucher-validation-contract';
import { registerOpsAuditLog,ensureOpsAuditLogTable } from './ops-audit-log';
import { parseCountingCode } from './counting-qr';
export type CountingAdmissionResult={admitted:true;replayed:boolean;warnings?:string[];voucherId:number;purchaseId:number;number:string;date:string;time:string;actorName:string;category:string};
export async function admitCountingVoucher(value:unknown,actor:VoucherOperationInputActor):Promise<CountingAdmissionResult>{
  const deny=(code:string,message:string,status=409):never=>{throw new VoucherOperationError(code,message,status);};
  if(!actor.cpf||!/^\d{11}$/.test(actor.cpf))return deny('gate_actor_required','Operador não identificado.',403);
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!['code','date','idempotencyKey'].includes(k)))return deny('gate_input','Confira o código.',400);
  const input=value as {code:unknown;date:unknown;idempotencyKey:unknown},code=parseCountingCode(input.code),key=input.idempotencyKey;
  if(typeof input.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(input.date))return deny('gate_input','Confira a data da entrada.',400);
  if(typeof key!=='string'||! /^[A-Za-z0-9:_-]{1,100}$/.test(key))return deny('gate_input','Tentativa inválida.',400);
  const hash=createHash('sha256').update(JSON.stringify({code,date:input.date})).digest('hex'),park=getOperationalParkId();
  const client=await getIngressoSistemaDbPool().connect();
  try{
    await ensureOpsAuditLogTable(client,'postgres');
    // Match financial closure isolation so a concurrent close cannot freeze an older admission snapshot.
    await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`gate:${park}:${key}`]);
    const prior=(await client.query<{actor_cpf:string;request_hash:string;result:CountingAdmissionResult}>('SELECT actor_cpf,request_hash,result FROM contagem_entradas WHERE parque=$1 AND idempotency_key=$2',[park,key])).rows[0];
    if(prior){if(prior.actor_cpf!==actor.cpf)return deny('gate_attempt_forbidden','A tentativa pertence a outro operador.',403);if(prior.request_hash!==hash)return deny('gate_attempt_conflict','A tentativa pertence a outro código.');await client.query('COMMIT');return {...prior.result,replayed:true};}
    const {date,time}=getSaoPauloDateParts();if(input.date!==date)return deny('gate_date_changed','A data mudou. Abra a portaria de hoje e leia o ingresso novamente.');await lockOperationalDay(client,park,date);
    const voucher='number'in code?await getVoucherByNumber(client,code.number):(await getVouchersByIds(client,[code.voucherId],code.purchaseId))[0];
    if(!voucher)return deny('voucher_not_found','Ingresso não encontrado.',404);
    if(voucher.parque_operacional&&voucher.parque_operacional!==park)return deny('voucher_park_mismatch','Ingresso de outro parque.');
    const school=(await client.query('SELECT 1 FROM voucher v WHERE v.idvoucher=$1 AND (v.idescola IS NOT NULL OR EXISTS(SELECT 1 FROM agenda_extras ae WHERE ae.idagenda=v.idagenda))',[voucher.idvoucher])).rowCount;
    if(school||!['norma','infan','isent','corte'].includes(voucher.tpvoucher??'')||voucher.servico_id!=null||!['padra','promo'].includes(voucher.tpagenda??''))return deny('gate_admission_only','Este QR não é uma entrada de day use. Confira o passeio ou serviço no painel.');
    if(voucher.stusado==='inv')return deny('voucher_invalidated','Ingresso invalidado. Entrada não autorizada.');
    if(voucher.stusado!=='n')throw alreadyUsedError(voucher);
    if(isVoucherExpired(voucher,date))return deny('voucher_expired','Ingresso fora da validade. Entrada não autorizada.');
    if(voucher.stcompra!=='conc'||!['ponli','bilhe','reser'].includes(voucher.tpcompra??'')||(voucher.tpcompra==='ponli'&&!isOnlinePurchasePaid(voucher))||(voucher.tpcompra==='reser'&&!isReservationPaid(voucher)))return deny('voucher_payment_pending','Pagamento não confirmado. Procure a bilheteria.');
    await markVoucherUsed(client,voucher.idvoucher,date,time,{kind:'gate',park,date},actor);
    const result:CountingAdmissionResult={admitted:true,replayed:false,voucherId:voucher.idvoucher,purchaseId:voucher.idcompra!,number:voucher.numvoucher??String(voucher.idvoucher),date,time,actorName:actor.name??'Operador',category:voucher.tpvoucher!};
    await registerOpsAuditLog(client,{origem:'portaria',acao:'validar',compraId:voucher.idcompra,descricao:`Entrada do voucher #${voucher.idvoucher}.`,motivo:'Leitura na portaria',usuarioNome:actor.name,detalhes:{voucherId:voucher.idvoucher,actorCpf:actor.cpf,park,date,time,via:'contagem',before:{used:voucher.stusado},after:{used:'s'}}},'postgres');
    await client.query('INSERT INTO contagem_entradas(parque,idempotency_key,actor_cpf,request_hash,result) VALUES($1,$2,$3,$4,$5::jsonb)',[park,key,actor.cpf,hash,JSON.stringify(result)]);
    await client.query('COMMIT');return {...result,warnings:await appendTicketWarnings([],'validate',[{purchaseId:result.purchaseId,voucherId:result.voucherId}])};
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
