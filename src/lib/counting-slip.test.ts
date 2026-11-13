import {describe,expect,it} from 'vitest';
import {countingTotals,countingSlipText} from './counting-slip-contract';
import {emptyCountDraft} from './trip-counting-contract';
describe('counting slip totals',()=>{
  it('counts PCD once and separates participants and team',()=>{
    const draft=emptyCountDraft();draft.counts={coordinator:2,pcdChild:1,pcdAdult:1,pcdCompanion:1,teacherChild:1,adult:3,child:4,exempt:1};
    expect(countingTotals(draft)).toEqual({participants:11,team:3,total:14,pcd:2});
    const text=countingSlipText({revisionId:'r',vehicleId:1,clientName:'Escola',date:'2026-11-13',type:'bus',ordinal:1,transportName:null,groupType:'school',ownerName:'A',startedAt:null,completedAt:null,draft,signatureUrl:null,legacyContext:false});
    expect(text).toContain('14 pessoas');expect(text).toContain('Ainda não finalizada');
  });
});
