import {beforeEach,describe,expect,it,vi} from 'vitest';
import {POST} from './route';
const mocks=vi.hoisted(()=>({access:vi.fn(),admit:vi.fn()}));
vi.mock('@/lib/painel-api-auth',()=>({requirePainelApiAccess:mocks.access}));
vi.mock('@/lib/counting-admission',()=>({admitCountingVoucher:mocks.admit}));
beforeEach(()=>{vi.clearAllMocks();mocks.access.mockResolvedValue({ok:true,session:{actorCpf:'52998224725',actorName:'A'}});mocks.admit.mockResolvedValue({admitted:true});});
describe('gate route authorization',()=>{
  const request=(origin='https://site.test')=>new Request('https://site.test/api/contagem/entradas',{method:'POST',headers:{'Content-Type':'application/json',origin},body:JSON.stringify({code:'1-2',idempotencyKey:'test'})});
  it('uses gate permission and identity exclusively from session',async()=>{const response=await POST(request());expect(response.status).toBe(200);expect(mocks.access).toHaveBeenCalledWith(expect.any(Request),'vis_portaria');expect(mocks.admit).toHaveBeenCalledWith({code:'1-2',idempotencyKey:'test'},{name:'A',cpf:'52998224725'});expect(response.headers.get('Cache-Control')).toContain('no-store');});
  it('returns invalid JSON as a definitive 400',async()=>{const response=await POST(new Request('https://site.test/api/contagem/entradas',{method:'POST',headers:{'Content-Type':'application/json'},body:'{'}));expect(response.status).toBe(400);expect(mocks.admit).not.toHaveBeenCalled();});
  it('denies foreign origin before admission',async()=>{expect((await POST(request('https://else.test'))).status).toBe(403);expect(mocks.admit).not.toHaveBeenCalled();});
  it('does not accept a session without the gate resource',async()=>{mocks.access.mockResolvedValue({ok:false,response:new Response(null,{status:403})});const response=await POST(request());expect(response.status).toBe(403);expect(response.headers.get('Cache-Control')).toContain('no-store');expect(mocks.admit).not.toHaveBeenCalled();});
});
