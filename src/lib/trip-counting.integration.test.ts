import { createHash,randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import sharp from 'sharp';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { addCountingVehicle, changeTripCount, getCountingDay, getCountingVehicle, getCountingSignature, getCountingCommand } from './trip-counting';
import { getCountingSlip } from './counting-slip';
import { recordCountingShare,getCountingShare } from './counting-manual-share';
import { countCategories, emptyCountDraft, type CountAction } from './trip-counting-contract';

const state = vi.hoisted(() => ({ pool: null as Pool | null }));
vi.mock('@/lib/ingresso-db', () => ({ getIngressoSistemaDbPool: () => state.pool }));
const connectionString = process.env.PANEL_TEST_DATABASE_URL;
if (connectionString) {
  const url = new URL(connectionString);
  if (url.hostname !== '127.0.0.1' || url.pathname !== '/chargeback_test_painel' || url.search || url.hash) throw new Error('Only local scratch database is allowed');
}
const actor = { name: 'Ana',cpf: '52998224725',manager: false };
const other = { name: 'Bia',cpf: '11144477735',manager: false };
const manager = { name: 'Gerente',cpf: '12345678909',manager: true };
describe.skipIf(!connectionString)('vehicle counting with PostgreSQL', () => {
  const schema = `trip_count_${randomBytes(8).toString('hex')}`;
  let admin: Pool,pool: Pool,created = false,signature: string;
  let migrationPasses: unknown[][];
  beforeAll(async () => {
    admin = new Pool({ connectionString }); await admin.query(`CREATE SCHEMA ${schema}`); created = true;
    pool = new Pool({ connectionString,options: `-c search_path=${schema} -c statement_timeout=10000 -c lock_timeout=7000`,max: 6 }); state.pool = pool;
    await pool.query(`CREATE TABLE agenda(idagenda integer PRIMARY KEY,dtagenda date,stagenda text,tpagenda text DEFAULT 'escol');
      CREATE TABLE acl(idpapel integer,idrecurso varchar(10),PRIMARY KEY(idpapel,idrecurso));INSERT INTO acl VALUES(4,'vis_contra');
      CREATE TABLE clientes(idcliente integer PRIMARY KEY,nome text);
      CREATE TABLE agenda_extras(idagenda integer,idcliente integer,stagenda_cli text,PRIMARY KEY(idagenda,idcliente));
      CREATE TABLE operacao_dias(parque text,data date,estado text,PRIMARY KEY(parque,data));
      CREATE TABLE edicoes_log(id serial PRIMARY KEY,origem varchar(30),acao varchar(30),compra_id integer,movimentacao_id integer,movimentacao_tipo text,
        periodo_id integer,folha_id integer,descricao text,motivo text,usuario_nome text,detalhes_json text,created_at timestamptz DEFAULT now());`);
    await pool.query(await readFile(new URL('../../docs/sql/2026-11-12-day-program.sql',import.meta.url),'utf8'));
    await pool.query(await readFile(new URL('../../docs/sql/2026-11-13-trip-counting.sql',import.meta.url),'utf8'));
    await pool.query(`INSERT INTO agenda VALUES(1,'2000-01-01','abe');
      INSERT INTO clientes VALUES(10,'Legado'); INSERT INTO agenda_extras VALUES(1,10,'abe');
      INSERT INTO passeio_operacao(parque,agenda_id,cliente_id) VALUES('rincao',1,10);
      INSERT INTO passeio_veiculos(parque,agenda_id,cliente_id,tipo,added_on_day)
        VALUES('rincao',1,10,'bus',true),('rincao',1,10,'van',false),('rincao',1,10,'bus',true);
      INSERT INTO contagem_comandos(id,parque,idempotency_key,action,request_hash,actor_cpf,result)
        VALUES('11111111-1111-1111-1111-111111111111','rincao','historical-add','add',repeat('0',64),'52998224725','{"vehicleId":3}');`);
    const migration = await readFile(new URL('../../docs/sql/2026-11-13-counting-app-details.sql',import.meta.url),'utf8');
    migrationPasses = [];
    for (let i = 0; i < 2; i++) {
      await pool.query(migration);
      migrationPasses.push((await pool.query(`SELECT id::int,ordinal,is_extra,carrier_id,planned_people FROM passeio_veiculos ORDER BY id`)).rows);
    }
    await pool.query(await readFile(new URL('../../docs/sql/2026-11-13-counting-day-revisions.sql',import.meta.url),'utf8'));
    await pool.query(await readFile(new URL('../../docs/sql/2026-11-13-counting-manual-shares.sql',import.meta.url),'utf8'));
    const accessMigration=await readFile(new URL('../../docs/sql/2026-11-13-counting-access.sql',import.meta.url),'utf8');await pool.query(accessMigration);await pool.query(accessMigration);
    const raw = Buffer.alloc(64*32*3,255); for (let x = 5; x < 55; x++) for (let y = 10; y < 14; y++) raw.fill(0,(y*64+x)*3,(y*64+x)*3+3);
    signature = 'data:image/png;base64,'+(await sharp(raw,{ raw: { width: 64,height: 32,channels: 3 } }).png().toBuffer()).toString('base64');
  });
  beforeEach(async () => {
    vi.stubEnv('OPERATIONAL_PARK_ID','rincao');
    await pool.query(`TRUNCATE contagem_dias,contagem_dia_revisoes,contagem_dia_comandos,contagem_compartilhamentos,contagem_assinaturas,contagem_comandos,passeio_contagens,passeio_veiculos,passeio_operacao,transportadores,programacoes_dia,programacao_exportacoes,
      programacao_contratacoes,agenda_extras,agenda,clientes,operacao_dias,edicoes_log RESTART IDENTITY CASCADE;
      INSERT INTO agenda VALUES(1,(clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date,'abe');
      INSERT INTO clientes VALUES(10,'Escola A'),(20,'Grupo B'); INSERT INTO agenda_extras VALUES(1,10,'abe'),(1,20,'abe');
      INSERT INTO operacao_dias SELECT 'rincao',dtagenda,'open' FROM agenda;
      INSERT INTO passeio_operacao(parque,agenda_id,cliente_id,planned_people) VALUES('rincao',1,10,50),('rincao',1,20,20);
      INSERT INTO passeio_veiculos(parque,agenda_id,cliente_id,tipo) VALUES('rincao',1,10,'bus'),('rincao',1,20,'van');`);
  });
  afterEach(() => vi.unstubAllEnvs());
  afterAll(async () => { await pool?.end(); if (created) await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin?.end(); });
  function completeDraft() { const draft = emptyCountDraft(); for (const key of countCategories) draft.counts[key] = 0; draft.counts.adult = 10; draft.counts.child = 20;
    draft.responsible = { name: 'Maria',phone: '11987654321',confirmed: true }; return draft; }
  async function command(action: CountAction,version: number,extra = {},who = actor) { return changeTripCount(1,action,{ version,idempotencyKey: `${action}-${version}`,reason: '',...extra },who); }

  it('preserves signed slip headers after program edits and records only declared manual actions',async()=>{
    await command('start',1);const result=await command('complete',2,{draft:completeDraft(),signature});
    const first=await getCountingSlip(result.revisionId!,actor);
    await pool.query("UPDATE clientes SET nome='Nome novo' WHERE idcliente=10");
    expect(await getCountingSlip(result.revisionId!,actor)).toEqual(first);
    const input={action:'opened',idempotencyKey:'33333333-3333-4333-8333-333333333333'};
    const opened=await recordCountingShare(result.revisionId!,input,actor);
    expect(await recordCountingShare(result.revisionId!,input,actor)).toEqual(opened);
    await expect(recordCountingShare(result.revisionId!,input,other)).rejects.toMatchObject({code:'share_conflict'});
    expect(await getCountingShare(result.revisionId!,actor)).toMatchObject({action:'opened',actorName:'Ana'});
    await recordCountingShare(result.revisionId!,{action:'declared',idempotencyKey:'44444444-4444-4444-8444-444444444444'},actor);
    expect(await getCountingShare(result.revisionId!,actor)).toMatchObject({action:'declared'});
    expect((await pool.query('SELECT count(*) FROM contagem_compartilhamentos')).rows[0].count).toBe('2');
  });
  it('blocks new count commands after counting-only closure',async()=>{
    const date=(await getCountingVehicle(1,actor)).date;
    await pool.query("INSERT INTO contagem_dias(parque,data,estado) VALUES('rincao',$1,'closed')",[date]);
    expect((await getCountingDay(date)).closed).toBe(true);
    await expect(command('start',1)).rejects.toMatchObject({code:'count_day_closed'});
    expect((await pool.query('SELECT estado FROM operacao_dias')).rows[0].estado).toBe('open');
  });

  it('preserves ACL grants and supports explicit counting resources without granting them automatically',async()=>{
    expect((await pool.query('SELECT * FROM acl')).rows).toEqual([{idpapel:4,idrecurso:'vis_contra'}]);
    await pool.query("INSERT INTO acl VALUES(4,'vis_contagem'),(4,'vis_portaria')");
    expect((await pool.query('SELECT count(*) FROM acl')).rows[0].count).toBe('3');
    await pool.query("DELETE FROM acl WHERE idrecurso IN ('vis_contagem','vis_portaria')");
  });

  it('prevents financial closure from freezing the pre-completion vehicle snapshot',async()=>{
    await command('start',1);const date=(await getCountingVehicle(1,actor)).date;
    const closing=await pool.connect(),writer=await pool.connect(),original=writer.query.bind(writer);
    let releaseWriter!:()=>void,writerReady!:()=>void;
    const ready=new Promise<void>(resolve=>{writerReady=resolve;}),release=new Promise<void>(resolve=>{releaseWriter=resolve;});
    const spy=vi.spyOn(writer,'query').mockImplementation((async(text:string,values?:unknown[])=>{
      if(text.startsWith('INSERT INTO contagem_comandos')){writerReady();await release;}
      return original(text,values);
    }) as typeof writer.query);
    vi.spyOn(pool,'connect').mockImplementationOnce((()=>Promise.resolve(writer)) as typeof pool.connect);
    const complete=command('complete',2,{draft:completeDraft(),signature});
    try{
      await ready;await closing.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
      await closing.query('SELECT estado FROM operacao_dias');
      const close=(async()=>{await closing.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`operational-day:rincao:${date}`]);await closing.query('SELECT estado,current_count_id FROM passeio_veiculos');await closing.query("UPDATE operacao_dias SET estado='closed'");await closing.query('COMMIT');})();
      releaseWriter();expect(await complete).toMatchObject({state:'completed'});await expect(close).rejects.toMatchObject({code:'40001'});
    }finally{releaseWriter();spy.mockRestore();vi.restoreAllMocks();await closing.query('ROLLBACK');closing.release();}
  });

  it('migrates a populated vehicle history twice and derives extras from recorded counting commands', () => {
    expect(migrationPasses[0]).toEqual([
      { id: 1,ordinal: 1,is_extra: false,carrier_id: null,planned_people: null },
      { id: 2,ordinal: 1,is_extra: false,carrier_id: null,planned_people: null },
      { id: 3,ordinal: 2,is_extra: true,carrier_id: null,planned_people: null },
    ]);
    expect(migrationPasses[1]).toEqual(migrationPasses[0]);
  });
  it('allows only one owner to start the same vehicle version', async () => {
    const results = await Promise.allSettled([command('start',1),command('start',1,{ idempotencyKey: 'other-start' },other)]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1); expect(results.find(r => r.status === 'rejected')).toMatchObject({ reason: { code: 'count_version_conflict' } });
    expect((await pool.query('SELECT count(*) FROM passeio_contagens')).rows[0].count).toBe('1');
  });
  it('saves under ownership and completes once with a private immutable signature', async () => {
    await command('start',1); await expect(command('save',2,{ draft: completeDraft() },other)).rejects.toMatchObject({ code: 'count_owned_by_other' });
    await command('save',2,{ draft: completeDraft() });
    const result = await command('complete',3,{ draft: completeDraft(),signature });
    expect(result).toMatchObject({ vehicleId: 1,version: 4,state: 'completed' });
    expect(await command('complete',3,{ draft: completeDraft(),signature })).toEqual(result);
    expect((await getCountingVehicle(1,actor)).revision).toMatchObject({ total: 30,canReadSignature: true });
    expect((await getCountingSignature(result.revisionId!,other)).bytes.length).toBeGreaterThan(0);
    vi.stubEnv('OPERATIONAL_PARK_ID','estancia');
    await expect(getCountingSignature(result.revisionId!,other)).rejects.toMatchObject({status:403});
    vi.stubEnv('OPERATIONAL_PARK_ID','rincao');
    expect((await getCountingSignature(result.revisionId!,actor)).bytes.length).toBeGreaterThan(0);
    await expect(pool.query("UPDATE passeio_contagens SET notes='overwrite' WHERE id=$1", [result.revisionId])).rejects.toMatchObject({ code: '23514' });
    await expect(pool.query('DELETE FROM contagem_assinaturas WHERE revision_id=$1', [result.revisionId])).rejects.toMatchObject({ code: '23514' });
  });
  it('retains missing counts in drafts and does not publish a false total', async () => {
    await command('start',1); const draft = emptyCountDraft(); draft.counts.adult = 3; await command('save',2,{ draft });
    const detail = await getCountingVehicle(1,actor);
    expect(detail).toMatchObject({ draftSubtotal: 3,revision: { draft: { counts: { adult: 3,child: null } },total: null } });
    expect((await getCountingDay(detail.date)).groups.find(group => group.clientId === 10)?.vehicles[0]).toMatchObject({ draftSubtotal: 3,total: null });
    await expect(command('complete',3,{ draft,signature })).rejects.toMatchObject({ code: 'count_invalid_input' });
    expect((await pool.query('SELECT count(*) FROM contagem_assinaturas')).rows[0].count).toBe('0');
  });
  it('allows release and explicit takeover while rejecting stale tabs', async () => {
    await command('start',1); await command('release',2); await command('start',3,{ idempotencyKey: 'new-owner' },other);
    await expect(command('save',2,{ draft: completeDraft() })).rejects.toMatchObject({ code: 'count_version_conflict' });
    await command('save',4,{ draft: completeDraft() },other);
    const before = await getCountingVehicle(1,actor);
    await expect(command('takeover',5,{},actor)).rejects.toMatchObject({ code: 'count_reason_required' });
    await command('takeover',5,{ reason: 'Troca de funcionário' },actor);
    await expect(command('save',5,{ draft: completeDraft(),idempotencyKey: 'stale-autosave' },other)).rejects.toMatchObject({ code: 'count_version_conflict' });
    expect(await getCountingVehicle(1,actor)).toMatchObject({ draftSubtotal: 30,startedAt: before.startedAt,revision: { ownedByMe: true } });
    const audit = (await pool.query("SELECT motivo,usuario_nome FROM edicoes_log WHERE acao='takeover'")).rows[0];
    expect(audit).toEqual({ motivo: 'Troca de funcionário',usuario_nome: 'Ana' });
    const feed = (await getCountingDay(before.date)).feed;
    expect(feed[0]).toMatchObject({ action: 'takeover',vehicleId: 1,actorName: 'Ana' });
    expect(feed).toHaveLength(3);
  });
  it('preserves completed revisions across an authorized recount', async () => {
    await command('start',1); const first = await command('complete',2,{ draft: completeDraft(),signature });
    await expect(command('recount',3,{},other)).rejects.toMatchObject({ code: 'count_reason_required' });
    const next = await command('recount',3,{ reason: 'Divergência informada' },other);
    expect(next.revisionId).not.toBe(first.revisionId); expect(next.state).toBe('counting');
    expect(await getCountingVehicle(1,other)).toMatchObject({ draftSubtotal: null,revision: { ownedByMe: true,total: null,draft: { counts: { adult: 0,child: 0 } } } });
    expect((await getCountingSignature(first.revisionId!,manager)).bytes.length).toBeGreaterThan(0);
    expect((await pool.query('SELECT status FROM passeio_contagens ORDER BY created_at')).rows.map(r => r.status)).toEqual(['completed','draft']);
  });
  it('blocks zero before saving a signature and completes with one person', async () => {
    await command('start',1);
    const draft = completeDraft(); draft.counts.adult = 0; draft.counts.child = 0;
    await expect(command('complete',2,{ draft,signature })).rejects.toMatchObject({ code: 'count_invalid_input' });
    expect((await pool.query('SELECT count(*) FROM contagem_assinaturas')).rows[0].count).toBe('0');
    draft.counts.child = 1;
    expect(await command('complete',2,{ draft,signature })).toMatchObject({ state: 'completed' });
    expect((await getCountingVehicle(1,actor)).revision).toMatchObject({ catalogVersion: 2,total: 1 });
  });
  it('reads and replays a historical zero completion after catalog 2', async () => {
    const draft = completeDraft(); draft.counts.adult = 0; draft.counts.child = 0; draft.responsible.phone = '5511987654321';
    const revisionId = '11111111-1111-1111-1111-111111111111';
    const commandId = '22222222-2222-2222-2222-222222222222';
    const { normalizeCountingSignature } = await import('./trip-counting-signature');
    const signatureHash = (await normalizeCountingSignature(signature)).hash;
    const hash = createHash('sha256').update(JSON.stringify({ action: 'complete',input: { id: 1,version: 2,reason: '',draft,signatureHash } })).digest('hex');
    const result = { commandId,vehicleId: 1,version: 3,revisionId,state: 'completed',confirmedAt: new Date().toISOString() };
    await pool.query(`INSERT INTO passeio_contagens(id,parque,vehicle_id,catalog_version,status,owner_cpf,counts,responsible_name,responsible_phone,contact_confirmed,completed_at,created_by)
      VALUES($1,'rincao',1,1,'completed',$2,$3,'Maria','5511987654321',true,now(),$2)`,[revisionId,actor.cpf,JSON.stringify(draft.counts)]);
    await pool.query("UPDATE passeio_veiculos SET estado='completed',current_count_id=$1,last_completed_count_id=$1,versao=3 WHERE id=1",[revisionId]);
    await pool.query(`INSERT INTO contagem_comandos(id,parque,idempotency_key,action,request_hash,actor_cpf,result)
      VALUES($1,'rincao','complete-2','complete',$2,$3,$4)`,[commandId,hash,actor.cpf,JSON.stringify(result)]);
    expect((await getCountingVehicle(1,actor)).revision).toMatchObject({ catalogVersion: 1,total: 0 });
    expect(await command('complete',2,{ draft,signature })).toEqual(result);
  });
  it('replays after closure and denies new mutations', async () => {
    const result = await command('start',1); await pool.query("UPDATE operacao_dias SET estado='closed'");
    expect(await command('start',1)).toEqual(result); expect(await getCountingCommand('start-1',actor)).toEqual(result);
    await expect(command('save',2,{ draft: emptyCountDraft() })).rejects.toMatchObject({ code: 'count_day_closed' });
    await expect(getCountingCommand('start-1',other)).rejects.toMatchObject({ status: 403 });
  });
  it('adds a real canonical vehicle only to the specified trip, idempotently', async () => {
    const input = { agendaId: 1,clientId: 20,type: 'bus',plannedPeople: null,reason: '',idempotencyKey: 'extra' };
    const result = await addCountingVehicle(input,actor); expect(await addCountingVehicle(input,actor)).toEqual(result);
    const vehicle = (await pool.query('SELECT cliente_id,added_on_day,created_by FROM passeio_veiculos WHERE id=$1', [result.vehicleId])).rows[0];
    expect(vehicle).toEqual({ cliente_id: 20,added_on_day: true,created_by: actor.cpf });
    await expect(addCountingVehicle({ ...input,clientId: 999,idempotencyKey: 'missing' },actor)).rejects.toMatchObject({ status: 404 });
  });
  it('projects vehicle ordinal, transport override, agenda type and immutable completion context', async () => {
    await pool.query(`INSERT INTO transportadores(parque,nome) VALUES('rincao','Viagens A'),('rincao','Viagens B'),('estancia','Outro parque');
      UPDATE passeio_operacao SET transport_mode='carrier',carrier_id=1,food_notes='Sem leite' WHERE cliente_id=10;`);
    const input = { agendaId: 1,clientId: 10,type: 'bus',plannedPeople: null,carrierId: 2,idempotencyKey: 'with-carrier' };
    const extra = await addCountingVehicle(input,actor);
    await expect(addCountingVehicle({ ...input,carrierId: 3,idempotencyKey: 'cross-park-carrier' },actor)).rejects.toMatchObject({ code: 'count_invalid_input' });
    const initial = await getCountingVehicle(extra.vehicleId,actor);
    expect(initial).toMatchObject({ ordinal: 2,isExtra: true,groupType: 'school',transportName: 'Viagens B' });
    const day = await getCountingDay(initial.date);
    expect(day.groups[0]).toMatchObject({ clientId: 10,groupType: 'school',foodNotes: 'Sem leite',vehicleCounts: { planned: 1,extra: 1,waiting: 2 },
      vehicles: [{ ordinal: 1,transportName: 'Viagens A' },{ ordinal: 2,transportName: 'Viagens B',plannedPeople: null }] });
    await changeTripCount(extra.vehicleId,'start',{ version: 1,idempotencyKey: 'extra-start' },actor);
    const completed = await changeTripCount(extra.vehicleId,'complete',{ version: 2,idempotencyKey: 'extra-complete',draft: completeDraft(),signature },actor);
    await pool.query("UPDATE transportadores SET nome='Alterado' WHERE id=2");
    const { document_context: context } = (await pool.query('SELECT document_context FROM passeio_contagens WHERE id=$1',[completed.revisionId])).rows[0];
    expect(context).toEqual({ date: initial.date,clientName: 'Escola A',type: 'bus',ordinal: 2,transportName: 'Viagens B',groupType: 'school' });
  });
  it('rejects cross-park and finished financial contexts', async () => {
    vi.stubEnv('OPERATIONAL_PARK_ID','estancia'); await expect(command('start',1)).rejects.toMatchObject({ status: 404 }); vi.stubEnv('OPERATIONAL_PARK_ID','rincao');
    await pool.query('ALTER TABLE passeio_operacao ADD COLUMN finalized_receipt_id uuid');
    try { await pool.query("UPDATE passeio_operacao SET finalized_receipt_id='11111111-1111-1111-1111-111111111111'");
      await expect(command('start',1)).rejects.toMatchObject({ code: 'count_trip_finalized' });
    } finally { await pool.query('ALTER TABLE passeio_operacao DROP COLUMN finalized_receipt_id'); }
  });
  it('rolls back signature, revision and command together when auditing fails',async () => {
    await command('start',1);
    await pool.query(`CREATE FUNCTION fail_count_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'audit unavailable'; END $$;
      CREATE TRIGGER fail_count_audit BEFORE INSERT ON edicoes_log FOR EACH ROW EXECUTE FUNCTION fail_count_audit();`);
    try { await expect(command('complete',2,{ draft: completeDraft(),signature })).rejects.toThrow(); }
    finally { await pool.query('DROP TRIGGER fail_count_audit ON edicoes_log; DROP FUNCTION fail_count_audit()'); }
    expect((await getCountingVehicle(1,actor))).toMatchObject({ state: 'counting',version: 2,revision: { status: 'draft',total: null } });
    expect((await pool.query('SELECT count(*) FROM contagem_assinaturas')).rows[0].count).toBe('0');
    expect(await getCountingCommand('complete-2',actor)).toBeNull();
  });
  it('allows one of two competing completions and keeps the winner immutable',async () => {
    await command('start',1);
    const results = await Promise.allSettled([command('complete',2,{ draft: completeDraft(),signature }),command('complete',2,{ draft: completeDraft(),signature,idempotencyKey: 'second-tab' })]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.find(result => result.status === 'rejected')).toMatchObject({ reason: { code: 'count_version_conflict' } });
    expect((await pool.query('SELECT count(*) FROM contagem_assinaturas')).rows[0].count).toBe('1');
  });
  it('requires a manager and reason for an administrative correction in the past',async () => {
    await pool.query("UPDATE agenda SET dtagenda=dtagenda-1");
    await expect(command('start',1)).rejects.toMatchObject({ code: 'count_day_readonly' });
    await expect(command('start',1,{},manager)).rejects.toMatchObject({ code: 'count_day_readonly' });
    expect(await command('start',1,{ reason: 'Conferência autorizada' },manager)).toMatchObject({ state: 'counting' });
  });
  it('rejects future count starts and vehicle additions even for managers with a reason',async () => {
    await pool.query("UPDATE agenda SET dtagenda=dtagenda+1");
    const reason = 'Conferência autorizada';
    await expect(command('start',1,{ reason },manager)).rejects.toMatchObject({ code: 'count_day_readonly' });
    await expect(addCountingVehicle({ agendaId: 1,clientId: 10,type: 'bus',plannedPeople: null,reason,idempotencyKey: 'future-add' },manager)).rejects.toMatchObject({ code: 'count_day_readonly' });
  });
  it('rejects actor fields injected into the command body',async () => {
    await expect(command('start',1,{ actorCpf: manager.cpf,manager: true })).rejects.toMatchObject({ code: 'count_invalid_input' });
    expect((await pool.query('SELECT count(*) FROM passeio_contagens')).rows[0].count).toBe('0');
  });
  it.each(['can','canc','ina','inat'])('rejects actual legacy cancellation/inactivation code %s',async status => {
    await pool.query('UPDATE agenda_extras SET stagenda_cli=$1 WHERE idagenda=1 AND idcliente=10',[status]);
    await expect(command('start',1)).rejects.toMatchObject({ code: 'count_trip_cancelled' });
  });
  it('keeps the same per-type vehicle limit as programming', async () => {
    await pool.query("INSERT INTO passeio_veiculos(parque,agenda_id,cliente_id,tipo) SELECT 'rincao',1,10,'bus' FROM generate_series(1,99)");
    const input = { agendaId: 1,clientId: 10,type: 'bus',plannedPeople: null,reason: '',idempotencyKey: 'extra-bus' };
    await expect(addCountingVehicle(input,actor)).rejects.toMatchObject({ code: 'count_vehicle_limit' });
    expect(await addCountingVehicle({ ...input,type: 'van',idempotencyKey: 'extra-van' },actor)).toMatchObject({ state: 'waiting' });
  });
});
