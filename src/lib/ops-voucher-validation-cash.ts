import type { PoolClient } from "pg";
import { lockOpenCashSession, type CashSession } from "@/lib/operational-cash-session";
import { getOperationalParkId } from "@/lib/operational-day-contract";
import { lockOperationalDay } from "@/lib/operational-day-lock";
import { getSaoPauloToday, isCivilDate } from "@/lib/operational-date";
import { VoucherOperationError, type VoucherValidationRow } from "@/lib/ops-voucher-validation-contract";

type Period = { id: number; parque: string | null; date: string | null; closed: boolean };
export type VoucherCashContext = { session: CashSession; periods?: Map<number, Period>; dates?: Set<string> };
export function requireVoucherPeriodId(periodId: unknown): number {
  if (typeof periodId !== "number" || !Number.isSafeInteger(periodId) || periodId <= 0) {
    throw new VoucherOperationError("cash_session_required", "Selecione explicitamente um caixa de vendas aberto para esta operação.", 409);
  }
  return periodId;
}
export async function lockVoucherCashContext(client: PoolClient, periodId: number | undefined, date: string,
  reversal?: { voucherIds: number[] } | { purchaseId: number }): Promise<VoucherCashContext> {
  const id = requireVoucherPeriodId(periodId); const park = getOperationalParkId();
  if (!reversal) return { session: await lockOpenCashSession(client, { periodId: id, expectedType: "sales", date }) };
  const rows = (await client.query<{ dtuso: string | null; periods: number[] }>(`SELECT voucher.dtuso::text,
    array_remove(ARRAY[voucher.validacao_periodo_id,voucher.periodo_id,compra.caixa_periodo_id],NULL) ||
      ARRAY(SELECT periodo_id FROM compra_pagamentos WHERE idcompra=voucher.idcompra AND periodo_id IS NOT NULL) AS periods
    FROM voucher JOIN compra ON compra.idcompra=voucher.idcompra
    WHERE ${"voucherIds" in reversal ? "voucher.idvoucher=ANY($1::int[])" : "voucher.idcompra=$1"}`,
  ["voucherIds" in reversal ? reversal.voucherIds : reversal.purchaseId])).rows;
  const periodIds = [...new Set([id, ...rows.flatMap((row) => row.periods)])].sort((a, b) => a - b);
  const discovered = (await client.query<Period>(`SELECT id,parque,data_operacional::text AS date,fechado_em IS NOT NULL OR folha_id IS NOT NULL OR EXISTS
    (SELECT 1 FROM caixa_fechamentos f WHERE f.periodo_id=caixa_periodos.id) AS closed FROM caixa_periodos WHERE id=ANY($1::int[])`, [periodIds])).rows;
  if (discovered.some((period) => period.parque !== null && period.parque !== park)) throw new VoucherOperationError("voucher_park_mismatch", "O ingresso pertence a outro parque.", 409);
  const dates = new Set([date, ...rows.map((row) => row.dtuso), ...discovered.map((period) => period.date)].filter((day): day is string => isCivilDate(day)));
  for (const day of [...dates].sort()) await lockOperationalDay(client, park, day);
  const days = (await client.query<{ estado: string }>("SELECT estado FROM operacao_dias WHERE parque=$1 AND data=ANY($2::date[]) ORDER BY data FOR UPDATE", [park, [...dates].sort()])).rows;
  if (days.some((day) => day.estado === "closed")) throw new VoucherOperationError("voucher_day_closed", "O dia da operação ou da validação original está finalizado.", 409);
  const locked = (await client.query<Period>(`SELECT id,parque,data_operacional::text AS date,fechado_em IS NOT NULL OR folha_id IS NOT NULL OR EXISTS
    (SELECT 1 FROM caixa_fechamentos f WHERE f.periodo_id=caixa_periodos.id) AS closed FROM caixa_periodos WHERE id=ANY($1::int[]) ORDER BY id FOR UPDATE`, [periodIds])).rows;
  if (locked.some((period) => period.closed)) throw new VoucherOperationError("voucher_cash_closed", "O ingresso faz parte de um caixa ou fechamento encerrado. O histórico não pode ser alterado.", 409);
  if (locked.some((period) => period.parque !== null && period.parque !== park || period.date !== null && !dates.has(period.date))) throw new VoucherOperationError("voucher_context_changed", "O contexto do ingresso mudou. Atualize antes de tentar novamente.", 409);
  const session = await lockOpenCashSession(client, { periodId: id, expectedType: "sales", date });
  return { session, dates, periods: new Map(locked.map((period) => [period.id, period])) };
}
export function assertVoucherCashDate(context: VoucherCashContext, date: string) {
  if (context.session.date !== date || date !== getSaoPauloToday()) throw new VoucherOperationError("cash_session_date_invalid", "A data do caixa mudou. Selecione um caixa aberto para hoje.", 409);
}
export function assertVoucherReversalAllowed(row: VoucherValidationRow, context: VoucherCashContext) {
  assertVoucherCashDate(context, context.session.date);
  if (row.parque_operacional && row.parque_operacional !== context.session.park) throw new VoucherOperationError("voucher_park_mismatch", "O ingresso pertence a outro parque.", 409);
  if (row.closed_at) throw new VoucherOperationError("voucher_cash_closed", "O ingresso já consta em um fechamento. O histórico não pode ser alterado.", 409);
  if ((row.dtuso && !context.dates?.has(row.dtuso)) || [row.validacao_periodo_id, row.periodo_id, row.caixa_periodo_id, ...row.payment_period_ids ?? []].some((id) => id != null && !context.periods?.has(id))) {
    throw new VoucherOperationError("voucher_context_changed", "O contexto do ingresso mudou. Atualize antes de tentar novamente.", 409);
  }
}
