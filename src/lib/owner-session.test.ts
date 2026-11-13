import {afterEach,describe,expect,it,vi} from 'vitest';
import {createOwnerSessionToken,verifyOwnerSessionToken,ownerRequestSameOrigin} from './owner-session';
import {createOperationsSessionToken,verifyOperationsSessionToken} from './ops-session';
describe('isolated owners session',()=>{
 afterEach(()=>vi.useRealTimers());
 it('does not authorize operations in either direction or accept tampering',()=>{
  const token=createOwnerSessionToken('52998224725');
  expect(verifyOwnerSessionToken(token)?.cpf).toBe('52998224725');
  expect(verifyOperationsSessionToken(token)).toBeNull();
  expect(verifyOwnerSessionToken(createOperationsSessionToken({actorCpf:'52998224725'}))).toBeNull();
  expect(verifyOwnerSessionToken(token+'x')).toBeNull();expect(verifyOwnerSessionToken(token+'.extra')).toBeNull();expect(verifyOwnerSessionToken(token.split('.')[0]+'.'+'é'.repeat(43))).toBeNull();
 });
 it('expires sessions and rejects malformed identity',()=>{
  vi.useFakeTimers();const token=createOwnerSessionToken('52998224725');vi.advanceTimersByTime(8*3600*1000);expect(verifyOwnerSessionToken(token)).toBeNull();
  expect(()=>createOwnerSessionToken('other')).toThrow();
 });
 it('validates browser origin against the received Host behind the Next local runtime',()=>{
  expect(ownerRequestSameOrigin(new Request('http://localhost:3086/api/donos/session',{headers:{host:'127.0.0.1:3086',origin:'http://127.0.0.1:3086'}}))).toBe(true);
  expect(ownerRequestSameOrigin(new Request('http://internal:8062/api/donos/session',{headers:{host:'cluberincao.questione.ai',origin:'https://cluberincao.questione.ai'}}))).toBe(true);
  for(const origin of ['https://evil.test','null','http://127.0.0.1:3086/extra'])expect(ownerRequestSameOrigin(new Request('http://localhost:3086/api/donos/session',{headers:{host:'127.0.0.1:3086',origin}}))).toBe(false);
 });

});
