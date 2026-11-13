import {beforeEach,describe,expect,it,vi} from 'vitest';
const mock=vi.hoisted(()=>({query:vi.fn()}));
vi.mock('./painel-operational-catalog',()=>({getOperationalCatalogPool:()=>mock}));
import {authenticateOwner,ownerAccessForToken} from './owner-access';
import {createOwnerSessionToken} from './owner-session';
describe('explicit owner grants',()=>{
 beforeEach(()=>vi.clearAllMocks());
 it('reads the current grant each time, so revocation takes effect during a session',async()=>{
  const token=createOwnerSessionToken('52998224725');mock.query.mockResolvedValueOnce({rows:[{cpf:'52998224725',name:'Dona',parks:['rincao']}]}).mockResolvedValueOnce({rows:[]});
  expect((await ownerAccessForToken(token))?.parks).toEqual(['rincao']);expect(await ownerAccessForToken(token)).toBeNull();expect(mock.query).toHaveBeenCalledTimes(2);
  expect(mock.query.mock.calls.every(([sql])=>sql.startsWith('SELECT')&&sql.includes("a.ativo AND u.stusuario='ati'"))).toBe(true);
 });
 it('does not choose between ambiguous email accounts and never updates the user on login',async()=>{
  mock.query.mockResolvedValue({rows:[{cpf:'1',parks:['rincao']},{cpf:'2',parks:['rincao']}]});
  expect(await authenticateOwner('owner@example.test','example')).toBeNull();expect(mock.query.mock.calls[0][0]).toContain('LIMIT 2');expect(mock.query.mock.calls[0][0]).not.toContain('UPDATE');
 });
 it('rejects malformed session or oversized credentials before the database',async()=>{
  expect(await ownerAccessForToken('invalid')).toBeNull();expect(await authenticateOwner('a'.repeat(255),'example')).toBeNull();expect(mock.query).not.toHaveBeenCalled();
 });
});
