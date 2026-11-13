import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import sharp from 'sharp';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { addCountingVehicle, changeTripCount, getCountingVehicle, getCountingSignature, getCountingCommand } from './trip-counting';
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
  beforeAll(async () => {
    admin = new Pool({ connectionString }); await admin.query(`CREATE SCHEMA ${schema}`); created = true;
    pool = new Pool({ connectionString,options: `-c search_path=${schema} -c statement_timeout=10000 -c lock_timeout=7000`,max: 6 }); state.pool = pool;
    await pool.query(`CREATE TABLE agenda(idagenda integer PRIMARY KEY,dtagenda date,stagenda text);
      CREATE TABLE clientes(idcliente integer PRIMARY KEY,nome text);
      CREATE TABLE agenda_extras(idagenda integer,idcliente integer,stagenda_cli text,PRIMARY KEY(idagenda,idcliente));
      CREATE TABLE operacao_dias(parque text,data date,estado text,PRIMARY KEY(parque,data));
      CREATE TABLE edicoes_log(id serial PRIMARY KEY,origem varchar(30),acao varchar(30),compra_id integer,movimentacao_id integer,movimentacao_tipo text,
        periodo_id integer,folha_id integer,descricao text,motivo text,usuario_nome text,detalhes_json text,created_at timestamptz DEFAULT now());`);
    await pool.query(await readFile(new URL('../../docs/sql/2026-11-12-day-program.sql',import.meta.url),'utf8'));
    await pool.query(await readFile(new URL('../../docs/sql/2026-11-13-trip-counting.sql',import.meta.url),'utf8'));
    const raw = Buffer.alloc(64*32*3,255); for (let x = 5; x < 55; x++) for (let y = 10; y < 14; y++) raw.fill(0,(y*64+x)*3,(y*64+x)*3+3);
    signature = 'data:image/png;base64,'+(await sharp(raw,{ raw: { width: 64,height: 32,channels: 3 } }).png().toBuffer()).toString('base64');
  });
  beforeEach(async () => {
    vi.stubEnv('OPERATIONAL_PARK_ID','rincao');
    await pool.query(`TRUNCATE contagem_assinaturas,contagem_comandos,passeio_contagens,passeio_veiculos,passeio_operacao,programacoes_dia,programacao_exportacoes,
      programacao_contratacoes,agenda_extras,agenda,clientes,operacao_dias,edicoes_log RESTART IDENTITY CASCADE;
      INSERT INTO agenda VALUES(1,(clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date,'abe');
      INSERT INTO clientes VALUES(10,'Escola A'),(20,'Escola B'); INSERT INTO agenda_extras VALUES(1,10,'abe'),(1,20,'abe');
      INSERT INTO operacao_dias SELECT 'rincao',dtagenda,'open' FROM agenda;
      INSERT INTO passeio_operacao(parque,agenda_id,cliente_id,planned_people) VALUES('rincao',1,10,50),('rincao',1,20,20);
      INSERT INTO passeio_veiculos(parque,agenda_id,cliente_id,tipo) VALUES('rincao',1,10,'bus'),('rincao',1,20,'van');`);
  });
  afterEach(() => vi.unstubAllEnvs());
  afterAll(async () => { await pool?.end(); if (created) await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin?.end(); });
  function completeDraft() { const draft = emptyCountDraft(); for (const key of countCategories) draft.counts[key] = 0; draft.counts.adult = 10; draft.counts.child = 20;
    draft.responsible = { name: 'Maria',phone: '11987654321',confirmed: true }; return draft; }
  async function command(action: CountAction,version: number,extra = {},who = actor) { return changeTripCount(1,action,{ version,idempotencyKey: `${action}-${version}`,reason: '',...extra },who); }
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
    await expect(getCountingSignature(result.revisionId!,other)).rejects.toMatchObject({ status: 403 });
    expect((await getCountingSignature(result.revisionId!,actor)).bytes.length).toBeGreaterThan(0);
    await expect(pool.query("UPDATE passeio_contagens SET notes='overwrite' WHERE id=$1", [result.revisionId])).rejects.toMatchObject({ code: '23514' });
    await expect(pool.query('DELETE FROM contagem_assinaturas WHERE revision_id=$1', [result.revisionId])).rejects.toMatchObject({ code: '23514' });
  });
  it('retains missing counts in drafts and does not publish a false total', async () => {
    await command('start',1); const draft = emptyCountDraft(); draft.counts.adult = 3; await command('save',2,{ draft });
    expect((await getCountingVehicle(1,actor)).revision).toMatchObject({ draft: { counts: { adult: 3,child: null } },total: null });
    await expect(command('complete',3,{ draft,signature })).rejects.toMatchObject({ code: 'count_invalid_input' });
    expect((await pool.query('SELECT count(*) FROM contagem_assinaturas')).rows[0].count).toBe('0');
  });
  it('allows release and explicit takeover while rejecting stale tabs', async () => {
    await command('start',1); await command('release',2); await command('start',3,{ idempotencyKey: 'new-owner' },other);
    await expect(command('save',2,{ draft: completeDraft() })).rejects.toMatchObject({ code: 'count_version_conflict' });
    await expect(command('takeover',4,{},manager)).rejects.toMatchObject({ code: 'count_reason_required' });
    await command('takeover',4,{ reason: 'Troca de funcionário' },manager);
    expect((await getCountingVehicle(1,manager)).revision?.ownedByMe).toBe(true);
  });
  it('preserves completed revisions across an authorized recount', async () => {
    await command('start',1); const first = await command('complete',2,{ draft: completeDraft(),signature });
    await expect(command('recount',3,{ reason: 'Conferir' },actor)).rejects.toMatchObject({ status: 403 });
    const next = await command('recount',3,{ reason: 'Divergência informada' },manager);
    expect(next.revisionId).not.toBe(first.revisionId); expect(next.state).toBe('counting');
    expect((await getCountingVehicle(1,manager)).revision?.total).toBeNull();
    expect((await getCountingSignature(first.revisionId!,manager)).bytes.length).toBeGreaterThan(0);
    expect((await pool.query('SELECT status FROM passeio_contagens ORDER BY created_at')).rows.map(r => r.status)).toEqual(['completed','draft']);
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
  it.each([-1,1])('requires manager and reason outside the current day (%s)',async offset => {
    await pool.query("UPDATE agenda SET dtagenda=dtagenda+$1::int",[offset]);
    await expect(command('start',1)).rejects.toMatchObject({ code: 'count_day_readonly' });
    await expect(command('start',1,{},manager)).rejects.toMatchObject({ code: 'count_day_readonly' });
    expect(await command('start',1,{ reason: 'Conferência autorizada' },manager)).toMatchObject({ state: 'counting' });
  });
  it('rejects actor fields injected into the command body',async () => {
    await expect(command('start',1,{ actorCpf: manager.cpf,manager: true })).rejects.toMatchObject({ code: 'count_invalid_input' });
    expect((await pool.query('SELECT count(*) FROM passeio_contagens')).rows[0].count).toBe('0');
  });
  it('keeps the same per-type vehicle limit as programming', async () => {
    await pool.query("INSERT INTO passeio_veiculos(parque,agenda_id,cliente_id,tipo) SELECT 'rincao',1,10,'bus' FROM generate_series(1,99)");
    const input = { agendaId: 1,clientId: 10,type: 'bus',plannedPeople: null,reason: '',idempotencyKey: 'extra-bus' };
    await expect(addCountingVehicle(input,actor)).rejects.toMatchObject({ code: 'count_vehicle_limit' });
    expect(await addCountingVehicle({ ...input,type: 'van',idempotencyKey: 'extra-van' },actor)).toMatchObject({ state: 'waiting' });
  });
});
