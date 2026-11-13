import type { CountingSlip } from './counting-slip-contract';
import { countingTotals } from './counting-slip-contract';
import {countCategories,COUNT_CATEGORIES,type CountCategory} from './trip-counting-contract';
import type {CountingAttendance} from './counting-attendance';
export type CountingReportGroup={agendaId:number;clientId:number;name:string;plannedPeople:number|null;transportName:string|null;foodNotes:string|null;slips:CountingSlip[];pending:{vehicleId:number;label:string;state:string}[]};
export type CountingDayReport={date:string;generatedAt:string;fingerprint:string;dayUse:CountingAttendance;groups:CountingReportGroup[]};
export function countingReportTotals(report:CountingDayReport){const counts=Object.fromEntries(countCategories.map(k=>[k,0])) as Record<CountCategory,number>;let participants=0,team=0,pcd=0,pending=0;
 for(const group of report.groups){pending+=group.pending.length+(group.slips.length===0&&group.pending.length===0?1:0);for(const slip of group.slips){const t=countingTotals(slip.draft);participants+=t.participants;team+=t.team;pcd+=t.pcd;for(const k of countCategories)counts[k]+=slip.draft.counts[k]??0;}}
 return {participants,team,pcd,counts,pending,trips:participants+team,total:participants+team+report.dayUse.admitted};
}
export function countingDayReportText(report:CountingDayReport,kind:'general'|'kitchen',version?:number){
 const t=countingReportTotals(report),kitchen=kind==='kitchen',lines=[`Clube e Park Rincão · ${kitchen?'Cozinha':'Contagem geral'} · ${report.date.split('-').reverse().join('/')} · ${version?`Revisão ${version}`:'Prévia não emitida'}`,
 kitchen?`${t.trips} refeições · ${t.participants} participantes · ${t.team} professores e acompanhantes`:`${t.total} pessoas contadas no parque · ${t.trips} em passeios · ${report.dayUse.admitted} day use`,
 ...(t.pending?[`${t.pending} veículo(s)/grupo(s) ainda sem contagem concluída. Total conhecido, sujeito a atualização.`]:[])];
 if(!kitchen)for(const k of countCategories)lines.push(`${COUNT_CATEGORIES[k].label}: ${t.counts[k]}`);
 for(const group of report.groups){lines.push('',group.name,`Previsto: ${group.plannedPeople??'não informado'} · Transporte: ${group.transportName??'não informado'}`);
   let participants=0,team=0,pcd=0;for(const slip of group.slips){const value=countingTotals(slip.draft);participants+=value.participants;team+=value.team;pcd+=value.pcd;
    if(!kitchen){lines.push(`${slip.type==='bus'?'Ônibus':'Van'} ${slip.ordinal}: ${value.total} pessoas · ${slip.ownerName??'Contador não registrado'}`,`Responsável: ${slip.draft.responsible.name} · ${slip.draft.responsible.phone}`);for(const k of countCategories)if(slip.draft.counts[k])lines.push(`${COUNT_CATEGORIES[k].label}: ${slip.draft.counts[k]}`);for(const pcd of slip.draft.pcdDetails)lines.push(`${pcd.category==='pcdChild'?'Criança':'Adulto'} PCD · ${pcd.description}: ${pcd.quantity}`);}
   }
   if(kitchen){if(group.slips.length)lines.push(`${participants} participantes + ${team} professores/acompanhantes = ${participants+team} refeições`,`Dos quais PCD: ${pcd}`);else lines.push('Ainda sem contagem concluída; refeições não apuradas.');if(group.foodNotes)lines.push(`Restrições do passeio: ${group.foodNotes}`);for(const slip of group.slips)if(slip.draft.notes)lines.push(`${slip.type==='bus'?'Ônibus':'Van'} ${slip.ordinal}: ${slip.draft.notes}`);if(!group.foodNotes&&!group.slips.some(s=>s.draft.notes))lines.push('Nenhuma restrição informada.');}
   for(const v of group.pending)lines.push(`${v.label}: não contado`);if(!group.slips.length&&!group.pending.length)lines.push('Grupo sem veículos cadastrados: contagem não informada.');
 }
 if(!kitchen)lines.push('',`Day use: ${report.dayUse.admitted} lidos · ${report.dayUse.sold} vendidos para a data`);
 return lines.join('\n');
}
