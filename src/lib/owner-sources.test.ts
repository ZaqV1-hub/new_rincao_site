import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
const mock=vi.hoisted(()=>({query:vi.fn(),release:vi.fn(),connect:vi.fn(),readEstancia:vi.fn()}));
vi.mock('pg',()=>({Pool:class {connect=mock.connect;}}));
vi.mock('./owner-estancia-source',()=>({readEstanciaOwnerDays:mock.readEstancia}));
import {withOwnerSource,getOwnerDashboard} from './owner-sources';
import {ownerPeriod} from './owner-dashboard';
describe('owner source credentials and tenant isolation',()=>{
 beforeEach(()=>{vi.clearAllMocks();vi.stubEnv('OWNER_RINCAO_READ_DATABASE_URL','postgres://reader:synthetic@127.0.0.1:54422/test');vi.stubEnv('OWNER_RINCAO_EXPECTED_DATABASE','test');mock.connect.mockResolvedValue({query:mock.query,release:mock.release});});afterEach(()=>vi.unstubAllEnvs());
 it.each([{unsafe:true,database:'test'},{unsafe:false,database:'foreign'}])('rejects a writer credential or a different database before reading aggregates',async permission=>{
  mock.query.mockResolvedValueOnce({rows:[]}).mockResolvedValueOnce({rows:[permission]}).mockResolvedValue({rows:[]});const read=vi.fn();
  await expect(withOwnerSource('rincao',read)).rejects.toThrow();expect(read).not.toHaveBeenCalled();expect(mock.query).toHaveBeenCalledWith('ROLLBACK');expect(mock.release).toHaveBeenCalled();
 });
 it('reads in a read-only coherent transaction and does not reuse an operational fallback',async()=>{
  mock.query.mockResolvedValueOnce({rows:[]}).mockResolvedValueOnce({rows:[{unsafe:false,database:'test'}]}).mockResolvedValue({rows:[]});
  expect(await withOwnerSource('rincao',async()=>7)).toBe(7);expect(mock.query).toHaveBeenCalledWith('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  vi.stubEnv('OWNER_RINCAO_EXPECTED_DATABASE','');await expect(withOwnerSource('rincao',async()=>7)).rejects.toThrow();
 });
 it('does not query a park outside the requested authorization',async()=>{
  mock.readEstancia.mockResolvedValue([]);await getOwnerDashboard(ownerPeriod('day','2026-11-13','2026-11-13'),['estancia']);expect(mock.connect).not.toHaveBeenCalled();expect(mock.readEstancia).toHaveBeenCalledTimes(1);
 });
 it('keeps the other park available when one connection fails',async()=>{
  mock.connect.mockRejectedValue(new Error('offline'));mock.readEstancia.mockResolvedValue([{park:'estancia',date:'2026-11-13',revenueCents:123}]);
  const data=await getOwnerDashboard(ownerPeriod('day','2026-11-13','2026-11-13'),['rincao','estancia']);expect(data.days.find(d=>d.park==='estancia')?.revenueCents).toBe(123);expect(data.days.filter(d=>d.park==='rincao').every(d=>d.revenueCents===null)).toBe(true);
 });
});
