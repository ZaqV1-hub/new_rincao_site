import {randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {Pool} from 'pg';
import {beforeAll,beforeEach,afterAll,describe,expect,it,vi} from 'vitest';
import {countingReportTotals} from './counting-day-report-contract';
import {getCountingDayClosure,changeCountingDayClosure} from './counting-day-closure';
const mock=vi.hoisted(()=>({pool:null as Pool|null}));
vi.mock('./ingresso-db',()=>({getIngressoSistemaDbPool:()=>mock.pool}));
const connectionString=process.env.PANEL_TEST_DATABASE_URL;
if(connectionString){const u=new URL(connectionString);if(u.hostname!=='127.0.0.1'||u.pathname!=='/chargeback_test_painel'||u.search||u.hash)throw new Error('Only local scratch DB');}
describe.skipIf(!connectionString)('counting closure separate from finance',()=>{
 const schema=`count_day_${randomBytes(6).toString('hex')}`;let admin:Pool,pool:Pool,date:string;
 const actor={name:'Monitor',cpf:'52998224725',manager:false};
 beforeAll(async()=>{
  admin=new Pool({connectionString});await admin.query(`CREATE SCHEMA ${schema}`);pool=new Pool({connectionString,options:`-c search_path=${schema} -c jit=off -c statement_timeout=10000`});mock.pool=pool;vi.stubEnv('OPERATIONAL_PARK_ID','rincao');
  await pool.query(`CREATE TABLE agenda(idagenda integer PRIMARY KEY,dtagenda date,stagenda text,tpagenda text);
    CREATE TABLE clientes(idcliente integer PRIMARY KEY,nome text,idtipo integer);
    CREATE TABLE agenda_extras(idagenda integer,idcliente integer,stagenda_cli text,PRIMARY KEY(idagenda,idcliente));
    CREATE TABLE operacao_dias(parque text,data date,estado text,PRIMARY KEY(parque,data));
    CREATE TABLE edicoes_log(id serial PRIMARY KEY,origem varchar(30),acao varchar(30),compra_id integer,movimentacao_id integer,movimentacao_tipo text,periodo_id integer,folha_id integer,descricao text,motivo text,usuario_nome text,detalhes_json text,created_at timestamptz DEFAULT now());
    CREATE TABLE compra(idcompra integer PRIMARY KEY,stcompra text,tpcompra text,formapag text);
    CREATE TABLE voucher(idvoucher integer PRIMARY KEY,idcompra integer,idagenda integer,dtinicio_validade date,dtuso date,stusado text,parque_operacional text,idescola integer,tpvoucher text,servico_id bigint);
    CREATE TABLE caixa_periodos(id integer PRIMARY KEY,fechado_em timestamptz); INSERT INTO caixa_periodos VALUES(1,NULL);`);
  for(const file of ['2026-11-12-day-program.sql','2026-11-13-trip-counting.sql','2026-11-13-counting-app-details.sql','2026-11-13-counting-day-revisions.sql'])await pool.query(await readFile(new URL(`../../docs/sql/${file}`,import.meta.url),'utf8'));
  date=(await pool.query("SELECT (clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date::text AS date")).rows[0].date;
 });
 async function sql(text:string){for(const statement of text.split(';').filter(s=>s.trim()))await pool.query(statement,statement.includes('$1')?[date]:[]);}
 beforeEach(async()=>{await sql(`TRUNCATE contagem_dia_revisoes,contagem_dia_comandos,contagem_dias,passeio_contagens,passeio_veiculos,passeio_operacao,programacoes_dia,programacao_exportacoes,programacao_contratacoes,contagem_comandos,agenda_extras,agenda,clientes,operacao_dias,edicoes_log,voucher,compra RESTART IDENTITY CASCADE;
 INSERT INTO agenda VALUES(1,$1,'abe','escol'),(2,$1,'abe','padra');INSERT INTO clientes VALUES(10,'Escola',1);INSERT INTO agenda_extras VALUES(1,10,'abe');INSERT INTO operacao_dias VALUES('rincao',$1,'open');INSERT INTO passeio_operacao(parque,agenda_id,cliente_id) VALUES('rincao',1,10);INSERT INTO passeio_veiculos(parque,agenda_id,cliente_id,tipo) VALUES('rincao',1,10,'bus');`);});
 afterAll(async()=>{await pool?.end();if(admin){await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.end();}vi.unstubAllEnvs();});
 it('requires acknowledgement for pending vehicles and never closes financial day/cash',async()=>{
  const before=await getCountingDayClosure(date),input={action:'close',fingerprint:before.live.fingerprint,idempotencyKey:'close',acknowledgePending:false};
  await expect(changeCountingDayClosure(date,input,actor)).rejects.toMatchObject({code:'count_day_pending'});
  const result=await changeCountingDayClosure(date,{...input,acknowledgePending:true},actor);expect(await changeCountingDayClosure(date,{...input,acknowledgePending:true},actor)).toEqual(result);
  expect((await pool.query('SELECT estado FROM operacao_dias')).rows[0].estado).toBe('open');expect((await pool.query('SELECT fechado_em FROM caixa_periodos')).rows[0].fechado_em).toBeNull();
  const after=await getCountingDayClosure(date);expect(after.closed).toBe(true);expect(after.current?.snapshot.groups[0].pending).toHaveLength(1);
  await expect(pool.query("UPDATE contagem_dia_revisoes SET actor_name='x'")).rejects.toMatchObject({code:'23514'});
  await changeCountingDayClosure(date,{...input,action:'reopen',idempotencyKey:'reopen',acknowledgePending:true},actor);expect((await getCountingDayClosure(date)).history).toHaveLength(1);
 });
 it('keeps emitted attendance unchanged while a later admission changes live report',async()=>{
  const before=await getCountingDayClosure(date);await changeCountingDayClosure(date,{action:'close',fingerprint:before.live.fingerprint,idempotencyKey:'close',acknowledgePending:true},actor);
  await sql("INSERT INTO compra VALUES(1,'conc','ponli','pix');INSERT INTO voucher VALUES(1,1,2,$1,$1,'s','rincao',NULL,'norma',NULL)");
  const after=await getCountingDayClosure(date);expect(after.live.dayUse.admitted).toBe(1);expect(after.current?.snapshot.dayUse.admitted).toBe(0);expect(after.diverged).toBe(true);
 });
 it('requires manager and reason for past reopen/reissue and preserves old snapshots and finance',async()=>{
  const past=(await pool.query("SELECT ($1::date-1)::text AS date",[date])).rows[0].date;
  await pool.query('UPDATE agenda SET dtagenda=$1;',[past]);
  const manager={...actor,name:'Gerente',manager:true};
  const before=await getCountingDayClosure(past),input={action:'close',fingerprint:before.live.fingerprint,idempotencyKey:'past-close',acknowledgePending:true};
  await expect(changeCountingDayClosure(past,{...input,reason:'Conferência'},actor)).rejects.toMatchObject({code:'count_day_date'});
  await expect(changeCountingDayClosure(past,input,manager)).rejects.toMatchObject({code:'count_day_date'});
  await expect(changeCountingDayClosure(past,{...input,reason:'  '},manager)).rejects.toMatchObject({code:'count_day_date'});
  const first=await changeCountingDayClosure(past,{...input,reason:'Conferência inicial'},manager);
  const old=(await getCountingDayClosure(past)).current!;
  await changeCountingDayClosure(past,{...input,action:'reopen',reason:'Correção autorizada',idempotencyKey:'past-reopen'},manager);
  await pool.query('UPDATE passeio_operacao SET planned_people=45');
  const changed=await getCountingDayClosure(past);
  const reissue={...input,fingerprint:changed.live.fingerprint,reason:'Total conferido',idempotencyKey:'past-reissue'};
  const latest=await changeCountingDayClosure(past,reissue,manager);
  expect(await changeCountingDayClosure(past,reissue,manager)).toEqual(latest);
  await expect(changeCountingDayClosure(past,{...reissue,reason:'Outro motivo'},manager)).rejects.toMatchObject({code:'count_day_conflict'});
  const after=await getCountingDayClosure(past);
  expect(after.history).toHaveLength(2);expect(after.history.find(r=>r.id===first.revisionId)).toEqual(old);
  expect(after.current).toMatchObject({version:2,reason:'Total conferido',snapshot:{groups:[{plannedPeople:45}]}});
  expect((await pool.query('SELECT estado FROM operacao_dias')).rows[0].estado).toBe('open');
  expect((await pool.query('SELECT fechado_em FROM caixa_periodos')).rows[0].fechado_em).toBeNull();
  await pool.query("INSERT INTO operacao_dias VALUES('rincao',$1,'closed')",[past]);
  await expect(changeCountingDayClosure(past,{...reissue,action:'reopen',idempotencyKey:'finance-block'},manager)).rejects.toMatchObject({code:'count_day_financial_closed'});
 });
 it('rejects future emission and malformed reasons even for managers',async()=>{
  const future=(await pool.query("SELECT ($1::date+1)::text AS date",[date])).rows[0].date;
  const input={action:'close',fingerprint:'0'.repeat(64),idempotencyKey:'invalid',acknowledgePending:true};
  await expect(changeCountingDayClosure(future,{...input,reason:'Conferência'},{...actor,manager:true})).rejects.toMatchObject({code:'count_day_date'});
  for(const reason of [false,1,{},'a'.repeat(1001)])await expect(changeCountingDayClosure(date,{...input,reason},actor)).rejects.toMatchObject({code:'count_day_input'});
 });

 it('removes cancelled pending work from current reports but preserves the issued revision',async()=>{
  const before=await getCountingDayClosure(date);
  await changeCountingDayClosure(date,{action:'close',fingerprint:before.live.fingerprint,idempotencyKey:'before-cancel',acknowledgePending:true},actor);
  const old=(await getCountingDayClosure(date)).current;
  await pool.query("UPDATE agenda_extras SET stagenda_cli='can'");
  const after=await getCountingDayClosure(date);
  expect(after.live.groups).toEqual([]);expect(countingReportTotals(after.live).pending).toBe(0);expect(after.current).toEqual(old);
  await pool.query("DELETE FROM passeio_veiculos; UPDATE agenda_extras SET stagenda_cli='abe'; UPDATE agenda SET stagenda='inat'");
  expect((await getCountingDayClosure(date)).live.groups).toEqual([]);
 });

});
