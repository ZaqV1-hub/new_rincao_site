import type { PoolClient } from 'pg';
import { randomUUID } from 'node:crypto';
import { getOperationalCatalogPool } from './painel-operational-catalog';
import { getOperationalParkId } from './operational-day-contract';
import { isCivilDate } from './operational-date';
import { lockOperationalDay } from './operational-day-lock';
import { lockOpenCashSession,readCashSessionSnapshot } from './operational-cash-session';
import { registerOpsAuditLog } from './ops-audit-log';
import { invalidTrip,tripInteger,tripRecord,tripText,TripSettlementError,type TripFinancialActor } from './trip-settlement-contract';
import { tripFingerprint } from './trip-settlement-source';
export type OperationalExpense = { id: number; date: string; scope: 'day' | 'trips'; agendaId: number | null; clientId: number | null; description: string;
  category: string; amountCents: number; method: string; periodId: number | null; reference: string; actorName: string | null; createdAt: string };
function parkInput() { const park = getOperationalParkId(); if (park !== 'rincao') throw new TripSettlementError('expense_rules_pending','As despesas da Estância aguardam a confirmação da regra de negócio.'); return park; }
export async function listOperationalExpenses(date: string,client?: Pick<PoolClient,'query'>): Promise<OperationalExpense[]> {
  const park = parkInput(); if (!isCivilDate(date)) return invalidTrip();
  const rows = (await (client ?? getOperationalCatalogPool()).query<Omit<OperationalExpense,'id' | 'amountCents'> & { id: string; amountCents: string }>(`SELECT id::text,visit_date::text AS date,scope,agenda_id AS "agendaId",cliente_id AS "clientId",description,category,amount_cents::text AS "amountCents",method,period_id AS "periodId",reference,actor_name AS "actorName",created_at::text AS "createdAt"
    FROM operacao_despesas WHERE parque=$1 AND visit_date=$2::date ORDER BY id`,[park,date])).rows;
  return rows.map(row => ({ ...row,id: tripInteger(Number(row.id),Number.MAX_SAFE_INTEGER,1),amountCents: tripInteger(Number(row.amountCents)) }));
}
export async function createOperationalExpense(value: unknown,actor: TripFinancialActor): Promise<{ commandId: string; expenseId: number; confirmedAt: string }> {
  const park = parkInput();
  if (!actor.cpf || !/^\d{11}$/.test(actor.cpf)) throw new TripSettlementError('trip_actor_required','Operador não identificado.',403);
  const row = tripRecord(value,['date','scope','agendaId','clientId','description','category','amountCents','method','periodId','reference','reason','idempotencyKey']);
  if (!isCivilDate(row.date) || !['day','trips'].includes(String(row.scope)) || !['monitoria','alimentacao','transporte','atividades','materiais','outros'].includes(String(row.category)) || !['dinhe','pix','company_card'].includes(String(row.method))) return invalidTrip();
  const date = row.date,description = tripText(row.description,300,true),reference = tripText(row.reference,200,true),reason = tripText(row.reason ?? '',1000),amountCents = tripInteger(row.amountCents,9999999999,1);
  const agendaId = row.agendaId === null ? null : tripInteger(row.agendaId,2147483647,1),clientId = row.clientId === null ? null : tripInteger(row.clientId,2147483647,1),periodId = row.periodId === null ? null : tripInteger(row.periodId,2147483647,1);
  if ((agendaId === null) !== (clientId === null) || (agendaId !== null && row.scope !== 'trips') || (row.method === 'dinhe') !== (periodId !== null)) return invalidTrip();
  const key = tripText(row.idempotencyKey,100,true); if (!/^[A-Za-z0-9:_-]+$/.test(key)) return invalidTrip();
  const hash = tripFingerprint({ action: 'expense',row }),client = await getOperationalCatalogPool().connect(); let discard = false;
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`finance-command:${park}:${key}`]);
    const previous = (await client.query<{ actor_cpf: string; request_hash: string; result: { commandId: string; expenseId: number; confirmedAt: string } }>('SELECT actor_cpf,request_hash,result FROM financeiro_comandos WHERE parque=$1 AND idempotency_key=$2',[park,key])).rows[0];
    if (previous) {
      if (previous.actor_cpf !== actor.cpf) throw new TripSettlementError('trip_command_forbidden','Esta tentativa pertence a outro operador.',403);
      if (previous.request_hash !== hash) throw new TripSettlementError('trip_idempotency_conflict','Esta chave pertence a outra operação. Confira a tentativa original.');
      await client.query('COMMIT'); return previous.result;
    }
    if (periodId !== null) {
      const period = (await client.query<{ date: string }>('SELECT data_operacional::text AS date FROM caixa_periodos WHERE id=$1 AND parque=$2',[periodId,park])).rows[0];
      if (!period || period.date !== date) throw new TripSettlementError('expense_cash_date','O caixa deve pertencer à data da despesa.');
    }
    await lockOperationalDay(client,park,date);
    const state = (await client.query<{ today: string; closed: boolean }>(`SELECT (clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date::text AS today,
      EXISTS(SELECT 1 FROM operacao_dias WHERE parque=$1 AND data=$2::date AND estado='closed') AS closed`,[park,date])).rows[0];
    if (state.closed) throw new TripSettlementError('expense_day_closed','O dia está finalizado. Registre a pendência para revisão gerencial.');
    if (date !== state.today && (!actor.manager || !reason)) throw new TripSettlementError('expense_date_reason','Despesa fora de hoje exige gerente e motivo.');
    const session = periodId === null ? null : await lockOpenCashSession(client,{ periodId,date,...(row.scope === 'trips' ? { expectedType: 'trips' as const } : {}) });
    if (session && (await readCashSessionSnapshot(client,session)).expectedCashCents < amountCents) throw new TripSettlementError('expense_cash_insufficient','O caixa não possui dinheiro suficiente para esta despesa.');
    if (agendaId !== null) {
      const trip = (await client.query<{ date: string }>(`SELECT a.dtagenda::text AS date FROM agenda a JOIN agenda_extras ae ON ae.idagenda=a.idagenda WHERE ae.idagenda=$1 AND ae.idcliente=$2 FOR SHARE OF a,ae`,[agendaId,clientId])).rows[0];
      if (!trip || trip.date !== date) throw new TripSettlementError('expense_trip_mismatch','O passeio não pertence a esta data.');
      await client.query('INSERT INTO passeio_operacao(parque,agenda_id,cliente_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[park,agendaId,clientId]);
    }
    const expense = (await client.query<{ id: string }>(`INSERT INTO operacao_despesas(parque,visit_date,scope,agenda_id,cliente_id,description,category,amount_cents,method,period_id,reference,actor_cpf,actor_name)
      VALUES($1,$2::date,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id::text`,[park,date,row.scope,agendaId,clientId,description,row.category,amountCents,row.method,periodId,reference,actor.cpf,actor.name])).rows[0];
    const expenseId = Number(expense.id);
    if (periodId !== null) await client.query(`INSERT INTO movimentacao_caixa(tipo,responsavel,valor,periodo_id,motivo,ator_nome,ator_cpf,origem_tipo,origem_id)
      VALUES('despesa',$1,($2::numeric/100)::numeric(12,2),$3,$4,$1,$5,'operacao_despesa',$6)`,[actor.name?.slice(0,100) || actor.cpf,amountCents,periodId,description,actor.cpf,expenseId]);
    await registerOpsAuditLog(client,{ origem: 'painel-despesas',acao: 'create',descricao: 'Despesa operacional registrada.',motivo: reason || 'Despesa conferida pelo operador',usuarioNome: actor.name,detalhes: { expenseId,date,scope: row.scope,agendaId,clientId,periodId,amountCents,actorCpf: actor.cpf } },'postgres');
    if (periodId !== null && date !== (await client.query<{ date: string }>("SELECT (clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date::text AS date")).rows[0].date) throw new TripSettlementError('expense_date_changed','A data mudou durante a operação. Confira o caixa de hoje.');
    const confirmedAt = (await client.query<{ time: Date }>('SELECT clock_timestamp() AS time')).rows[0].time.toISOString(),result = { commandId: randomUUID(),expenseId,confirmedAt };
    await client.query("INSERT INTO financeiro_comandos(id,parque,idempotency_key,action,request_hash,actor_cpf,result) VALUES($1,$2,$3,'expense',$4,$5,$6::jsonb)",[result.commandId,park,key,hash,actor.cpf,JSON.stringify(result)]);
    await client.query('COMMIT'); return result;
  } catch (error) { try { await client.query('ROLLBACK'); } catch { discard = true; } throw error; } finally { client.release(discard); }
}
