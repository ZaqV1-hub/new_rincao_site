import type { PoolClient } from 'pg';
import { getOperationalCatalogPool } from './painel-operational-catalog';
import { getOperationalParkId } from './operational-day-contract';
import { isCivilDate } from './operational-date';
import { listCashSessions,readCashSessionSnapshot,type CashSessionDetail } from './operational-cash-session';
import { listOperationalExpenses } from './operational-expenses';
import { readTripSettlementSource } from './trip-settlement-source';
import { readTripReceipt,type TripSettlementDetail } from './trip-settlement';
import { invalidTrip,tripInteger } from './trip-settlement-contract';
export async function readOperationalTripDay(client: PoolClient,date: string) {
  if (!isCivilDate(date)) return invalidTrip();
  const park = getOperationalParkId();
  const keys = (await client.query<{ agendaId: number; clientId: number }>(`SELECT ae.idagenda AS "agendaId",ae.idcliente AS "clientId" FROM agenda_extras ae JOIN agenda a ON a.idagenda=ae.idagenda WHERE a.dtagenda=$1::date AND ae.idcliente IS NOT NULL ORDER BY ae.idagenda,ae.idcliente`,[date])).rows;
  const trips: TripSettlementDetail[] = [];
  for (const key of keys) { const source = await readTripSettlementSource(client,key); trips.push({ source,receipt: await readTripReceipt(client,source.receiptId),history: [] }); }
  const sessions: CashSessionDetail[] = [];
  for (const session of (await listCashSessions(date,client)).filter(s => s.type === 'trips')) sessions.push({ ...session,snapshot: await readCashSessionSnapshot(client,session) });
  const expenses = park === 'rincao' ? (await listOperationalExpenses(date,client)).filter(e => e.scope === 'trips') : null;
  const revenueCents = tripInteger(trips.reduce((sum,t) => sum+(t.receipt?.snapshot.calculation?.totalTripCents ?? 0),0),Number.MAX_SAFE_INTEGER);
  const expenseCents = expenses === null ? null : tripInteger(expenses.reduce((sum,e) => sum+e.amountCents,0),Number.MAX_SAFE_INTEGER);
  const paymentTotals = new Map<string,number>();
  for (const trip of trips) if (trip.receipt) {
    const source = trip.receipt.snapshot;
    paymentTotals.set('online',(paymentTotals.get('online') ?? 0)+(source.calculation?.onlinePresentCents ?? 0));
    for (const p of source.payments) if (p.status === 'confirmed' && !p.reversed) paymentTotals.set(p.method,(paymentTotals.get(p.method) ?? 0)+p.amountCents);
  }
  const meta = (await client.query<{ today: string; closed: boolean; generatedAt: Date }>(`SELECT (clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date::text AS today,clock_timestamp() AS "generatedAt",EXISTS(SELECT 1 FROM operacao_dias WHERE parque=$1 AND data=$2::date AND estado='closed') AS closed`,[park,date])).rows[0];
  return { park,date,today: meta.today,closed: meta.closed,generatedAt: meta.generatedAt.toISOString(),trips,sessions,expenses,
    revenueCents,expenseCents,resultCents: expenseCents === null ? null : revenueCents-expenseCents,
    expectedCashCents: sessions.reduce((sum,s) => sum+s.snapshot.expectedCashCents,0),
    payments: [...paymentTotals].map(([method,amountCents]) => ({ method,amountCents: tripInteger(amountCents,Number.MAX_SAFE_INTEGER) })),
    refundsPendingCents: trips.reduce((sum,t) => sum+t.source.participants.filter(p => p.refundRequested && !p.refundPaidAt).reduce((value,p) => value+p.paidCents,0),0) };
}
export type OperationalTripDay = Awaited<ReturnType<typeof readOperationalTripDay>>;
export async function getOperationalTripDay(date: string): Promise<OperationalTripDay> {
  const client = await getOperationalCatalogPool().connect(); let discard = false;
  try { await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'); const day = await readOperationalTripDay(client,date); await client.query('COMMIT'); return day; }
  catch (error) { try { await client.query('ROLLBACK'); } catch { discard = true; } throw error; } finally { client.release(discard); }
}
