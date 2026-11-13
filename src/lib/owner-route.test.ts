import {describe,expect,it,vi,beforeEach} from 'vitest';
const mock=vi.hoisted(()=>({requireOwner:vi.fn(),getOwnerDashboard:vi.fn()}));
vi.mock('./owner-access',()=>({requireOwner:mock.requireOwner,ownerPrivate:(r:Response)=>{r.headers.set('Cache-Control','private, no-store');return r;}}));
vi.mock('./owner-sources',()=>({getOwnerDashboard:mock.getOwnerDashboard}));
import {readOwnerQuery,ownerReadRoute} from './owner-route';
import {GET} from '../app/api/donos/resumo/route';
describe('owner read authorization and query boundaries',()=>{
 beforeEach(()=>vi.clearAllMocks());
 it('never loads sources for an anonymous or revoked owner',async()=>{
  mock.requireOwner.mockResolvedValue(null);const r=await GET(new Request('http://local/api/donos/resumo'));expect(r.status).toBe(401);expect(mock.getOwnerDashboard).not.toHaveBeenCalled();expect(r.headers.get('Cache-Control')).toBe('private, no-store');
 });
 it('scopes both to the granted parks and refuses a foreign park',()=>{
  expect(readOwnerQuery(new URLSearchParams('park=both&date=2026-01-01'),['rincao']).parks).toEqual(['rincao']);
  expect(()=>readOwnerQuery(new URLSearchParams('park=estancia&date=2026-01-01'),['rincao'])).toThrow();
 });
 it.each(['date=2026-01-01&date=2026-01-02','sql=SELECT','park=x','mode=week','date=2026-02-30'])('rejects untrusted query %s',query=>expect(()=>readOwnerQuery(new URLSearchParams(query),['rincao'])).toThrow());
 it('only exports explicit monthly formats',()=>{
  expect(()=>readOwnerQuery(new URLSearchParams('date=2026-01-01&mode=day&format=pdf'),['rincao'],true)).toThrow();
  expect(readOwnerQuery(new URLSearchParams('date=2026-01-01&mode=month&format=xlsx'),['rincao'],true).format).toBe('xlsx');
 });
 it('returns a private response and never includes account identity in aggregates',async()=>{
  mock.requireOwner.mockResolvedValue({cpf:'52998224725',name:'Dono',parks:['rincao']});mock.getOwnerDashboard.mockResolvedValue({parks:['rincao'],days:[]});
  const r=await ownerReadRoute(new Request('http://local/api/donos/resumo?date=2026-01-01'),false,async data=>Response.json(data));
  expect(r.status).toBe(200);expect(await r.text()).not.toContain('52998224725');expect(mock.getOwnerDashboard.mock.calls[0][1]).toEqual(['rincao']);
 });
});
