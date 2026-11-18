import {createHash} from 'node:crypto';
import type {PoolClient} from 'pg';
import {it,expect,vi} from 'vitest';
import {countingReportTotals,countingDayReportText,type CountingDayReport} from './counting-day-report-contract';
import {emptyCountDraft} from './trip-counting-contract';
import {readCountingDayReport} from './counting-day-report';
const {attendance}=vi.hoisted(()=>({attendance:vi.fn()}));
vi.mock('./trip-counting',()=>({readCountingDay:async()=>({groups:[]})}));
vi.mock('./counting-attendance',()=>({readCountingAttendance:attendance}));
it('preserves issued report fingerprints when day use offer availability changes',async()=>{
 const dayUse={date:'2026-11-13',sold:10,admitted:5,expected:5},facts={date:dayUse.date,dayUse,groups:[]};
 const fingerprint=createHash('sha256').update(JSON.stringify(facts)).digest('hex');
 const client={query:async()=>({rows:[]})} as unknown as PoolClient;
 for(const hasDayUse of [false,true]){
  attendance.mockResolvedValue({...dayUse,hasDayUse});
  const report=await readCountingDayReport(client,dayUse.date);
  expect(report.fingerprint).toBe(fingerprint);
  expect(report.dayUse).toEqual(dayUse);
 }
});
it('keeps school participants out of day use and kitchen contacts private',()=>{
 const draft=emptyCountDraft();draft.counts={coordinator:2,pcdChild:1,pcdAdult:1,pcdCompanion:1,teacherChild:1,adult:3,child:4,exempt:1};draft.notes='Sem lactose';draft.responsible={name:'Responsável privado',phone:'5511999999999',confirmed:true};
 const report:CountingDayReport={date:'2026-11-13',generatedAt:'now',fingerprint:'f',dayUse:{date:'2026-11-13',sold:10,admitted:5,expected:5},groups:[{agendaId:1,clientId:2,name:'Escola',plannedPeople:10,foodNotes:'Sem glúten',transportName:null,pending:[{vehicleId:2,label:'Van 1',state:'waiting'}],slips:[{revisionId:'r',vehicleId:1,clientName:'Escola',date:'2026-11-13',type:'bus',ordinal:1,transportName:null,groupType:'school',ownerName:'A',startedAt:null,completedAt:'now',draft,signatureUrl:'/signature',legacyContext:false}]}]};
 expect(countingReportTotals(report)).toMatchObject({total:19,trips:14,participants:11,team:3,pcd:2,pending:1});
 const kitchen=countingDayReportText(report,'kitchen');expect(kitchen).toContain('14 refeições');expect(kitchen).toContain('Sem lactose');expect(kitchen).toContain('Sem glúten');expect(kitchen).toContain('não contado');expect(kitchen).not.toContain(draft.responsible.phone);expect(kitchen).not.toContain(draft.responsible.name);
 expect(countingDayReportText(report,'general',2)).toContain('19 pessoas');
});
