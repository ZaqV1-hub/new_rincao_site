import { changeOperationalDayClosure,getOperationalDayClosure,getOperationalDayRevision } from './operational-day-closure';
import { dailyExportSections,renderOperationalDayPdf,renderOperationalDayXlsx } from './operational-day-export';
import { getOperationalDaySummary } from './operational-day-summary';
import ExcelJS from 'exceljs';
import { mkdir,writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { afterAll,afterEach,beforeAll,beforeEach,describe,expect,it,vi } from 'vitest';
import { getOperationalTripDay } from './operational-trip-day';
import { renderOperationalTripReport } from './operational-trip-report';
import { lockLegacyTripChange } from './trip-operational-guard';
import { changeTripSettlement,getTripSettlement } from './trip-settlement';
import { createOperationalExpense,listOperationalExpenses } from './operational-expenses';
import { getCashSession,openCashSession,closeCashSession,createCashSessionMovement,autoCloseExpiredCashSessions } from './operational-cash-session';
const mocked = vi.hoisted(() => ({ pool: null as Pool | null }));
vi.mock('@/lib/ingresso-db',() => ({ getIngressoSistemaDbPool: () => mocked.pool,getIngressoSistemaDbDialect: () => 'postgres' }));
const connectionString = process.env.PANEL_TEST_DATABASE_URL;
if (connectionString) { const url = new URL(connectionString); if (url.hostname !== '127.0.0.1' || url.pathname !== '/chargeback_test_painel' || url.search || url.hash) throw new Error('Only local scratch database is allowed'); }
const actor = { name: 'Gerente de ensaio',cpf: '52998224725',manager: true },key = { agendaId: 2,clientId: 10 };
describe.skipIf(!connectionString)('trip settlement with PostgreSQL',() => {
  const schema = `trip_finance_${randomBytes(8).toString('hex')}`; let pool: Pool,admin: Pool,created = false;
  beforeAll(async () => {
    admin = new Pool({ connectionString }); await admin.query(`CREATE SCHEMA ${schema}`); created = true;
    pool = new Pool({ connectionString,options: `-c search_path=${schema} -c statement_timeout=10000 -c lock_timeout=8000`,max: 6 }); mocked.pool = pool;
    await pool.query(`CREATE TABLE tabpreco(idtabpreco integer PRIMARY KEY,vlnormal numeric,vlinfant numeric);
      CREATE TABLE agenda(idagenda integer PRIMARY KEY,idtabpreco integer,dtagenda date,tpagenda text,stagenda text);
      CREATE TABLE clientes(idcliente integer PRIMARY KEY,nome text);
      CREATE TABLE agenda_extras(idagenda integer,idcliente integer,stagenda_cli text,PRIMARY KEY(idagenda,idcliente));
      CREATE TABLE agenda_faixas(idfaixa serial PRIMARY KEY,idagenda integer,idcliente integer,idade_min integer,idade_max integer,valor numeric);
      CREATE TABLE pagpagseguro(idcompra integer,idpagseguro text,status integer,"grossAmount" numeric,paymentmethodtype integer,"lastEventDate" timestamptz);
      CREATE TABLE compra(idcompra integer PRIMARY KEY,tpcompra text,stcompra text,vltotcompra numeric,vltotdesc numeric,formapag text);
      CREATE TABLE compra_pagamentos(id serial PRIMARY KEY,idcompra integer,forma_pagamento text,valor numeric,created_at timestamptz DEFAULT now());
      CREATE TABLE voucher(idvoucher serial PRIMARY KEY,idcompra integer,idagenda integer,tpvoucher text,vlunicompra numeric,vldesc numeric,stusado text,idescola integer,item_id integer,descricao text,autorizado_por_id integer,dtvalidade date,periodo_id integer,closed_at timestamp,dtuso date,nomealuno text,tpparticipante text);
      CREATE TABLE caixa_periodos(id serial PRIMARY KEY,aberto_em timestamptz DEFAULT now(),fechado_em timestamptz,operador varchar(120),fechamento_auto boolean DEFAULT false,folha_id integer,created_at timestamptz DEFAULT now());
      CREATE TABLE caixa_fechamentos(id serial PRIMARY KEY,snapshot_json jsonb,totals_dinheiro numeric DEFAULT 0,totals_fundo numeric DEFAULT 0,totals_geral numeric DEFAULT 0,created_at timestamptz DEFAULT now(),periodo_id integer);
      CREATE TABLE movimentacao_caixa(id serial PRIMARY KEY,tipo varchar(10),responsavel varchar(100),valor numeric,data_hora timestamp DEFAULT now(),created_at timestamptz DEFAULT now());
      CREATE TABLE edicoes_log(id serial PRIMARY KEY,origem varchar(30),acao varchar(30),compra_id integer,movimentacao_id integer,movimentacao_tipo text,periodo_id integer,folha_id integer,descricao text,motivo text,usuario_nome text CHECK(usuario_nome<>'Falha de auditoria'),detalhes_json text,created_at timestamptz DEFAULT now());`);
    for (const file of ['2026-11-12-operational-panel-foundation','2026-11-12-operational-voucher-validity','2026-11-12-operational-service-vouchers','2026-11-12-day-program','2026-11-12-cash-sessions','2026-11-13-trip-counting','2026-11-13-trip-settlement','2026-11-13-purchase-batches','2026-11-13-day-closure']) await pool.query(await readFile(new URL(`../../docs/sql/${file}.sql`,import.meta.url),'utf8'));
  });
  beforeEach(async () => {
    vi.stubEnv('OPERATIONAL_PARK_ID','rincao');
    await pool.query(`TRUNCATE caixa_fechamentos,movimentacao_caixa,operacao_fechamentos,financeiro_comandos,passeio_operacao,agenda_extras,agenda,clientes,voucher,compra_pagamentos,compra,caixa_periodos,caixa_locais,edicoes_log,tabpreco,agenda_faixas,operacao_dias RESTART IDENTITY CASCADE;
      INSERT INTO tabpreco VALUES(1,100,80);
      INSERT INTO agenda VALUES(2,1,(clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date,'escol','abe');
      INSERT INTO clientes VALUES(10,'Escola A'),(20,'Escola B'); INSERT INTO agenda_extras VALUES(2,10,'abe'),(2,20,'abe');
      INSERT INTO passeio_operacao(parque,agenda_id,cliente_id,adult_courtesies,child_courtesies) VALUES('rincao',2,10,2,3);
      INSERT INTO passeio_veiculos(parque,agenda_id,cliente_id,tipo) VALUES('rincao',2,10,'bus');
      INSERT INTO passeio_contagens(id,parque,vehicle_id,catalog_version,status,owner_cpf,counts,responsible_name,responsible_phone,contact_confirmed,completed_at,created_by)
        VALUES('11111111-1111-1111-1111-111111111111','rincao',1,1,'completed','52998224725','{"adult":20,"child":30,"coordinator":0,"pcdChild":0,"pcdAdult":0,"pcdCompanion":0,"teacherChild":0,"exempt":0}','Responsável','5511987654321',true,now(),'52998224725');
      UPDATE passeio_veiculos SET estado='completed',current_count_id='11111111-1111-1111-1111-111111111111',last_completed_count_id='11111111-1111-1111-1111-111111111111';
      INSERT INTO compra VALUES(1,'ponli','conc',1300,0,'pix');
      INSERT INTO voucher(idcompra,idagenda,tpvoucher,vlunicompra,stusado,idescola,nomealuno) SELECT 1,2,'norma',100,'n',10,'Homônimo' FROM generate_series(1,5);
      INSERT INTO voucher(idcompra,idagenda,tpvoucher,vlunicompra,stusado,idescola,nomealuno) SELECT 1,2,'infan',80,'n',10,'Homônimo' FROM generate_series(1,10);
      INSERT INTO caixa_locais(parque,nome,tipo) VALUES('rincao','Passeios','trips'),('rincao','Recepção','sales');`);
  });
  afterEach(() => vi.unstubAllEnvs());
  afterAll(async () => { await pool?.end(); if (created) await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin?.end(); });
  async function mutate(action: string,extra: Record<string,unknown> = {}) { const { source } = await getTripSettlement(key); return changeTripSettlement(key,action,{ version: source.financialVersion,fingerprint: source.fingerprint,idempotencyKey: `${action}-${source.financialVersion}`,reason: '',...extra },actor); }
  async function pay(amountCents: number,status = 'confirmed',method = 'pix') { const { source } = await getTripSettlement(key); return mutate('receive',{ paymentDate: source.today,periodId: null,payments: [{ method,amountCents,status,reference: status === 'pending' ? '' : 'Comprovante de teste' }] }); }
  it('closes atomically, preserves missing cash counts and immutable revisions, and detects a late payment',async () => {
    const { source } = await getTripSettlement(key),date=source.today;
    const cash=await openCashSession({ date,locationId: 2,openingCashCents: 1200,idempotencyKey: 'daily-cash' },actor);
    const preview=await getOperationalDayClosure(date);
    const input={ action:'close',fingerprint:preview.live.fingerprint,idempotencyKey:'day-close',reason:'',acknowledgeWarnings:false,counts:[] };
    await expect(changeOperationalDayClosure(date,input,actor)).rejects.toMatchObject({ code:'day_pending' });
    const accepted={ ...input,reason:'Conferência gerencial com passeios pendentes',acknowledgeWarnings:true };
    const first=await changeOperationalDayClosure(date,accepted,actor);
    expect(await changeOperationalDayClosure(date,accepted,actor)).toEqual(first);
    const closed=await getOperationalDayClosure(date);
    expect(closed.current?.revision).toBe(1);expect(closed.diverged).toBe(false);
    expect(closed.current?.snapshot.sessions[0].snapshot).toMatchObject({ countedCashCents:null,differenceCents:null,pending:['cash_count_missing'] });
    expect((await getCashSession(cash.id)).closedAt).not.toBeNull();
    await expect(pool.query("UPDATE operacao_fechamentos SET snapshot='{}'")).rejects.toMatchObject({ code:'23514' });
    await pool.query("UPDATE compra SET stcompra='pend' WHERE idcompra=1");
    expect((await getOperationalDayClosure(date)).diverged).toBe(true);
    expect(await getOperationalDayRevision(date,first.closureId!)).toEqual(closed.current);
    await expect(changeOperationalDayClosure(date,{ action:'reopen',fingerprint:(await getOperationalDayClosure(date)).live.fingerprint,idempotencyKey:'day-reopen-denied',reason:'Conferência' },{...actor,manager:false})).rejects.toMatchObject({status:403});
    await changeOperationalDayClosure(date,{action:'reopen',fingerprint:(await getOperationalDayClosure(date)).live.fingerprint,idempotencyKey:'day-reopen',reason:'Pagamento tardio conferido'},actor);
    const reopened=await getOperationalDayClosure(date);expect(reopened.current).toBeNull();expect((await getCashSession(cash.id)).closedAt).not.toBeNull();
    await changeOperationalDayClosure(date,{...accepted,fingerprint:reopened.live.fingerprint,idempotencyKey:'day-close-2',counts:[{periodId:cash.id,countedCashCents:1200}]},actor);
    const reviewed=await getOperationalDayClosure(date);expect(reviewed.current?.revision).toBe(2);expect(reviewed.diverged).toBe(false);expect(reviewed.current?.snapshot.sessions[0].snapshot.countedCashCents).toBe(1200);expect((await getCashSession(cash.id)).snapshot.countedCashCents).toBeNull();
    expect(await getOperationalDayRevision(date,first.closureId!)).toEqual(closed.current);
  });
  it('rejects a stale daily preview and rolls back closure on audit failure',async () => {
    const {source}=await getTripSettlement(key),date=source.today,preview=await getOperationalDayClosure(date);
    await pay(1000);
    const input={action:'close',fingerprint:preview.live.fingerprint,idempotencyKey:'stale-day',reason:'Conferência',acknowledgeWarnings:true,counts:[]};
    await expect(changeOperationalDayClosure(date,input,actor)).rejects.toMatchObject({code:'day_source_changed'});
    await expect(changeOperationalDayClosure(date,{...input,fingerprint:(await getOperationalDayClosure(date)).live.fingerprint}, {...actor,name:'Falha de auditoria'})).rejects.toThrow();
    expect((await getOperationalDayClosure(date)).current).toBeNull();
    expect((await pool.query('SELECT count(*) FROM operacao_fechamentos')).rows[0].count).toBe('0');
  });
  it('exports identical financial sections from the frozen revision and neutralizes spreadsheet formula text',async()=>{
    await pool.query("UPDATE clientes SET nome=$1 WHERE idcliente=10",['=HYPERLINK("https://example.test")']);
    await pay(266000);await mutate('finalize',{acknowledgeWarnings:false});
    const {source}=await getTripSettlement(key),date=source.today,preview=await getOperationalDayClosure(date);
    expect(preview.live.trips[0].receiptSourceChanged).toBe(false);
    const result=await changeOperationalDayClosure(date,{action:'close',fingerprint:preview.live.fingerprint,idempotencyKey:'export-day',reason:'Segundo grupo pendente conferido',acknowledgeWarnings:true,counts:[]},actor);
    const revision=await getOperationalDayRevision(date,result.closureId!),sections=dailyExportSections(revision.snapshot);
    expect(sections.find(s=>s.title==='Indicadores')?.rows[0]).toEqual(['Receita da visita (R$)',3960]);
    const xlsx=await renderOperationalDayXlsx(revision.snapshot,revision),pdf=await renderOperationalDayPdf(revision.snapshot,revision);
    const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(new Uint8Array(xlsx) as never);
    expect(workbook.getWorksheet('Indicadores')?.getCell('B4').value).toBe(3960);
    expect(workbook.getWorksheet('Passeios')?.getCell('C4').value).toBe("'=HYPERLINK(\"https://example.test\")");
    expect(pdf.subarray(0,4).toString()).toBe('%PDF');
    await pool.query("UPDATE compra SET stcompra='pend' WHERE idcompra=1");
    expect((await getOperationalDaySummary(date)).revenue.totalCents.value).toBe(396000);
    expect(dailyExportSections((await getOperationalDayRevision(date,result.closureId!)).snapshot)).toEqual(sections);
    if(process.env.PANEL_EXPORT_EVIDENCE_DIR==='/tmp/rincao-e9-evidence'){await mkdir('/tmp/rincao-e9-evidence',{recursive:true});await writeFile('/tmp/rincao-e9-evidence/daily.pdf',pdf);await writeFile('/tmp/rincao-e9-evidence/daily.xlsx',xlsx);}
  });
  it('serializes a daily closure against a cash movement without losing or partially recording money',async()=>{
    const {source}=await getTripSettlement(key),date=source.today;
    const session=await openCashSession({date,locationId:2,openingCashCents:0,idempotencyKey:'race-open'},actor),preview=await getOperationalDayClosure(date);
    const outcomes=await Promise.allSettled([
      changeOperationalDayClosure(date,{action:'close',fingerprint:preview.live.fingerprint,idempotencyKey:'race-close',reason:'Conferência gerencial',acknowledgeWarnings:true,counts:[]},actor),
      createCashSessionMovement({periodId:session.id,type:'fundo',responsible:'Gerente',amountCents:500,reason:'Fundo de ensaio',idempotencyKey:'race-fund'},actor)
    ]);
    expect(outcomes.some(o=>o.status==='fulfilled')).toBe(true);
    const actual=await getCashSession(session.id),movements=(await pool.query('SELECT count(*) FROM movimentacao_caixa')).rows[0].count;
    expect(movements).toBe(outcomes[1].status==='fulfilled'?'1':'0');
    expect(actual.snapshot.expectedCashCents).toBe(outcomes[1].status==='fulfilled'?500:0);
    if(outcomes[0].status==='fulfilled')expect(actual.closedAt).not.toBeNull();
  });
  it('keeps a repeated midnight job from closing a cash session twice after the daily closure',async()=>{
    const {source}=await getTripSettlement(key),session=await openCashSession({date:source.today,locationId:2,openingCashCents:100,idempotencyKey:'midnight-open'},actor);
    const date=(await pool.query("UPDATE caixa_periodos SET data_operacional=data_operacional-1 WHERE id=$1 RETURNING data_operacional::text AS date",[session.id])).rows[0].date;
    const preview=await getOperationalDayClosure(date);
    await changeOperationalDayClosure(date,{action:'close',fingerprint:preview.live.fingerprint,idempotencyKey:'midnight-close',reason:'Fim do dia',acknowledgeWarnings:true,counts:[]},actor);
    expect(await autoCloseExpiredCashSessions(actor)).toEqual({closedCount:0,closedPeriodIds:[]});
    expect(await autoCloseExpiredCashSessions(actor)).toEqual({closedCount:0,closedPeriodIds:[]});
    expect((await pool.query('SELECT count(*) FROM caixa_fechamentos')).rows[0].count).toBe('1');
  });
  it('uses the approved calculation and requires confirmed receipt in full before a single immutable receipt',async () => {
    const initial = await getTripSettlement(key);
    expect(initial.source.calculation).toMatchObject({ adultToCharge: 13,childToCharge: 17,onlinePresentCents: 130000,schoolChargeCents: 266000,totalTripCents: 396000 });
    await pay(100000); await expect(mutate('finalize',{ acknowledgeWarnings: false })).rejects.toMatchObject({ code: 'trip_payment_incomplete' });
    await pay(166000); const { source } = await getTripSettlement(key);
    const input = { version: source.financialVersion,fingerprint: source.fingerprint,idempotencyKey: 'finish',reason: '',acknowledgeWarnings: false };
    const result = await changeTripSettlement(key,'finalize',input,actor); expect(await changeTripSettlement(key,'finalize',input,actor)).toEqual(result);
    const final = await getTripSettlement(key); expect(final.receipt?.snapshot.calculation?.totalTripCents).toBe(396000);
    expect((await pool.query('SELECT count(*) FROM passeio_recibos')).rows[0].count).toBe('1');
    await expect(pool.query("UPDATE passeio_recibos SET snapshot='{}'")).rejects.toMatchObject({ code: '23514' });
  });
  it('does not treat a pending boleto as money and confirms it only with proof',async () => {
    await pay(266000,'pending','bolet'); expect((await getTripSettlement(key)).source.confirmedCents).toBe(0);
    await expect(mutate('finalize',{ acknowledgeWarnings: false })).rejects.toMatchObject({ code: 'trip_payment_incomplete' });
    const { source } = await getTripSettlement(key);
    await expect(mutate('confirm_payment',{ paymentId: source.payments[0].id,paymentDate: source.today,reference: '' })).rejects.toMatchObject({ code: 'trip_invalid_input' });
    await mutate('confirm_payment',{ paymentId: source.payments[0].id,paymentDate: source.today,reference: 'Baixa bancária conferida' });
    expect((await getTripSettlement(key)).source.remainingCents).toBe(0);
  });
  it('rejects stale previews after the actual vehicle revision changes',async () => {
    await pay(266000); const { source } = await getTripSettlement(key);
    await pool.query('UPDATE passeio_veiculos SET versao=versao+1');
    await expect(changeTripSettlement(key,'finalize',{ version: source.financialVersion,fingerprint: source.fingerprint,idempotencyKey: 'old-preview',reason: '',acknowledgeWarnings: false },actor)).rejects.toMatchObject({ code: 'trip_source_changed' });
  });
  it('requires explicit classification for school vouchers and uses voucher identity for refunds',async () => {
    await pool.query("UPDATE voucher SET tpvoucher='escol',tpparticipante='aluno' WHERE idvoucher=1");
    expect((await getTripSettlement(key)).source.calculation).toBeNull();
    await mutate('participant',{ voucherId: 1,category: 'adult',refundRequested: true,reason: 'Ausente confirmado' });
    const { source } = await getTripSettlement(key);
    expect(source.calculation).toMatchObject({ refundsDueCents: 10000,onlinePresentCents: 120000,adultToCharge: 14 });
    expect(source.participants.filter(p => p.refundRequested)).toHaveLength(1);
    expect(source.participants.find(p => p.voucherId === 1)?.refundPaidAt).toBeNull();
  });
  it('requires a trip cash session and includes only net cash after change in its balance',async () => {
    await expect(pay(100000,'confirmed','dinhe')).rejects.toMatchObject({ code: 'trip_cash_required' });
    const { source } = await getTripSettlement(key);
    const session = await openCashSession({ date: source.today,locationId: 1,openingCashCents: 20000,idempotencyKey: 'cash-open' },actor);
    await mutate('receive',{ paymentDate: source.today,periodId: session.id,payments: [
      { method: 'pix',amountCents: 166000,status: 'confirmed',reference: 'Pix 123' },
      { method: 'dinhe',amountCents: 110000,status: 'confirmed',reference: '' }] });
    expect((await getCashSession(session.id)).snapshot).toMatchObject({ cashReceivedCents: 100000,expectedCashCents: 120000 });
    expect((await getTripSettlement(key)).source.remainingCents).toBe(0);
  });
  it('rejects a sales cash session and a closed trip cash session without recording money',async () => {
    const { source } = await getTripSettlement(key);
    const sales = await openCashSession({ date: source.today,locationId: 2,openingCashCents: 0,idempotencyKey: 'sales-open' },actor);
    const input = { paymentDate: source.today,periodId: sales.id,payments: [{ method: 'dinhe',amountCents: 1000,status: 'confirmed',reference: '' }] };
    await expect(mutate('receive',input)).rejects.toMatchObject({ code: 'cash_type_mismatch' });
    const trips = await openCashSession({ date: source.today,locationId: 1,openingCashCents: 0,idempotencyKey: 'trip-open' },actor);
    await closeCashSession({ periodId: trips.id,countedCashCents: 0,idempotencyKey: 'close-trip',reason: 'Fim do turno' },actor);
    await expect(mutate('receive',{ ...input,periodId: trips.id })).rejects.toMatchObject({ code: 'cash_session_closed' });
    expect((await getTripSettlement(key)).source.payments).toHaveLength(0);
  });
  it('records a manual online refund once and keeps it separate from the school charge',async () => {
    await mutate('participant',{ voucherId: 1,category: 'adult',refundRequested: true,reason: 'Ausente confirmado' });
    const { source } = await getTripSettlement(key);
    await mutate('refund_online',{ voucherId: 1,method: 'pix',paymentDate: source.today,periodId: null,reference: 'Pix devolvido, comprovante 01',reason: 'Reembolso manual confirmado' });
    const after = await getTripSettlement(key);
    expect(after.source.participants.find(p => p.voucherId === 1)).toMatchObject({ refundRequested: true,refundPaidCents: 10000 });
    expect(after.source.calculation?.schoolChargeCents).toBe(276000);
    expect((await pool.query('SELECT stusado FROM voucher WHERE idvoucher=1')).rows[0].stusado).toBe('inv');
    await expect(mutate('refund_online',{ voucherId: 1,method: 'pix',paymentDate: source.today,periodId: null,reference: 'duplicado',reason: 'Conferência' })).rejects.toMatchObject({ code: 'trip_refund_already_paid' });
    await expect(mutate('participant',{ voucherId: 1,category: 'adult',refundRequested: false,reason: 'Remover' })).rejects.toMatchObject({ code: 'trip_refund_paid' });
  });
  it('reverses a confirmed cash payment with a current cash outflow and an immutable proof',async () => {
    const { source } = await getTripSettlement(key);
    const session = await openCashSession({ date: source.today,locationId: 1,openingCashCents: 20000,idempotencyKey: 'refund-cash-open' },actor);
    await mutate('receive',{ paymentDate: source.today,periodId: session.id,payments: [{ method: 'dinhe',amountCents: 100000,status: 'confirmed',reference: '' }] });
    const paymentId = (await getTripSettlement(key)).source.payments[0].id;
    await mutate('reverse_payment',{ paymentId,paymentDate: source.today,periodId: session.id,reference: 'Devolução assinada 123',reason: 'Valor lançado incorretamente e devolvido' });
    expect((await getTripSettlement(key)).source.confirmedCents).toBe(0);
    expect((await getCashSession(session.id)).snapshot).toMatchObject({ cashReceivedCents: 100000,refundsCents: 100000,expectedCashCents: 20000 });
    await expect(pool.query("DELETE FROM passeio_recebimento_estornos")).rejects.toMatchObject({ code: '23514' });
  });
  it('records trip expenses once and withdraws cash exactly once',async () => {
    const { source } = await getTripSettlement(key);
    const session = await openCashSession({ date: source.today,locationId: 1,openingCashCents: 20000,idempotencyKey: 'expense-cash-open' },actor);
    const input = { date: source.today,scope: 'trips',agendaId: 2,clientId: 10,description: 'Transporte de teste',category: 'transporte',amountCents: 10000,method: 'dinhe',periodId: session.id,reference: 'Recibo teste 1',reason: '',idempotencyKey: 'expense-1' };
    const first = await createOperationalExpense(input,actor); expect(await createOperationalExpense(input,actor)).toEqual(first);
    expect(await listOperationalExpenses(source.today)).toHaveLength(1);
    expect((await getCashSession(session.id)).snapshot).toMatchObject({ expensesCents: 10000,expectedCashCents: 10000 });
    await expect(createOperationalExpense({ ...input,idempotencyKey: 'expense-2',amountCents: 10001 },actor)).rejects.toMatchObject({ code: 'expense_cash_insufficient' });
    expect(await listOperationalExpenses(source.today)).toHaveLength(1);
  });
  it('keeps Estância expense rules pending without inventing a zero or accepting a write',async () => {
    vi.stubEnv('OPERATIONAL_PARK_ID','estancia');
    await expect(listOperationalExpenses('2026-11-13')).rejects.toMatchObject({ code: 'expense_rules_pending' });
    await expect(createOperationalExpense({},actor)).rejects.toMatchObject({ code: 'expense_rules_pending' });
  });
  it('does not change a proven ticket category or refund a voucher already admitted',async () => {
    await expect(mutate('participant',{ voucherId: 1,category: 'child',refundRequested: false,reason: 'Conferência' })).rejects.toMatchObject({ code: 'trip_category_proven' });
    await pool.query("UPDATE voucher SET stusado='s' WHERE idvoucher=1");
    await expect(mutate('participant',{ voucherId: 1,category: 'adult',refundRequested: true,reason: 'Ausente' })).rejects.toMatchObject({ code: 'trip_refund_used' });
  });
  it('preserves original receipts on explicit revision and denies nonmanager finalization',async () => {
    await pay(266000); const { source } = await getTripSettlement(key);
    await expect(changeTripSettlement(key,'finalize',{ version: source.financialVersion,fingerprint: source.fingerprint,idempotencyKey: 'staff-final',reason: '',acknowledgeWarnings: false },{ ...actor,manager: false })).rejects.toMatchObject({ status: 403 });
    const first = await mutate('finalize',{ acknowledgeWarnings: false });
    await mutate('reopen',{ reason: 'Correção autorizada' });
    expect((await getTripSettlement(key)).receipt).toBeNull();
    await mutate('finalize',{ acknowledgeWarnings: false });
    const history = await getTripSettlement(key); expect(history.history).toHaveLength(2); expect(history.receipt?.id).not.toBe(first.receiptId);
  });
  it('blocks legacy trip edits after finalization and structural moves after counting starts',async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await expect(lockLegacyTripChange(client,key,{ structural: true })).rejects.toMatchObject({ code: 'trip_operational_history' });
      await client.query('ROLLBACK');
      await pay(266000); await mutate('finalize',{ acknowledgeWarnings: false });
      await client.query('BEGIN');
      await expect(lockLegacyTripChange(client,key)).rejects.toMatchObject({ code: 'trip_finalized' });
      await client.query('ROLLBACK');
    } finally { client.release(); }
  });

  it('edits planned attendance without changing completed count revisions',async () => {
    const before = (await getTripSettlement(key)).source;
    await mutate('planning',{ plannedPeople: 60,vehicles: [{ id: 1,plannedPeople: 55 }] });
    const after = (await getTripSettlement(key)).source;
    expect(after.plannedPeople).toBe(60); expect(after.vehicles[0].plannedPeople).toBe(55);
    expect(after.vehicles[0].draft).toEqual(before.vehicles[0].draft);
    expect(after.vehicles[0].revisionId).toEqual(before.vehicles[0].revisionId);
    await expect(mutate('planning',{ plannedPeople: 60,vehicles: [{ id: 999,plannedPeople: 50 }] })).rejects.toMatchObject({ code: 'trip_invalid_input' });
  });

  it('uses finalized snapshots in the trip day and exports actual expenses without double counting site payments',async () => {
    await pay(266000); await mutate('finalize',{ acknowledgeWarnings: false });
    const { source } = await getTripSettlement(key);
    await createOperationalExpense({ date: source.date,scope: 'trips',agendaId: null,clientId: null,description: 'Monitoria',category: 'monitoria',amountCents: 10000,method: 'pix',periodId: null,reference: 'Recibo de teste',reason: '',idempotencyKey: 'report-expense' },actor);
    const day = await getOperationalTripDay(source.date);
    expect(day).toMatchObject({ revenueCents: 396000,expenseCents: 10000,resultCents: 386000 });
    expect(day.payments).toEqual([{ method: 'online',amountCents: 130000 },{ method: 'pix',amountCents: 266000 }]);
    expect(day.trips).toHaveLength(2);
    const pdf = await renderOperationalTripReport(day,actor.name,new Map());
    expect(pdf.toString('latin1',0,5)).toBe('%PDF-');
    await mutate('reopen',{ reason: 'Revisão autorizada' });
    expect((await getOperationalTripDay(source.date)).revenueCents).toBe(0);
  });

  it('rolls back the received money when the audit fails',async () => {
    const { source } = await getTripSettlement(key);
    await expect(changeTripSettlement(key,'receive',{ version: source.financialVersion,fingerprint: source.fingerprint,idempotencyKey: 'audit-failure',paymentDate: source.today,periodId: null,payments: [{ method: 'pix',amountCents: 10000,status: 'confirmed',reference: 'Comprovante teste' }] },{ ...actor,name: 'Falha de auditoria' })).rejects.toMatchObject({ code: '23514' });
    expect((await getTripSettlement(key)).source.payments).toHaveLength(0);
    expect((await pool.query('SELECT count(*) FROM financeiro_comandos')).rows[0].count).toBe('0');
  });
  it('serializes competing finalizations and replays the winner even after daily closure',async () => {
    await pay(266000); const { source } = await getTripSettlement(key);
    const input = { version: source.financialVersion,fingerprint: source.fingerprint,reason: '',acknowledgeWarnings: false };
    const attempts = await Promise.allSettled(['final-one','final-two'].map(idempotencyKey => changeTripSettlement(key,'finalize',{ ...input,idempotencyKey },actor)));
    expect(attempts.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(attempts.find(result => result.status === 'rejected')).toMatchObject({ reason: { code: 'trip_source_changed' } });
    const winner = attempts.findIndex(result => result.status === 'fulfilled');
    await pool.query("INSERT INTO operacao_dias(parque,data,estado,tabela_preco_id) VALUES('rincao',$1::date,'closed',1) ON CONFLICT(parque,data) DO UPDATE SET estado='closed'",[source.date]);
    expect(await changeTripSettlement(key,'finalize',{ ...input,idempotencyKey: ['final-one','final-two'][winner] },actor)).toEqual((attempts[winner] as PromiseFulfilledResult<unknown>).value);
    await expect(mutate('reopen',{ reason: 'Revisão após fechamento' })).rejects.toMatchObject({ code: 'trip_day_closed' });
  });

});
