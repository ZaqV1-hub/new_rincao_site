import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { getOperationalCatalogPool } from './painel-operational-catalog';
import { getOperationalParkId } from './operational-day-contract';
import { isCivilDate } from './operational-date';
import { lockOperationalDay } from './operational-day-lock';
import { lockOpenCashSession,readCashSessionSnapshot,type CashSession } from './operational-cash-session';
import { registerOpsAuditLog } from './ops-audit-log';
import { countCategories,type CountCategory } from './trip-counting-contract';
import { allocateTripPayments,invalidTrip,normalizeTripConfiguration,tripInteger,tripRecord,tripText,TripSettlementError,type TripFinancialActor } from './trip-settlement-contract';
import { readTripSettlementSource,tripFingerprint,type TripKey,type TripSettlementSource } from './trip-settlement-source';
export type TripReceipt = { id: string; number: number; snapshot: TripSettlementSource; createdAt: string; actorName: string | null };
export type TripCommandResult = { commandId: string; agendaId: number; clientId: number; version: number; receiptId: string | null; paymentIds: number[]; confirmedAt: string };
export type TripSettlementDetail = { source: TripSettlementSource; receipt: TripReceipt | null; history: { id: string; number: number; createdAt: string; revised: boolean }[] };
function deny(code: string,message: string,status = 409): never { throw new TripSettlementError(code,message,status); }
function keyInput(key: TripKey) { tripInteger(key.agendaId,2147483647,1); tripInteger(key.clientId,2147483647,1); return key; }
function actorId(actor: TripFinancialActor) { if (!actor.cpf || !/^\d{11}$/.test(actor.cpf)) return deny('trip_actor_required','Operador não identificado.',403); return actor.cpf; }
function commandKey(value: unknown) { if (typeof value !== 'string' || !/^[A-Za-z0-9:_-]{1,100}$/.test(value)) return invalidTrip(); return value; }
async function transaction<T>(run: (client: PoolClient) => Promise<T>,readOnly = false): Promise<T> {
  const client = await getOperationalCatalogPool().connect(); let discard = false;
  try { await client.query(readOnly ? 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY' : 'BEGIN'); const result = await run(client); await client.query('COMMIT'); return result; }
  catch (error) { try { await client.query('ROLLBACK'); } catch { discard = true; } throw error; } finally { client.release(discard); }
}
async function assertDatesOpen(client: PoolClient,dates: string[]) {
  const closed = await client.query("SELECT data FROM operacao_dias WHERE parque=$1 AND data=ANY($2::date[]) AND estado='closed'",[getOperationalParkId(),dates]);
  if (closed.rowCount) return deny('trip_day_closed','Há uma data finalizada nesta operação. Registre a pendência de ajuste e solicite revisão gerencial.');
}
async function currentDate(client: PoolClient) { return (await client.query<{ date: string }>("SELECT (clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date::text AS date")).rows[0].date; }
async function lockTrip(client: PoolClient,key: TripKey,initial: TripSettlementSource,paymentDate: string | null,periodId: number | null) {
  const park = getOperationalParkId(),dates = [...new Set([initial.date,...(paymentDate ? [paymentDate] : [])])].sort();
  if (periodId !== null) {
    const period = (await client.query<{ date: string }>('SELECT data_operacional::text AS date FROM caixa_periodos WHERE id=$1 AND parque=$2',[periodId,park])).rows[0];
    if (!period || period.date !== paymentDate) return deny('trip_cash_date','O caixa deve pertencer à data do recebimento em dinheiro.');
  }
  for (const date of dates) await lockOperationalDay(client,park,date);
  await assertDatesOpen(client,dates);
  const session = periodId === null ? null : await lockOpenCashSession(client,{ periodId,expectedType: 'trips',date: paymentDate! });
  const trip = (await client.query<{ date: string }>(`SELECT a.dtagenda::text AS date FROM agenda_extras ae JOIN agenda a ON a.idagenda=ae.idagenda JOIN clientes c ON c.idcliente=ae.idcliente WHERE ae.idagenda=$1 AND ae.idcliente=$2 FOR SHARE OF ae,a,c`,[key.agendaId,key.clientId])).rows[0];
  if (!trip || trip.date !== initial.date) return deny('trip_source_changed','A data ou o vínculo do passeio mudou. Confira a versão atual.');
  await client.query('INSERT INTO passeio_operacao(parque,agenda_id,cliente_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[park,key.agendaId,key.clientId]);
  await client.query('SELECT agenda_id FROM passeio_operacao WHERE parque=$1 AND agenda_id=$2 AND cliente_id=$3 FOR UPDATE',[park,key.agendaId,key.clientId]);
  await client.query('SELECT id FROM passeio_veiculos WHERE parque=$1 AND agenda_id=$2 AND cliente_id=$3 ORDER BY id FOR UPDATE',[park,key.agendaId,key.clientId]);
  await client.query('SELECT idfaixa FROM agenda_faixas WHERE idagenda=$1 AND (idcliente=$2 OR idcliente IS NULL) ORDER BY idfaixa FOR SHARE',[key.agendaId,key.clientId]);
  await client.query('SELECT p.idtabpreco FROM tabpreco p JOIN agenda a ON a.idtabpreco=p.idtabpreco WHERE a.idagenda=$1 FOR SHARE OF p',[key.agendaId]);
  await client.query('SELECT c.idcompra FROM compra c WHERE EXISTS(SELECT 1 FROM voucher v WHERE v.idcompra=c.idcompra AND v.idagenda=$1 AND v.idescola=$2) ORDER BY c.idcompra FOR UPDATE',[key.agendaId,key.clientId]);
  await client.query('SELECT idvoucher FROM voucher WHERE idagenda=$1 AND idescola=$2 ORDER BY idvoucher FOR UPDATE',[key.agendaId,key.clientId]);
  return { dates,session };
}
async function cashRefund(client: PoolClient,session: CashSession,amountCents: number,origin: string,originId: number,reason: string,actor: TripFinancialActor) {
  const snapshot = await readCashSessionSnapshot(client,session);
  if (snapshot.expectedCashCents < amountCents) return deny('trip_cash_insufficient','O caixa não tem dinheiro suficiente para esta devolução.');
  await client.query(`INSERT INTO movimentacao_caixa(tipo,responsavel,valor,periodo_id,motivo,ator_nome,ator_cpf,origem_tipo,origem_id)
    VALUES('devolucao',$1,($2::numeric/100)::numeric(12,2),$3,$4,$1,$5,$6,$7)`,[actor.name?.slice(0,100) || actor.cpf,amountCents,session.id,reason,actor.cpf,origin,originId]);
}
export async function readTripReceipt(client: PoolClient,id: string | null): Promise<TripReceipt | null> {
  if (!id) return null;
  const row = (await client.query<{ id: string; number: string; snapshot: TripSettlementSource; createdAt: string; actorName: string | null }>('SELECT id,number::text,snapshot,created_at::text AS "createdAt",actor_name AS "actorName" FROM passeio_recibos WHERE parque=$1 AND id=$2',[getOperationalParkId(),id])).rows[0];
  if (!row) return deny('trip_receipt_missing','Recibo original não encontrado.');
  return { ...row,number: tripInteger(Number(row.number),Number.MAX_SAFE_INTEGER,1) };
}
export async function getTripSettlement(key: TripKey): Promise<TripSettlementDetail> {
  keyInput(key);
  return transaction(async client => {
    const source = await readTripSettlementSource(client,key),receipt = await readTripReceipt(client,source.receiptId);
    const history = (await client.query<{ id: string; number: string; createdAt: string; revised: boolean }>(`SELECT r.id,r.number::text,r.created_at::text AS "createdAt",EXISTS(SELECT 1 FROM passeio_recibo_revisoes x WHERE x.receipt_id=r.id) AS revised
      FROM passeio_recibos r WHERE r.parque=$1 AND r.agenda_id=$2 AND r.cliente_id=$3 ORDER BY r.number DESC`,[source.park,key.agendaId,key.clientId])).rows.map(row => ({ ...row,number: Number(row.number) }));
    return { source,receipt,history };
  },true);
}
export async function getTripReceipt(id: string): Promise<TripReceipt> {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id)) return invalidTrip();
  return transaction(async client => (await readTripReceipt(client,id))!,true);
}
export async function getTripCommand(key: string,actor: TripFinancialActor): Promise<TripCommandResult | null> {
  const cpf = actorId(actor),park = getOperationalParkId(); commandKey(key);
  return transaction(async client => {
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`finance-command:${park}:${key}`]);
    const row = (await client.query<{ actor_cpf: string; result: TripCommandResult }>('SELECT actor_cpf,result FROM financeiro_comandos WHERE parque=$1 AND idempotency_key=$2',[park,key])).rows[0];
    if (row && row.actor_cpf !== cpf) return deny('trip_command_forbidden','Esta tentativa pertence a outro operador.',403);
    return row?.result ?? null;
  });
}
const actionFields: Record<string,string[]> = { configure: ['configuration'],planning: ['plannedPeople','vehicles'],participant: ['voucherId','category','refundRequested'],receive: ['paymentDate','periodId','payments'],confirm_payment: ['paymentId','paymentDate','reference'],cancel_pending: ['paymentId'],finalize: ['acknowledgeWarnings'],reopen: [],refund_online: ['voucherId','method','paymentDate','periodId','reference'],reverse_payment: ['paymentId','paymentDate','periodId','reference'] };
export async function changeTripSettlement(key: TripKey,action: string,value: unknown,actor: TripFinancialActor): Promise<TripCommandResult> {
  keyInput(key); const cpf = actorId(actor),park = getOperationalParkId();
  if (!Object.hasOwn(actionFields,action)) return invalidTrip();
  const data = tripRecord(value,['version','fingerprint','idempotencyKey','reason',...actionFields[action]]),version = tripInteger(data.version,2147483646,1),idempotencyKey = commandKey(data.idempotencyKey),reason = tripText(data.reason ?? '',1000);
  if (typeof data.fingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(data.fingerprint)) return invalidTrip();
  const configuration = action === 'configure' ? normalizeTripConfiguration(data.configuration) : null;
  const paymentDate = ['receive','confirm_payment','refund_online','reverse_payment'].includes(action) ? (isCivilDate(data.paymentDate) ? data.paymentDate : invalidTrip('Informe a data do recebimento.')) : null;
  const periodId = ['receive','refund_online','reverse_payment'].includes(action) && data.periodId !== null ? tripInteger(data.periodId,2147483647,1) : null;
  const hash = tripFingerprint({ key,action,data });
  return transaction(async client => {
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`finance-command:${park}:${idempotencyKey}`]);
    const previous = (await client.query<{ actor_cpf: string; request_hash: string; result: TripCommandResult }>('SELECT actor_cpf,request_hash,result FROM financeiro_comandos WHERE parque=$1 AND idempotency_key=$2',[park,idempotencyKey])).rows[0];
    if (previous) { if (previous.actor_cpf !== cpf) return deny('trip_command_forbidden','Esta tentativa pertence a outro operador.',403); if (previous.request_hash !== hash) return deny('trip_idempotency_conflict','A chave já corresponde a outra operação. Confira a tentativa original.'); return previous.result; }
    if (['configure','planning','finalize','reopen','reverse_payment'].includes(action) && !actor.manager) return deny('trip_manager_required','Esta ação exige um gerente.',403);
    const initial = await readTripSettlementSource(client,key),{ dates,session } = await lockTrip(client,key,initial,paymentDate,periodId),source = await readTripSettlementSource(client,key);
    if (source.fingerprint !== data.fingerprint || source.financialVersion !== version) return deny('trip_source_changed','Contagem, pagamentos ou dados do passeio mudaram. Seus campos foram preservados; confira uma nova prévia.');
    if (source.cancelled) return deny('trip_cancelled','O passeio está cancelado ou inativo.');
    if (source.receiptId && !['reopen','refund_online'].includes(action)) return deny('trip_finalized','O passeio está finalizado. Solicite revisão gerencial para corrigir.');
    const paymentIds: number[] = []; let receiptId = source.receiptId;
    if (configuration) {
      await client.query('UPDATE passeio_operacao SET adult_price_cents=$4,child_price_cents=$5,adult_courtesies=$6,child_courtesies=$7 WHERE parque=$1 AND agenda_id=$2 AND cliente_id=$3',[park,key.agendaId,key.clientId,configuration.adultPriceCents,configuration.childPriceCents,configuration.adultCourtesies,configuration.childCourtesies]);
    } else if (action === 'planning') {
      const plannedPeople = data.plannedPeople === null ? null : tripInteger(data.plannedPeople,100000);
      if (!Array.isArray(data.vehicles) || data.vehicles.length !== source.vehicles.length) return invalidTrip('Confira a previsão de todos os veículos.');
      const seen = new Set<number>();
      for (const item of data.vehicles) {
        const row = tripRecord(item,['id','plannedPeople']),id = tripInteger(row.id,Number.MAX_SAFE_INTEGER,1);
        if (seen.has(id) || !source.vehicles.some(vehicle => vehicle.id === id)) return invalidTrip('A lista de veículos mudou. Confira a programação.');
        seen.add(id);
        const people = row.plannedPeople === null ? null : tripInteger(row.plannedPeople,100000);
        await client.query('UPDATE passeio_veiculos SET planned_people=$2,versao=versao+1 WHERE id=$1 AND planned_people IS DISTINCT FROM $2::integer',[id,people]);
      }
      await client.query('UPDATE passeio_operacao SET planned_people=$4 WHERE parque=$1 AND agenda_id=$2 AND cliente_id=$3',[park,key.agendaId,key.clientId,plannedPeople]);
    } else if (action === 'participant') {
      const voucherId = tripInteger(data.voucherId,2147483647,1),participant = source.participants.find(row => row.voucherId === voucherId);
      if (!participant || !countCategories.includes(data.category as CountCategory) || typeof data.refundRequested !== 'boolean' || !reason) return invalidTrip('Selecione o ingresso, a categoria e o motivo da conferência.');
      const original = (await client.query<{ type: string; used: boolean }>("SELECT btrim(tpvoucher) AS type,(stusado='s') IS TRUE AS used FROM voucher WHERE idvoucher=$1",[voucherId])).rows[0];
      const provenCategory = ({ norma: 'adult',infan: 'child',isent: 'exempt' } as Record<string,string>)[original.type];
      if (provenCategory && provenCategory !== data.category) return deny('trip_category_proven','A categoria comprovada pelo ingresso não pode ser substituída no fechamento.');
      if (data.refundRequested && original.used) return deny('trip_refund_used','Este ingresso já foi usado. Confira a entrada antes de marcar ausência.');
      if (participant.refundPaidAt && !data.refundRequested) return deny('trip_refund_paid','Um reembolso já pago não pode ser removido.');
      const participantWrite = await client.query(`INSERT INTO passeio_participantes(parque,agenda_id,cliente_id,voucher_id,category,refund_requested,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT(parque,voucher_id) DO UPDATE SET category=excluded.category,refund_requested=excluded.refund_requested,updated_by=excluded.updated_by,updated_at=clock_timestamp()
        WHERE passeio_participantes.agenda_id=excluded.agenda_id AND passeio_participantes.cliente_id=excluded.cliente_id`,[park,key.agendaId,key.clientId,voucherId,data.category,data.refundRequested,cpf]);
      if (participantWrite.rowCount !== 1) return deny('trip_participant_context_changed','O vínculo do ingresso mudou. Confira o passeio original.');
    } else if (action === 'receive') {
      if (source.remainingCents === null || source.blockingIssues.length) return deny('trip_configuration_required','Resolva as pendências de classificação e preço antes de receber.');
      const allocation = allocateTripPayments(source.remainingCents,data.payments),cash = allocation.rows.some(row => row.method === 'dinhe');
      if (cash !== (periodId !== null)) return deny('trip_cash_required','Dinheiro exige um caixa de passeios aberto. Outras formas não usam caixa.');
      if (paymentDate! > source.today && allocation.rows.some(row => row.status === 'confirmed')) return invalidTrip('Recebimento confirmado não pode ter data futura.');
      if (paymentDate! < source.today && (!actor.manager || !reason)) return deny('trip_payment_date_reason','Recebimento em data passada exige gerente e motivo.');
      for (const row of allocation.rows) {
        const inserted = await client.query<{ id: string }>(`INSERT INTO passeio_recebimentos(parque,agenda_id,cliente_id,method,amount_cents,tendered_cents,change_cents,status,payment_date,period_id,reference,actor_cpf,actor_name,confirmed_at)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::date,$10,$11,$12,$13,CASE WHEN $8='confirmed' THEN clock_timestamp() END) RETURNING id::text`,[park,key.agendaId,key.clientId,row.method,row.amountCents,row.tenderedCents,row.changeCents,row.status,paymentDate,row.method === 'dinhe' ? periodId : null,row.reference || null,cpf,actor.name]);
        paymentIds.push(Number(inserted.rows[0].id));
      }
    } else if (action === 'confirm_payment' || action === 'cancel_pending') {
      const paymentId = tripInteger(data.paymentId,Number.MAX_SAFE_INTEGER,1),payment = source.payments.find(row => row.id === paymentId);
      if (!payment || payment.status !== 'pending') return deny('trip_pending_payment_missing','Pagamento pendente não encontrado.');
      if (action === 'confirm_payment') {
        const reference = tripText(data.reference,200,true);
        if (paymentDate! > source.today) return invalidTrip('Recebimento confirmado não pode ter data futura.');
        if (paymentDate! < source.today && (!actor.manager || !reason)) return deny('trip_payment_date_reason','Recebimento em data passada exige gerente e motivo.');
        if (source.remainingCents === null || source.remainingCents < payment.amountCents) return deny('trip_payment_excess','A baixa excede o saldo atual. Confira o pagamento e o cálculo antes de confirmar.');
        await client.query("UPDATE passeio_recebimentos SET status='confirmed',reference=$2,payment_date=$3::date,confirmed_at=clock_timestamp() WHERE id=$1 AND status='pending'",[paymentId,reference,paymentDate]);
      } else { if (!reason) return invalidTrip('Informe o motivo do cancelamento.'); await client.query("UPDATE passeio_recebimentos SET status='cancelled' WHERE id=$1 AND status='pending'",[paymentId]); }
      paymentIds.push(paymentId);
    } else if (action === 'refund_online' || action === 'reverse_payment') {
      const reference = tripText(data.reference,200,true);
      if (!reason || paymentDate! > source.today) return invalidTrip('Informe o motivo e uma data de devolução válida.');
      if (paymentDate! < source.today && !actor.manager) return deny('trip_payment_date_reason','Devolução em data passada exige gerente e motivo.');
      if (action === 'refund_online') {
        const voucherId = tripInteger(data.voucherId,2147483647,1),participant = source.participants.find(row => row.voucherId === voucherId);
        if (!participant || !participant.refundRequested) return deny('trip_refund_missing','Selecione um ingresso marcado para reembolso.');
        if (participant.refundPaidAt) return deny('trip_refund_already_paid','Este reembolso já foi registrado.');
        if ((await client.query("SELECT idvoucher FROM voucher WHERE idvoucher=$1 AND stusado='s'",[voucherId])).rowCount) return deny('trip_refund_used','O ingresso já foi usado. Confira a entrada antes da devolução.');
        if (!['dinhe','pix','trans','credi','debit'].includes(String(data.method)) || (data.method === 'dinhe') !== (session !== null)) return invalidTrip('Selecione a forma de devolução e o caixa quando for dinheiro.');
        if (session && participant.paidCents > 0) await cashRefund(client,session,participant.paidCents,'passeio_refund',voucherId,reason,actor);
        await client.query(`UPDATE passeio_participantes SET refund_paid_cents=$3,refund_reference=$4,refund_paid_at=($5::date::timestamp AT TIME ZONE 'America/Sao_Paulo'),refund_period_id=$6,refund_method=$7,updated_by=$8,updated_at=clock_timestamp()
          WHERE parque=$1 AND voucher_id=$2 AND refund_requested AND refund_paid_at IS NULL`,[park,voucherId,participant.paidCents,reference,paymentDate,periodId,data.method,cpf]);
        await client.query("UPDATE voucher SET stusado='inv' WHERE idvoucher=$1",[voucherId]);
      } else {
        const paymentId = tripInteger(data.paymentId,Number.MAX_SAFE_INTEGER,1),payment = source.payments.find(row => row.id === paymentId);
        if (!payment || payment.status !== 'confirmed' || payment.reversed) return deny('trip_payment_reversed','Recebimento confirmado não encontrado ou já estornado.');
        if ((payment.method === 'dinhe') !== (session !== null)) return invalidTrip('A devolução em dinheiro exige um caixa de passeios aberto.');
        await client.query('INSERT INTO passeio_recebimento_estornos(payment_id,parque,payment_date,period_id,reference,reason,actor_cpf,actor_name) VALUES($1,$2,$3::date,$4,$5,$6,$7,$8)',[paymentId,park,paymentDate,periodId,reference,reason,cpf,actor.name]);
        if (session) await cashRefund(client,session,payment.amountCents,'passeio_payment_refund',paymentId,reason,actor);
        paymentIds.push(paymentId);
      }
    } else if (action === 'finalize') {
      if (!source.calculation || source.blockingIssues.length) return deny('trip_configuration_required','Resolva as pendências de classificação e preço antes de finalizar.');
      if (source.remainingCents !== 0 || source.pendingPaymentCents !== 0) return deny('trip_payment_incomplete','A finalização exige recebimento integral confirmado e nenhum pagamento pendente.');
      if (typeof data.acknowledgeWarnings !== 'boolean') return invalidTrip();
      if (source.warnings.length && (!data.acknowledgeWarnings || !reason)) return deny('trip_warnings_required','Confira os avisos e registre o motivo para finalizar com exceção.');
      receiptId = randomUUID();
      await client.query('INSERT INTO passeio_recibos(id,parque,agenda_id,cliente_id,visit_date,source_fingerprint,snapshot,actor_cpf,actor_name) VALUES($1,$2,$3,$4,$5::date,$6,$7::jsonb,$8,$9)',[receiptId,park,key.agendaId,key.clientId,source.date,source.fingerprint,JSON.stringify(source),cpf,actor.name]);
      await client.query('UPDATE passeio_operacao SET finalized_receipt_id=$4 WHERE parque=$1 AND agenda_id=$2 AND cliente_id=$3',[park,key.agendaId,key.clientId,receiptId]);
    } else if (action === 'reopen') {
      if (!source.receiptId || !reason) return invalidTrip('Informe um passeio finalizado e o motivo da revisão.');
      await client.query('INSERT INTO passeio_recibo_revisoes(receipt_id,reason,actor_cpf,actor_name) VALUES($1,$2,$3,$4)',[source.receiptId,reason,cpf,actor.name]);
      await client.query('UPDATE passeio_operacao SET finalized_receipt_id=NULL WHERE parque=$1 AND agenda_id=$2 AND cliente_id=$3',[park,key.agendaId,key.clientId]); receiptId = null;
    }
    await client.query('UPDATE passeio_operacao SET financial_version=financial_version+1,updated_at=clock_timestamp(),updated_by=$4 WHERE parque=$1 AND agenda_id=$2 AND cliente_id=$3',[park,key.agendaId,key.clientId,cpf]);
    await registerOpsAuditLog(client,{ origem: 'painel-passeios',acao: action,descricao: `Operação financeira do passeio #${key.agendaId}.`,motivo: reason || 'Registro financeiro confirmado pelo operador',usuarioNome: actor.name,
      detalhes: { ...key,actorCpf: cpf,receiptId,paymentIds,voucherId: data.voucherId,version: version+1,sourceFingerprint: source.fingerprint } },'postgres');
    await assertDatesOpen(client,dates);
    if (periodId !== null && paymentDate !== await currentDate(client)) return deny('trip_cash_date_changed','A data mudou durante o recebimento. Confira o caixa de hoje.');
    const confirmedAt = (await client.query<{ time: Date }>('SELECT clock_timestamp() AS time')).rows[0].time.toISOString();
    const result = { commandId: randomUUID(),...key,version: version+1,receiptId,paymentIds,confirmedAt };
    await client.query('INSERT INTO financeiro_comandos(id,parque,idempotency_key,action,request_hash,actor_cpf,result) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb)',[result.commandId,park,idempotencyKey,action,hash,cpf,JSON.stringify(result)]);
    return result;
  });
}
