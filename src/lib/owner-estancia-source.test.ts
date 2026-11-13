import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
const mock=vi.hoisted(()=>({withOwnerSource:vi.fn()}));
vi.mock('./owner-sources',()=>({withOwnerSource:mock.withOwnerSource}));
import {readEstanciaOwnerDays} from './owner-estancia-source';
const row={date:'2026-11-13',site:'1000',gate:'2000',unreconciled:'0',admitted:'4',unknownAdmissions:'0',scheduled:true,schoolDay:false};
const range={start:row.date,end:row.date};
describe('Estância source coverage',()=>{
 beforeEach(()=>{vi.clearAllMocks();vi.stubEnv('OWNER_ESTANCIA_START_DATE','2026-11-01');});afterEach(()=>vi.unstubAllEnvs());
 it('leaves costs and result unavailable even when sales are complete',async()=>{
  mock.withOwnerSource.mockResolvedValueOnce([row]).mockResolvedValueOnce([{...row,site:'0',gate:'0',admitted:'0',scheduled:false}]);
  expect((await readEstanciaOwnerDays(range))[0]).toMatchObject({revenueCents:3000,attendance:4,costCents:null,resultCents:null,state:'open'});
 });
 it('retains an identified subtotal when school source is unavailable',async()=>{
  mock.withOwnerSource.mockResolvedValueOnce([row]).mockRejectedValueOnce(new Error('offline'));
  expect((await readEstanciaOwnerDays(range))[0]).toMatchObject({revenueCents:null,knownRevenueCents:3000,attendance:null,knownAttendance:4});
 });
 it('does not call online school payments the final trip total or assume complete attendance',async()=>{
  mock.withOwnerSource.mockResolvedValueOnce([row]).mockResolvedValueOnce([{...row,site:'7000',gate:'0',admitted:'2',schoolDay:true}]);
  expect((await readEstanciaOwnerDays(range))[0]).toMatchObject({revenueCents:null,knownRevenueCents:10000,attendance:null,knownAttendance:6,tripAttendance:null});
 });
 it('labels reconstructed history as unconfirmed and never labels old cash closes as daily closure',async()=>{
  vi.stubEnv('OWNER_ESTANCIA_START_DATE','2026-11-14');mock.withOwnerSource.mockResolvedValue([row]);
  expect((await readEstanciaOwnerDays(range))[0]).toMatchObject({state:'legacy',revenueCents:null,attendance:null,revision:null});
 });
});
