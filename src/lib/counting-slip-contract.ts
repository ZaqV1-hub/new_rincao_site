import { COUNT_CATEGORIES,countCategories,type CountDraft } from './trip-counting-contract';
export type CountingSlip={revisionId:string;vehicleId:number;clientName:string;date:string;type:'bus'|'van';ordinal:number;transportName:string|null;groupType:'school'|'group'|null;ownerName:string|null;startedAt:string|null;completedAt:string|null;draft:CountDraft;signatureUrl:string|null;legacyContext:boolean};
export function countingTotals(draft:CountDraft){const c=draft.counts,team=(c.coordinator??0)+(c.pcdCompanion??0),total=countCategories.reduce((sum,key)=>sum+(c[key]??0),0);return {participants:total-team,team,total,pcd:(c.pcdChild??0)+(c.pcdAdult??0)};}
export function countingTime(value:string|null){return value?new Date(value).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'}):'Não registrado';}
export function countingSlipText(slip:CountingSlip){const {draft}=slip,t=countingTotals(draft);return [
  'Clube e Park Rincão · Filipeta de contagem',slip.clientName,`${slip.type==='bus'?'Ônibus':'Van'} ${slip.ordinal} · ${slip.date.split('-').reverse().join('/')}`,
  `${t.total} pessoas · ${t.participants} participantes · ${t.team} professores e acompanhantes`,
  ...countCategories.map(key=>`${key==='coordinator'&&slip.groupType==='group'?'Coordenador do grupo':COUNT_CATEGORIES[key].label}: ${draft.counts[key]??'não informado'}`),
  ...draft.pcdDetails.map(d=>`${d.category==='pcdChild'?'Criança':'Adulto'} PCD · ${d.description}: ${d.quantity}`),
  `Observações: ${draft.notes||'Nenhuma informada'}`,`Contado por: ${slip.ownerName??'Não registrado'}`,`Início: ${countingTime(slip.startedAt)} · Fim: ${countingTime(slip.completedAt)}`,
  `Responsável: ${draft.responsible.name}`,`WhatsApp: ${draft.responsible.phone}`,
  slip.completedAt?'Contagem finalizada. Compartilhamento manual; entrega não confirmada.':'Ainda não finalizada nem enviada',
  ...(slip.legacyContext?['Cabeçalho consultado no cadastro atual; contagem histórica preservada.']:[])
].join('\n');}
