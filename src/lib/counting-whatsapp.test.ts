import {afterEach,describe,expect,it,vi} from 'vitest';
import {countingWhatsappConfig,sendCountingWhatsappPage,verifyCountingWhatsappTemplate} from './counting-whatsapp-provider';

afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
function config(){
 vi.stubEnv('COUNTING_WHATSAPP_ENABLED','true');vi.stubEnv('OPERATIONAL_PARK_ID','rincao');
 vi.stubEnv('INGRESSO_TICKET_API_WHATSAPP_TESTING','true');vi.stubEnv('COUNTING_WHATSAPP_ACCESS_TOKEN','test-token');
 vi.stubEnv('COUNTING_WHATSAPP_ALLOWED_NUMBERS','5511999990001');
 return countingWhatsappConfig()!;
}
describe('filipeta WhatsApp provider',()=>{
 it('stays off without explicit HML configuration',()=>{vi.stubEnv('COUNTING_WHATSAPP_ENABLED','');expect(countingWhatsappConfig()).toBeNull();config();vi.stubEnv('INGRESSO_TICKET_API_WHATSAPP_TESTING','false');expect(()=>countingWhatsappConfig()).toThrow();});
 it('requires the Rincão park and a test recipient allowlist',()=>{config();vi.stubEnv('OPERATIONAL_PARK_ID','estancia');expect(()=>countingWhatsappConfig()).toThrow();vi.stubEnv('OPERATIONAL_PARK_ID','rincao');vi.stubEnv('COUNTING_WHATSAPP_ALLOWED_NUMBERS','');expect(()=>countingWhatsappConfig()).toThrow();});
 it('does not send until the approved image template matches',async()=>{const cfg=config();const fetch=vi.fn().mockResolvedValue(Response.json({name:'rincao_filipeta_contagem_v1',language:'pt_BR',status:'PENDING'}));vi.stubGlobal('fetch',fetch);await expect(verifyCountingWhatsappTemplate(cfg)).rejects.toThrow('análise');expect(fetch).toHaveBeenCalledTimes(1);});
 it('uploads privately and sends the image ID and six variables from the chosen channel',async()=>{
  const cfg=config(),fetch=vi.fn().mockResolvedValueOnce(Response.json({id:'123456'})).mockResolvedValueOnce(Response.json({messages:[{id:'wamid.test'}]}));vi.stubGlobal('fetch',fetch);
  expect(await sendCountingWhatsappPage(cfg,'5511999990001',Buffer.from('png'),['Responsável','Grupo','18/11/2026','Ônibus 1','30','1 de 1'])).toBe('wamid.test');
  expect(fetch.mock.calls[0][0]).toBe('https://graph.facebook.com/v25.0/1181013351750839/media');
  const payload=JSON.parse(fetch.mock.calls[1][1].body);expect(payload.to).toBe('5511999990001');expect(payload.template.name).toBe('rincao_filipeta_contagem_v1');expect(payload.template.components[0].parameters[0]).toEqual({type:'image',image:{id:'123456'}});expect(payload.template.components[1].parameters).toHaveLength(6);
 });
 it('blocks a different recipient before uploading',async()=>{const cfg=config(),fetch=vi.fn();vi.stubGlobal('fetch',fetch);await expect(sendCountingWhatsappPage(cfg,'5511999999999',Buffer.from('png'),[])).rejects.toThrow('autorizado');expect(fetch).not.toHaveBeenCalled();});
 it('does not retry an ambiguous message request',async()=>{const cfg=config(),fetch=vi.fn().mockResolvedValueOnce(Response.json({id:'123456'})).mockRejectedValueOnce(new Error('timeout'));vi.stubGlobal('fetch',fetch);await expect(sendCountingWhatsappPage(cfg,'5511999990001',Buffer.from('png'),['a','b','c','d','e','f'])).rejects.toMatchObject({uncertain:true});expect(fetch).toHaveBeenCalledTimes(2);});
 it('does not expose provider errors or tokens',async()=>{const cfg=config(),fetch=vi.fn().mockResolvedValue(Response.json({error:{code:190,message:'private-token'}},{status:401}));vi.stubGlobal('fetch',fetch);await expect(verifyCountingWhatsappTemplate(cfg)).rejects.toThrow('Meta');await expect(verifyCountingWhatsappTemplate(cfg)).rejects.not.toThrow('private-token');});
});
