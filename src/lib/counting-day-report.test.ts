import {it,expect} from 'vitest';
import {countingReportTotals,countingDayReportText,type CountingDayReport} from './counting-day-report-contract';
import {emptyCountDraft} from './trip-counting-contract';
it('keeps school participants out of day use and kitchen contacts private',()=>{
 const draft=emptyCountDraft();draft.counts={coordinator:2,pcdChild:1,pcdAdult:1,pcdCompanion:1,teacherChild:1,adult:3,child:4,exempt:1};draft.notes='Sem lactose';draft.responsible={name:'Responsável privado',phone:'5511999999999',confirmed:true};
 const report:CountingDayReport={date:'2026-11-13',generatedAt:'now',fingerprint:'f',dayUse:{date:'2026-11-13',sold:10,admitted:5,expected:5},groups:[{agendaId:1,clientId:2,name:'Escola',plannedPeople:10,foodNotes:'Sem glúten',transportName:null,pending:[{vehicleId:2,label:'Van 1',state:'waiting'}],slips:[{revisionId:'r',vehicleId:1,clientName:'Escola',date:'2026-11-13',type:'bus',ordinal:1,transportName:null,groupType:'school',ownerName:'A',startedAt:null,completedAt:'now',draft,signatureUrl:'/signature',legacyContext:false}]}]};
 expect(countingReportTotals(report)).toMatchObject({total:19,trips:14,participants:11,team:3,pcd:2,pending:1});
 const kitchen=countingDayReportText(report,'kitchen');expect(kitchen).toContain('14 refeições');expect(kitchen).toContain('Sem lactose');expect(kitchen).toContain('Sem glúten');expect(kitchen).toContain('não contado');expect(kitchen).not.toContain(draft.responsible.phone);expect(kitchen).not.toContain(draft.responsible.name);
 expect(countingDayReportText(report,'general',2)).toContain('19 pessoas');
});
