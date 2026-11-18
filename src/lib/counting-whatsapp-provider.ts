import {getOperationalParkId} from './operational-day-contract';
import {TripCountingError} from './trip-counting-contract';

const phoneId='1181013351750839',templateId='2331364014325836',templateName='rincao_filipeta_contagem_v1';
export const countingWhatsappBody='Olá, {{1}}. Segue a filipeta da contagem do passeio de {{2}} no Clube e Park Rincão, em {{3}}.\n\nVeículo: {{4}}.\nTotal registrado: {{5}} pessoas.\nPágina do registro: {{6}}.\n\nGuarde esta filipeta para conferir os dados da contagem com nossa equipe.';
type Config={token:string;allowed:string[]};
export function countingWhatsappConfig():Config|null{
 if(process.env.COUNTING_WHATSAPP_ENABLED!=='true')return null;
 const token=process.env.COUNTING_WHATSAPP_ACCESS_TOKEN?.trim(),allowed=(process.env.COUNTING_WHATSAPP_ALLOWED_NUMBERS??'').split(',').map(p=>p.trim()).filter(Boolean);
 // This rollout is restricted to the verified Rincão HML channel and test recipients.
 if(getOperationalParkId()!=='rincao'||process.env.INGRESSO_TICKET_API_WHATSAPP_TESTING!=='true'||!token||!allowed.length||allowed.some(p=>!/^55\d{10,11}$/.test(p)))throw new TripCountingError('whatsapp_config','Envio pelo WhatsApp indisponível neste ambiente.',503);
 return {token,allowed};
}
export class CountingWhatsappProviderError extends Error{
 constructor(readonly uncertain:boolean){super('Não foi possível confirmar o envio pela Meta.');}
}
async function graph(config:Config,path:string,init:RequestInit={},sending=false):Promise<Record<string,unknown>>{
 let response:Response;
 try{response=await fetch(`https://graph.facebook.com/v25.0/${path}`,{...init,headers:{...init.headers,Authorization:`Bearer ${config.token}`},signal:AbortSignal.timeout(20000),cache:'no-store',redirect:'error'});}catch{throw new CountingWhatsappProviderError(sending);}
 if(!response.ok)throw new CountingWhatsappProviderError(sending&&response.status>=500);
 try{return await response.json();}catch{throw new CountingWhatsappProviderError(sending);}
}
export async function verifyCountingWhatsappTemplate(config:Config){
 const template=await graph(config,`${templateId}?fields=name,status,category,language,components`);
 if(template.status!=='APPROVED')throw new TripCountingError('whatsapp_template_pending','O template da filipeta ainda está em análise ou indisponível na Meta. O compartilhamento manual continua disponível.',409);
 const components=template.components as {type:string;format?:string;text?:string}[]|undefined;
 if(template.name!==templateName||template.language!=='pt_BR'||template.category!=='UTILITY'||!Array.isArray(components)||!components.some(c=>c.type==='HEADER'&&c.format==='IMAGE')||!components.some(c=>c.type==='BODY'&&c.text===countingWhatsappBody))throw new TripCountingError('whatsapp_template_changed','O template da Meta precisa ser conferido antes do envio.',409);
}
export async function sendCountingWhatsappPage(config:Config,recipient:string,image:Buffer,parameters:string[]){
 if(!config.allowed.includes(recipient))throw new TripCountingError('whatsapp_recipient','Este responsável não é um destinatário autorizado para teste em homologação.',403);
 if(parameters.length!==6||image.length>5*1024*1024)throw new TripCountingError('whatsapp_document','Filipeta incompatível com o envio pelo WhatsApp.',422);
 const form=new FormData();form.set('messaging_product','whatsapp');form.set('file',new Blob([new Uint8Array(image)],{type:'image/png'}),'filipeta.png');
 const media=await graph(config,`${phoneId}/media`,{method:'POST',body:form});
 if(typeof media.id!=='string'||!/^\d+$/.test(media.id))throw new CountingWhatsappProviderError(false);
 const result=await graph(config,`${phoneId}/messages`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messaging_product:'whatsapp',to:recipient,type:'template',template:{name:templateName,language:{code:'pt_BR'},components:[{type:'header',parameters:[{type:'image',image:{id:media.id}}]},{type:'body',parameters:parameters.map(text=>({type:'text',text:text.replace(/\s+/g,' ').trim()}))}]}})},true);
 const messages=result.messages as {id?:unknown}[]|undefined,id=messages?.[0]?.id;
 if(typeof id!=='string'||!id.startsWith('wamid.'))throw new CountingWhatsappProviderError(true);
 return id;
}
