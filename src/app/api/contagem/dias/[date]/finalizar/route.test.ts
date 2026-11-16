import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { POST as close } from './route';
import { POST as share } from '@/app/api/contagem/filipetas/[revisionId]/envios/route';
const mocks=vi.hoisted(()=>({close:vi.fn(),share:vi.fn(),authorize:vi.fn()}));
vi.mock('@/lib/counting-day-closure',()=>({changeCountingDayClosure:mocks.close}));
vi.mock('@/lib/counting-manual-share',()=>({recordCountingShare:mocks.share,getCountingShare:vi.fn()}));
vi.mock('@/lib/trip-counting-route',()=>({readCountingBody:(request:Request)=>request.json(),runCountingRoute:async(_request:Request,run:(actor:unknown)=>Promise<Response>)=>{mocks.authorize();return run({cpf:'52998224725',name:'Monitor',manager:false});}}));
beforeEach(()=>{vi.clearAllMocks();mocks.close.mockResolvedValue({closed:true});mocks.share.mockResolvedValue({action:'opened'});});
afterEach(()=>vi.unstubAllEnvs());
const routes=[['closure',(request:Request)=>close(request,{params:Promise.resolve({date:'2026-11-16'})})],['manual sharing',(request:Request)=>share(request,{params:Promise.resolve({revisionId:'revision'})})]] as const;
describe.each(routes)('%s public origin',(_name,post)=>{
 it('accepts the configured public origin when the reverse proxy uses an internal URL',async()=>{vi.stubEnv('NEXT_PUBLIC_SITE_URL','https://rincao.example');const response=await post(new Request('http://127.0.0.1:3000/api/contagem',{method:'POST',headers:{origin:'https://rincao.example','content-type':'application/json'},body:'{}'}));expect(response.status).toBe(200);expect(mocks.authorize).toHaveBeenCalledOnce();});
 it('rejects foreign origins before authorization and persistence',async()=>{vi.stubEnv('NEXT_PUBLIC_SITE_URL','https://rincao.example');const response=await post(new Request('http://127.0.0.1:3000/api/contagem',{method:'POST',headers:{origin:'https://foreign.example','content-type':'application/json'},body:'{}'}));expect(response.status).toBe(403);expect(mocks.authorize).not.toHaveBeenCalled();expect(mocks.close).not.toHaveBeenCalled();expect(mocks.share).not.toHaveBeenCalled();});
 it('falls back to the request origin when no public URL is configured',async()=>{vi.stubEnv('NEXT_PUBLIC_SITE_URL','');const response=await post(new Request('http://localhost:3000/api/contagem',{method:'POST',headers:{origin:'http://localhost:3000','content-type':'application/json'},body:'{}'}));expect(response.status).toBe(200);});
});
