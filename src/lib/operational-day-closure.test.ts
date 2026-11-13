import {describe,it,expect,vi} from 'vitest';
import {getOperationalDayClosure,getOperationalDayRevision,changeOperationalDayClosure} from './operational-day-closure';
import {safeSpreadsheetText} from './operational-day-export';
vi.mock('@/lib/ingresso-db',()=>({getIngressoSistemaDbPool:()=>{throw new Error('Unexpected database access');},getIngressoSistemaDbDialect:()=> 'postgres'}));
const actor={cpf:'52998224725',name:'Gerente',manager:true},input={action:'close',fingerprint:'a'.repeat(64),idempotencyKey:'day-test',reason:'',acknowledgeWarnings:false,counts:[]};
describe('daily closure boundaries',()=>{
  it.each(['2026-02-30','2026-1-01','0000-01-01','2026-11-13T00:00:00Z'])('rejects an invalid date before database access: %s',async date=>{await expect(getOperationalDayClosure(date)).rejects.toMatchObject({code:'trip_invalid_input'});await expect(changeOperationalDayClosure(date,input,actor)).rejects.toMatchObject({code:'trip_invalid_input'});});
  it('requires a manager and rejects actor, park and snapshot overrides',async()=>{
    await expect(changeOperationalDayClosure('2026-11-13',input,{...actor,manager:false})).rejects.toMatchObject({status:403});
    for(const patch of [{park:'estancia'},{actor},{snapshot:{}},{action:'delete'},{fingerprint:'abc'},{idempotencyKey:'key with spaces'}])await expect(changeOperationalDayClosure('2026-11-13',{...input,...patch},actor)).rejects.toMatchObject({code:'trip_invalid_input'});
  });
  it('rejects malformed revision IDs',async()=>{await expect(getOperationalDayRevision('2026-11-13','../other')).rejects.toMatchObject({code:'trip_invalid_input'});});
  it.each(['=HYPERLINK("https://example.test")','+1+1','-1+1','@SUM(A1:A3)','\t =1+1'])('neutralizes spreadsheet text %s',value=>{expect(safeSpreadsheetText(value)).toBe(`'${value}`);});
  it('keeps ordinary text readable',()=>{expect(safeSpreadsheetText('Escola São João')).toBe('Escola São João');});
});
