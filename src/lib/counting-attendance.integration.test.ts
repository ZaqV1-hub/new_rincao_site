import { randomBytes } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { readCountingAttendance } from './counting-attendance';
import { readOperationalDayReceipts } from './operational-day-receipts';

const connectionString = process.env.PANEL_TEST_DATABASE_URL;
if (connectionString) {
  const url = new URL(connectionString);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hostname !== '127.0.0.1' ||
      url.pathname !== '/chargeback_test_painel' || url.search || url.hash) throw new Error('Use only the local chargeback_test_painel scratch database');
}
type Plan = { 'Relation Name'?: string; 'Actual Rows': number; 'Actual Loops': number; Plans?: Plan[] };
function workFor(plan: Plan, relation: string): number {
  return (plan['Relation Name'] === relation ? plan['Actual Rows'] * plan['Actual Loops'] : 0) +
    (plan.Plans ?? []).reduce((sum, child) => sum + workFor(child, relation), 0);
}

describe.skipIf(!connectionString)('daily attendance and receipts on PostgreSQL history', () => {
  const schema = `daily_reads_it_${randomBytes(8).toString('hex')}`;
  const date = '2099-11-15';
  let admin: Pool, pool: Pool;
  let created = false;
  beforeAll(async () => {
    admin = new Pool({ connectionString, connectionTimeoutMillis: 2000 });
    await admin.query(`CREATE SCHEMA ${schema}`); created = true;
    pool = new Pool({ connectionString, options: `-c search_path=${schema} -c jit=off -c statement_timeout=10000`, connectionTimeoutMillis: 2000 });
    await pool.query(`CREATE TABLE agenda(idagenda integer PRIMARY KEY,dtagenda date,tpagenda text,stagenda text);
      CREATE TABLE compra(idcompra integer PRIMARY KEY,tpcompra text,stcompra text,formapag text,dtpagamento date,checkout_school_site_context jsonb);
      CREATE TABLE voucher(idvoucher integer PRIMARY KEY,idcompra integer,idagenda integer,dtinicio_validade date,dtuso date,stusado text,parque_operacional text,idescola integer,tpvoucher text,servico_id integer);
      CREATE INDEX ON voucher(dtinicio_validade) WHERE dtinicio_validade IS NOT NULL;
      CREATE INDEX ON voucher(idagenda) WHERE dtinicio_validade IS NULL;
      CREATE INDEX ON voucher(dtuso); CREATE INDEX ON voucher(idcompra);
      CREATE TABLE operacao_dias(parque text,data date,day_use_agenda_id integer);
      CREATE TABLE pagpagseguro(idcompra integer,idpagseguro text,status integer,"grossAmount" numeric,paymentmethodtype integer,"lastEventDate" timestamptz);
      CREATE INDEX ON pagpagseguro(idcompra);
      CREATE TABLE caixa_periodos(id integer,parque text);
      CREATE TABLE compra_pagamentos(periodo_id integer,forma_pagamento text,valor numeric,recebido_em timestamptz);
      CREATE TABLE passeio_recebimentos(parque text,payment_date date,status text,method text,amount_cents bigint);`);
  });
  afterAll(async () => {
    try { await pool?.end(); if (created) await admin.query(`DROP SCHEMA ${schema} CASCADE`); }
    finally { await admin?.end(); vi.unstubAllEnvs(); }
  });
  beforeEach(async () => {
    vi.stubEnv('OPERATIONAL_PARK_ID', 'rincao');
    await pool.query(`TRUNCATE agenda,compra,voucher,operacao_dias,pagpagseguro,caixa_periodos,compra_pagamentos,passeio_recebimentos;
      INSERT INTO agenda VALUES(1,'2099-11-14','padra','abe'),(2,'2099-11-15','padra','abe');
      INSERT INTO compra VALUES(1,'ponli','conc','pix','2099-11-15',NULL);
      INSERT INTO voucher VALUES(1,1,2,'2099-11-15','2099-11-15','s','rincao',NULL,'norma',NULL);
      INSERT INTO pagpagseguro VALUES(1,'paid',3,123.45,11,'2099-11-15T12:00:00Z');`);
  });
  async function seedHistory() {
    await pool.query(`INSERT INTO compra SELECT n,'ponli','conc','pix','2099-11-14',NULL FROM generate_series(10,5010) n;
      INSERT INTO voucher SELECT n,n,1,'2099-11-14',NULL,'n','rincao',NULL,'norma',NULL FROM generate_series(10,5010) n;
      INSERT INTO pagpagseguro SELECT n,'old',3,100,11,'2099-11-14T12:00:00Z' FROM generate_series(10,5010) n;
      ANALYZE compra; ANALYZE voucher; ANALYZE pagpagseguro; ANALYZE agenda;`);
  }
  async function measuredClient() {
    let sql = '', params: unknown[] = [];
    const client = { query: async (text: string, values: unknown[]) => {
      if (text.includes('WITH ')) { sql = text; params = values; }
      return pool.query(text, values);
    } } as Pick<PoolClient, 'query'>;
    return { client, plan: async () => (await pool.query('EXPLAIN (ANALYZE, TIMING OFF, FORMAT JSON) ' + sql, params)).rows[0]['QUERY PLAN'][0].Plan as Plan };
  }
  it('looks up purchases only for the selected day instead of processing historical purchases', async () => {
    await seedHistory();
    const measured = await measuredClient();
    expect(await readCountingAttendance(measured.client, date)).toEqual({ date, hasDayUse: true, sold: 1, admitted: 1, expected: 0 });
    expect(workFor(await measured.plan(), 'compra')).toBeLessThanOrEqual(2);
  });
  it('deduplicates same-day admission and preserves legacy dates, other-day admission and exclusions', async () => {
    await pool.query(`INSERT INTO compra VALUES(2,'reser','conc','pix',NULL,NULL),(3,'ponli','conc','pix',NULL,'{}');
      INSERT INTO voucher VALUES
      (2,2,2,NULL,NULL,'n',NULL,NULL,'infan',NULL),
      (3,1,1,'2099-11-14','2099-11-15','s','rincao',NULL,'norma',NULL),
      (4,1,2,'2099-11-15',NULL,'n','estancia',NULL,'norma',NULL),
      (5,3,2,'2099-11-15',NULL,'n','rincao',NULL,'norma',NULL),
      (6,1,2,'2099-11-15',NULL,'n','rincao',NULL,'norma',7),
      (7,1,2,'2099-11-15',NULL,'n','rincao',10,'norma',NULL);`);
    expect(await readCountingAttendance(pool, date)).toEqual({ date, hasDayUse: true, sold: 2, admitted: 2, expected: 0 });
  });
  it('reads gateway events only for relevant receipt candidates, not all historical purchases', async () => {
    await seedHistory();
    const measured = await measuredClient();
    expect(await readOperationalDayReceipts(measured.client, date, 'rincao')).toEqual({ rows: [{ source: 'online', method: 'pix', amountCents: 12345 }], unclassifiedCount: 0 });
    expect(workFor(await measured.plan(), 'pagpagseguro')).toBeLessThanOrEqual(2);
  });
  it('retains latest approved gross amount, unknown evidence, payment date and park boundaries', async () => {
    await pool.query(`INSERT INTO pagpagseguro VALUES(1,'new',3,150,1,'2099-11-15T13:00:00Z'),(1,'not-approved',1,999,2,'2099-11-15T14:00:00Z');
      INSERT INTO compra VALUES(2,'ponli','conc','pix',NULL,NULL),(3,'ponli','conc','pix','2099-11-15',NULL),(4,'ponli','conc','pix','2099-11-15',NULL);
      INSERT INTO voucher VALUES(2,2,2,NULL,NULL,'n',NULL,NULL,'norma',NULL),(3,3,2,'2099-11-15',NULL,'n','estancia',NULL,'norma',NULL),(4,4,1,'2099-11-14',NULL,'n','rincao',NULL,'norma',NULL);
      INSERT INTO pagpagseguro VALUES(3,'foreign',3,999,11,now()),(4,'fractional',3,1.001,11,now());`);
    expect(await readOperationalDayReceipts(pool, date, 'rincao')).toEqual({ rows: [{ source: 'online', method: 'credi', amountCents: 15000 }, { source: 'online', method: 'pix', amountCents: 0 }], unclassifiedCount: 2 });
  });
  it('keeps receipts unavailable when the legacy payment-date column is absent', async () => {
    await pool.query('ALTER TABLE compra DROP COLUMN dtpagamento');
    try { expect(await readOperationalDayReceipts(pool, date, 'rincao')).toEqual({ rows: [], unclassifiedCount: 1 }); }
    finally { await pool.query('ALTER TABLE compra ADD COLUMN dtpagamento date'); }
  });
});
