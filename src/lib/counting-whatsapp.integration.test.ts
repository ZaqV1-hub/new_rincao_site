import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {Pool} from 'pg';
import {afterAll,beforeAll,beforeEach,describe,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({pool:null as Pool|null,slip:vi.fn(),signature:vi.fn(),images:vi.fn(),verify:vi.fn(),send:vi.fn()}));
vi.mock('./ingresso-db',()=>({getIngressoSistemaDbPool:()=>mocks.pool}));
vi.mock('./counting-slip',()=>({getCountingSlip:mocks.slip}));
vi.mock('./trip-counting',()=>({getCountingSignature:mocks.signature}));
vi.mock('./counting-export',()=>({renderCountingImages:mocks.images}));
vi.mock('./counting-whatsapp-provider',async original=>({...await original<typeof import('./counting-whatsapp-provider')>(),verifyCountingWhatsappTemplate:mocks.verify,sendCountingWhatsappPage:mocks.send}));
import {sendCountingWhatsapp,getCountingWhatsappStatus} from './counting-whatsapp';
import {CountingWhatsappProviderError} from './counting-whatsapp-provider';
const connectionString=process.env.PANEL_TEST_DATABASE_URL;
if(connectionString){const url=new URL(connectionString);if(url.hostname!=='127.0.0.1'||url.pathname!=='/chargeback_test_painel'||url.search||url.hash)throw new Error('Use only the local test database');}
describe.skipIf(!connectionString)('filipeta sending persistence',()=>{
 const schema=`count_wa_${randomUUID().replaceAll('-','')}`,id=randomUUID(),actor={name:'Operador',cpf:'12345678901',manager:true};let admin:Pool;
 beforeAll(async()=>{admin=new Pool({connectionString});await admin.query(`CREATE SCHEMA ${schema}`);mocks.pool=new Pool({connectionString,options:`-c search_path=${schema}`});await mocks.pool.query('CREATE TABLE passeio_contagens(id UUID PRIMARY KEY)');await mocks.pool.query(readFileSync('docs/sql/2026-11-18-counting-whatsapp.sql','utf8'));await mocks.pool.query('INSERT INTO passeio_contagens VALUES($1)',[id]);});
 afterAll(async()=>{await mocks.pool?.end();await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.end();vi.unstubAllEnvs();});
 beforeEach(async()=>{
  vi.clearAllMocks();vi.stubEnv('OPERATIONAL_PARK_ID','rincao');vi.stubEnv('COUNTING_WHATSAPP_ENABLED','true');vi.stubEnv('INGRESSO_TICKET_API_WHATSAPP_TESTING','true');vi.stubEnv('COUNTING_WHATSAPP_ACCESS_TOKEN','test-token');vi.stubEnv('COUNTING_WHATSAPP_ALLOWED_NUMBERS','5511999990001');
  await mocks.pool!.query('TRUNCATE contagem_whatsapp_envios');
  mocks.slip.mockResolvedValue({revisionId:id,date:'2026-11-18',clientName:'Grupo Exemplo',type:'bus',ordinal:1,completedAt:'2026-11-18T12:00:00Z',draft:{counts:{adult:30},pcdDetails:[],notes:'',responsible:{name:'Responsável',phone:'11999990001',confirmed:true}}});
  mocks.signature.mockResolvedValue({bytes:Buffer.from('signature')});mocks.images.mockResolvedValue([Buffer.from('one'),Buffer.from('two')]);mocks.verify.mockResolvedValue(undefined);mocks.send.mockResolvedValue('wamid.test');
 });
 it('claims the revision once across concurrent calls and repeated requests',async()=>{
  await Promise.all([sendCountingWhatsapp(id,actor),sendCountingWhatsapp(id,actor)]);expect(mocks.send).toHaveBeenCalledTimes(2);
  expect(await sendCountingWhatsapp(id,actor)).toEqual({status:'accepted',pages:2,accepted:2});expect(mocks.send).toHaveBeenCalledTimes(2);
  expect(mocks.send.mock.calls[0][1]).toBe('5511999990001');expect(mocks.send.mock.calls[1][3][5]).toBe('2 de 2');
  expect(await getCountingWhatsappStatus(id,actor)).toEqual({enabled:true,attempt:{status:'accepted',pages:2,accepted:2}});
 });
 it('records a partial uncertain result and never automatically resends',async()=>{
  mocks.send.mockResolvedValueOnce('wamid.first').mockRejectedValueOnce(new CountingWhatsappProviderError(true));
  expect(await sendCountingWhatsapp(id,actor)).toEqual({status:'uncertain',pages:2,accepted:1});
  await sendCountingWhatsapp(id,actor);expect(mocks.send).toHaveBeenCalledTimes(2);
 });
 it('preserves a definite provider refusal without claiming delivery',async()=>{mocks.send.mockRejectedValue(new CountingWhatsappProviderError(false));expect(await sendCountingWhatsapp(id,actor)).toEqual({status:'failed',pages:2,accepted:0});});
 it('leaves no send claim when approval is pending',async()=>{mocks.verify.mockRejectedValue(new Error('pending'));await expect(sendCountingWhatsapp(id,actor)).rejects.toThrow('pending');expect(mocks.send).not.toHaveBeenCalled();expect((await mocks.pool!.query('SELECT * FROM contagem_whatsapp_envios')).rowCount).toBe(0);});
 it('blocks non-allowlisted recipients and unconfirmed contacts',async()=>{const slip=await mocks.slip();slip.draft.responsible.phone='11999999999';await expect(sendCountingWhatsapp(id,actor)).rejects.toThrow('autorizado');slip.draft.responsible.phone='11999990001';slip.draft.responsible.confirmed=false;await expect(sendCountingWhatsapp(id,actor)).rejects.toThrow('autorizado');expect(mocks.verify).not.toHaveBeenCalled();});
 it('requires authorized slip access even when a previous send exists',async()=>{await sendCountingWhatsapp(id,actor);mocks.slip.mockRejectedValue(new Error('forbidden'));await expect(sendCountingWhatsapp(id,actor)).rejects.toThrow('forbidden');await expect(getCountingWhatsappStatus(id,actor)).rejects.toThrow('forbidden');});
});
