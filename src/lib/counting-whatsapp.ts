import {getIngressoSistemaDbPool} from './ingresso-db';
import {getOperationalParkId} from './operational-day-contract';
import {getCountingSlip} from './counting-slip';
import {getCountingSignature} from './trip-counting';
import {countingSlipText,countingTotals} from './counting-slip-contract';
import {renderCountingImages} from './counting-export';
import {TripCountingError,type CountingActor} from './trip-counting-contract';
import {countingWhatsappConfig,CountingWhatsappProviderError,sendCountingWhatsappPage,verifyCountingWhatsappTemplate} from './counting-whatsapp-provider';

export type CountingWhatsappStatus={status:'sending'|'accepted'|'failed'|'uncertain';pages:number;accepted:number};
async function readStatus(revisionId:string):Promise<CountingWhatsappStatus|null>{
 const result=await getIngressoSistemaDbPool().query<CountingWhatsappStatus>('SELECT status,pages,jsonb_array_length(provider_ids) AS accepted FROM contagem_whatsapp_envios WHERE parque=$1 AND revision_id=$2',[getOperationalParkId(),revisionId]);
 return result.rows[0]??null;
}
export async function getCountingWhatsappStatus(revisionId:string,actor:CountingActor){
 await getCountingSlip(revisionId,actor);
 if(!countingWhatsappConfig())return {enabled:false,attempt:null};
 return {enabled:true,attempt:await readStatus(revisionId)};
}
export async function sendCountingWhatsapp(revisionId:string,actor:CountingActor){
 const slip=await getCountingSlip(revisionId,actor),config=countingWhatsappConfig();
 if(!config)throw new TripCountingError('whatsapp_disabled','Envio pelo WhatsApp indisponível neste ambiente.',503);
 const prior=await readStatus(revisionId);if(prior)return prior;
 const raw=slip.draft.responsible.phone.replace(/\D/g,''),recipient=raw.length===10||raw.length===11?`55${raw}`:raw;
 if(!slip.draft.responsible.confirmed||!config.allowed.includes(recipient))throw new TripCountingError('whatsapp_recipient','Este responsável não é um destinatário autorizado para teste em homologação.',403);
 await verifyCountingWhatsappTemplate(config);
 const signature=await getCountingSignature(revisionId,actor),images=await renderCountingImages('Filipeta de contagem',`${slip.clientName} · ${slip.date}`,[{text:countingSlipText(slip,'whatsapp')},{text:'Assinatura do responsável',image:signature.bytes}]);
 if(!images.length||images.length>100||images.some(image=>image.length>5*1024*1024))throw new TripCountingError('whatsapp_document','Filipeta excede o limite de envio pelo WhatsApp.',422);
 const pool=getIngressoSistemaDbPool(),park=getOperationalParkId();
 // Persist the claim before contacting Meta; an interrupted attempt must not be resent blindly.
 const claim=await pool.query(`INSERT INTO contagem_whatsapp_envios(parque,revision_id,actor_cpf,recipient,status,pages) VALUES($1,$2,$3,$4,'sending',$5) ON CONFLICT(parque,revision_id) DO NOTHING RETURNING revision_id`,[park,revisionId,actor.cpf,recipient,images.length]);
 if(!claim.rowCount)return (await readStatus(revisionId))!;
 const ids:string[]=[];
 let status:CountingWhatsappStatus['status']='accepted';
 try{
  for(let page=0;page<images.length;page++){
   ids.push(await sendCountingWhatsappPage(config,recipient,images[page],[slip.draft.responsible.name,slip.clientName,slip.date.split('-').reverse().join('/'),`${slip.type==='bus'?'Ônibus':'Van'} ${slip.ordinal}`,String(countingTotals(slip.draft).total),`${page+1} de ${images.length}`]));
   await pool.query('UPDATE contagem_whatsapp_envios SET provider_ids=$3::jsonb,updated_at=clock_timestamp() WHERE parque=$1 AND revision_id=$2',[park,revisionId,JSON.stringify(ids)]);
  }
 }catch(error){status=error instanceof CountingWhatsappProviderError&&!error.uncertain?'failed':'uncertain';}
 await pool.query('UPDATE contagem_whatsapp_envios SET status=$3,provider_ids=$4::jsonb,updated_at=clock_timestamp() WHERE parque=$1 AND revision_id=$2',[park,revisionId,status,JSON.stringify(ids)]);
 return {status,pages:images.length,accepted:ids.length};
}
