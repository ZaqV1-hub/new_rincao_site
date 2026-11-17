import { randomBytes } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { moveOpsClientTripDate } from './ops-client-trips';

const state = vi.hoisted(() => ({ pool: null as Pool | null }));
vi.mock('@/lib/ingresso-db', () => ({ getIngressoSistemaDbPool: () => state.pool }));
const connectionString = process.env.PANEL_TEST_DATABASE_URL;
if (connectionString) {
  const url = new URL(connectionString);
  if (url.hostname !== '127.0.0.1' || url.pathname !== '/chargeback_test_painel' || url.search || url.hash) throw new Error('Only local scratch database is allowed');
}
describe.skipIf(!connectionString)('moving client trips with PostgreSQL', () => {
  const schema = `client_trip_${randomBytes(8).toString('hex')}`;
  let admin: Pool, pool: Pool;
  beforeAll(async () => {
    admin = new Pool({ connectionString }); await admin.query(`CREATE SCHEMA ${schema}`);
    pool = new Pool({ connectionString, options: `-c search_path=${schema} -c statement_timeout=10000` });
    // Legacy metadata queries target public; point only those lookups at this disposable schema.
    state.pool = { connect: async () => {
      const client = await pool.connect(), query = client.query.bind(client);
      client.query = ((sql: string, values?: unknown[]) => query(sql.replaceAll("table_schema = 'public'", `table_schema = '${schema}'`), values)) as typeof client.query;
      const release = client.release.bind(client);
      client.release = () => { client.query = query as typeof client.query; release(); };
      return client;
    } } as Pool;
    vi.stubEnv('OPERATIONAL_PARK_ID', 'rincao');
    await pool.query(`CREATE TABLE agenda(idagenda serial PRIMARY KEY,dtagenda date,tpagenda text,stagenda text,idtabpreco integer,idinformacao integer,usucadastro text,dtcadastro date,hrcadastro time);
      CREATE TABLE agenda_extras(idextra serial,idagenda integer,idcliente integer,aceita_familia boolean,stagenda_cli text DEFAULT 'abe',slug text,criado_em timestamptz,atualizado_em timestamptz,PRIMARY KEY(idagenda,idcliente));
      CREATE TABLE agenda_faixas(idfaixa serial PRIMARY KEY,idagenda integer REFERENCES agenda ON DELETE CASCADE,idcliente integer,idade_min integer,idade_max integer,valor numeric);
      CREATE TABLE voucher(idvoucher integer PRIMARY KEY,idagenda integer REFERENCES agenda,idescola integer);
      CREATE TABLE escoladata(idagenda integer REFERENCES agenda);
      CREATE TABLE operacao_dias(parque text,data date,estado text,day_use_agenda_id integer REFERENCES agenda,PRIMARY KEY(parque,data));
      CREATE TABLE passeio_operacao(parque text,agenda_id integer,cliente_id integer,finalized_receipt_id text);`);
  });
  beforeEach(async () => {
    await pool.query(`TRUNCATE agenda_extras,agenda_faixas,voucher,escoladata,operacao_dias,passeio_operacao,agenda RESTART IDENTITY CASCADE;
      INSERT INTO agenda(dtagenda,tpagenda,stagenda,idtabpreco) VALUES('2030-01-01','padra','abe',11),('2030-01-02','padra','abe',12);
      INSERT INTO agenda_extras(idagenda,idcliente,aceita_familia,slug) VALUES(1,10,true,'original-group');
      INSERT INTO agenda_faixas(idagenda,idcliente,idade_min,idade_max,valor) VALUES(1,10,4,9,60);
      INSERT INTO operacao_dias VALUES('rincao','2030-01-01','open',1),('rincao','2030-01-02','open',2);`);
  });
  afterAll(async () => { await pool?.end(); if (admin) { await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin.end(); } vi.unstubAllEnvs(); });
  const move = () => moveOpsClientTripDate({ agendaId: 1, clientId: 10, tripDate: '02/01/2030', actor: { name: 'Gerente de teste' } });

  it('moves the last group without deleting the source public day-use agenda', async () => {
    await expect(move()).resolves.toMatchObject({ agendaId: 2, clientId: 10 });
    expect((await pool.query('SELECT idagenda,idcliente,slug FROM agenda_extras')).rows).toEqual([{ idagenda: 2, idcliente: 10, slug: 'original-group' }]);
    expect((await pool.query('SELECT day_use_agenda_id FROM operacao_dias ORDER BY data')).rows).toEqual([{ day_use_agenda_id: 1 }, { day_use_agenda_id: 2 }]);
    expect((await pool.query('SELECT idagenda,stagenda,idtabpreco FROM agenda ORDER BY idagenda')).rows).toEqual([{ idagenda: 1, stagenda: 'abe', idtabpreco: 11 }, { idagenda: 2, stagenda: 'abe', idtabpreco: 12 }]);
    expect((await pool.query('SELECT valor::text FROM agenda_faixas WHERE idagenda=2 AND idcliente=10')).rows).toEqual([{ valor: '60.00' }]);
    expect((await pool.query("SELECT count(*)::int AS count FROM edicoes_log WHERE acao='client_trip_move_date'")).rows[0].count).toBeGreaterThan(0);
  });

  it('moves only this group vouchers and leaves public vouchers at the source', async () => {
    await pool.query('INSERT INTO voucher VALUES(1,1,10),(2,1,NULL)');
    await move();
    expect((await pool.query('SELECT idvoucher,idagenda FROM voucher ORDER BY idvoucher')).rows).toEqual([{ idvoucher: 1, idagenda: 2 }, { idvoucher: 2, idagenda: 1 }]);
  });

  it('still removes an unreferenced empty legacy agenda', async () => {
    await pool.query('UPDATE operacao_dias SET day_use_agenda_id=NULL WHERE day_use_agenda_id=1');
    await move();
    expect((await pool.query('SELECT idagenda FROM agenda WHERE idagenda=1')).rows).toEqual([]);
  });

  it('keeps the operational-history restriction and rolls back the move', async () => {
    await pool.query("INSERT INTO passeio_operacao VALUES('rincao',1,10,NULL)");
    await expect(move()).rejects.toMatchObject({ code: 'trip_operational_history' });
    expect((await pool.query('SELECT idagenda FROM agenda_extras')).rows).toEqual([{ idagenda: 1 }]);
  });
});
