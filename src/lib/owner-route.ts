import {ownerPeriod,type OwnerPark} from './owner-dashboard';
import {requireOwner,ownerPrivate} from './owner-access';
import {getOwnerDashboard} from './owner-sources';
import {getSaoPauloToday} from './operational-date';
export function readOwnerQuery(params:URLSearchParams,allowed:OwnerPark[],exporting=false){
 const keys=exporting?['mode','date','park','format']:['mode','date','park'];
 if([...params.keys()].some(k=>!keys.includes(k)||params.getAll(k).length!==1))throw new Error('Parâmetros inválidos.');
 const period=ownerPeriod(params.get('mode')||'day',params.get('date')||getSaoPauloToday());
 const selected=params.get('park')||'both';if(!['both','rincao','estancia'].includes(selected))throw new Error('Parque inválido.');
 const parks=selected==='both'?allowed:allowed.filter(p=>p===selected);if(!parks.length)throw new Error('Parque não autorizado.');
 const format=params.get('format');if(exporting&&(period.mode!=='month'||!['pdf','xlsx'].includes(format??'')))throw new Error('Escolha um mês e o formato PDF ou planilha.');
 return {period,parks,format};
}
export async function ownerReadRoute(request:Request,exporting:boolean,respond:(data:Awaited<ReturnType<typeof getOwnerDashboard>>,name:string,format:string|null)=>Promise<Response>){
 try{
  const access=await requireOwner(request);if(!access)return ownerPrivate(Response.json({ok:false,error:{message:'Entre com uma conta autorizada para consultar os parques.'}},{status:401}));
  let query;try{query=readOwnerQuery(new URL(request.url).searchParams,access.parks,exporting);}catch{return ownerPrivate(Response.json({ok:false,error:{message:'Período, parque ou formato inválido.'}},{status:400}));}
  return ownerPrivate(await respond(await getOwnerDashboard(query.period,query.parks),access.name,query.format));
 }catch{console.warn('[owners] read request failed');return ownerPrivate(Response.json({ok:false,error:{message:'Não foi possível consultar o painel agora.'}},{status:503}));}
}
