import { assertOnlineCapacityReleased, OnlineCapacityError } from "@/lib/online-capacity";
import { VoucherValidationRow, VoucherAgendaUsageResult, VoucherOperationError } from "@/lib/ops-voucher-validation-contract";
export { VoucherOperationError } from "@/lib/ops-voucher-validation-contract";
export type { VoucherValidationRow, SchoolTripVoucherRow, VoucherOperationMode, VoucherOperationSuccess, VoucherOperationInputActor, VoucherAgendaUsageResult } from "@/lib/ops-voucher-validation-contract";
export { buildAuditActorName, normalizeCpfDigits, getAffectedVoucherRows, collectAffectedAgendaIds, resolveAuditPurchaseId, buildVoucherAuditDescription, buildVoucherAuditReason, registerVoucherOperationAuditLog } from "@/lib/ops-voucher-validation-audit";
import { type PoolClient } from "pg";
import { getSchoolPaymentHold } from "@/lib/school-payment-eligibility";
import { lockOperationalDay } from "@/lib/operational-day-lock";
import { getOperationalParkId } from "@/lib/operational-day-contract";
import { getSaoPauloToday, isCivilDate } from "@/lib/operational-date";
import { syncTicketValidation } from "@/lib/ticket-service";
import { CashSessionError } from "@/lib/operational-cash-session";
import { assertVoucherCashDate, type VoucherCashContext } from "@/lib/ops-voucher-validation-cash";
import type { VoucherOperationInputActor } from "@/lib/ops-voucher-validation-contract";
export { requireVoucherPeriodId, lockVoucherCashContext, assertVoucherReversalAllowed } from "@/lib/ops-voucher-validation-cash";

export function getSaoPauloDateParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = formatter.formatToParts(date);
  const valueByType = new Map(parts.map((part) => [part.type, part.value]));

  return {
    date: `${valueByType.get("year")}-${valueByType.get("month")}-${valueByType.get("day")}`,
    time: `${valueByType.get("hour")}:${valueByType.get("minute")}:${valueByType.get("second")}`,
  };
}

export function formatDateBr(value: string | null) {
  if (!value) {
    return "Nao informada";
  }

  const match = String(value).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return "Nao informada";
  }

  return `${match[3]}/${match[2]}/${match[1]}`;
}

export function normalizeVoucherNumber(value: string) {
  return value.trim().toUpperCase();
}

export function normalizeVoucherIds(voucherIds: number[]) {
  return Array.from(
    new Set(
      voucherIds.filter(
        (voucherId) => Number.isInteger(voucherId) && voucherId > 0,
      ),
    ),
  );
}

export function isPromotionalAgenda(type: string | null) {
  return String(type ?? "").trim().toLowerCase() === "promo";
}

export function addMonthsToDateString(value: string | null, months: number) {
  if (!value) {
    return null;
  }

  const [year, month, day] = value.slice(0, 10).split("-").map(Number);

  if (!year || !month || !day) {
    return null;
  }

  const lastDayOfTargetMonth = new Date(
    Date.UTC(year, month - 1 + months + 1, 0),
  ).getUTCDate();
  const targetDay = Math.min(day, lastDayOfTargetMonth);

  return new Date(Date.UTC(year, month - 1 + months, targetDay))
    .toISOString()
    .slice(0, 10);
}

export function isVoucherExpired(row: VoucherValidationRow, todayDate: string) {
  const validUntil = row.dtinicio_validade != null
    ? row.dtvalidade
    : addMonthsToDateString(row.dtcompra, 6);

  return (
    String(row.stvoucher ?? "").trim() === "vencido" ||
    Boolean(validUntil && todayDate > validUntil)
  );
}

export function isOnlinePurchasePaid(row: VoucherValidationRow) {
  return row.stcompra === "conc" && [3, 4].includes(Number(row.payment_status));
}

export function isReservationPaid(row: VoucherValidationRow) {
  const paymentMethod = String(row.formapag ?? "").trim().toUpperCase();

  return row.stcompra === "conc" && paymentMethod !== "" && paymentMethod !== "N/A";
}

export function buildReservationPaymentMessage(row: VoucherValidationRow) {
  return `A Reserva do Voucher ${row.numvoucher ?? ""} esta agendada para o dia ${formatDateBr(row.dtagenda)}. Dirija-se a bilheteria para efetuar o pagamento.`;
}

export function buildAlreadyUsedMessage(row: VoucherValidationRow) {
  return `Voucher ${row.numvoucher ?? ""} ja utilizado em: ${formatDateBr(row.dtuso)} ${String(row.hruso ?? "").trim()}. Local: ${row.validacao_local_nome || "não registrado"}.`.trim();
}

export function alreadyUsedError(row: VoucherValidationRow) {
  const error = new VoucherOperationError("voucher_already_used", buildAlreadyUsedMessage(row), 409);
  error.details = { validation: { periodId: row.validacao_periodo_id ?? null, locationName: row.validacao_local_nome ?? null, actorName: row.validado_por_nome ?? null,
    validatedAt: row.validado_em ?? null, date: row.dtuso, time: row.hruso } };
  return error;
}

export function evaluateAgendaUsage(
  row: VoucherValidationRow,
  _confirm: boolean,
  todayDate: string,
): VoucherAgendaUsageResult {
  const visitDate = String(row.dtagenda ?? "").slice(0, 10);

  if (!visitDate) {
    return {
      status: "ok" as const,
    };
  }

  if (visitDate === todayDate || isPromotionalAgenda(row.tpagenda)) {
    return {
      status: "ok" as const,
    };
  }

  return {
    status: "ok" as const,
  };
}

export type VoucherAdmissionContext = VoucherCashContext | { kind: 'gate'; park: string; date: string };
function assertAdmissionDate(context: VoucherAdmissionContext, date: string) {
  if ('kind' in context) {
    if (context.park !== getOperationalParkId() || context.date !== date || date !== getSaoPauloToday()) throw new VoucherOperationError('gate_date_invalid','A data de entrada mudou. Confira novamente.',409);
  } else assertVoucherCashDate(context,date);
}
export async function markVoucherUsed(
  client: PoolClient,
  voucherId: number,
  date: string,
  time: string,
  context: VoucherAdmissionContext,
  actor?: VoucherOperationInputActor | null,
) {
  const park = getOperationalParkId();
  assertAdmissionDate(context, date);
  if ('kind' in context) {
    await lockOperationalDay(client, getOperationalParkId(), date);
    const open = await client.query(`SELECT a.idagenda FROM agenda a WHERE a.dtagenda=$2::date AND a.tpagenda IN ('padra','promo') AND a.stagenda IN ('abe','lot')
      AND NOT EXISTS(SELECT 1 FROM operacao_dias WHERE parque=$1 AND data=$2::date AND estado='closed') LIMIT 1 FOR SHARE OF a`,[park,date]);
    if (!open.rowCount) throw new VoucherOperationError('voucher_day_closed','Não há day use aberto nesta data.',409);
  }
  await client.query("SELECT idcompra FROM compra WHERE idcompra IN (SELECT idcompra FROM voucher WHERE idvoucher=$1) FOR UPDATE", [voucherId]);
  const voucher = await client.query<Pick<VoucherValidationRow,
    "idcompra" | "dtinicio_validade" | "dtvalidade" | "parque_operacional" | "stusado" | "stvoucher" | "tpvoucher" | "servico_id"
  >>(`select idcompra, dtinicio_validade::text, dtvalidade::text, parque_operacional, stusado, stvoucher,tpvoucher,servico_id
      from voucher where idvoucher=$1 FOR UPDATE`, [voucherId]);
  const row = voucher.rows[0];
  if (!row) throw new VoucherOperationError("voucher_not_found", "Ingresso não encontrado.", 404);
  if (row.stusado !== "n") throw new VoucherOperationError("voucher_already_used", "Ingresso já utilizado ou indisponível para entrada.", 409);
  if (row?.dtinicio_validade != null) {
    if (row.parque_operacional !== park || !isCivilDate(row.dtinicio_validade) ||
      !isCivilDate(row.dtvalidade) || row.dtinicio_validade > row.dtvalidade || !isCivilDate(date)) {
      throw new VoucherOperationError("voucher_validity_invalid", "Validade do ingresso inconsistente. Procure o atendimento.", 409);
    }
    if (row.stusado !== "n") {
      throw new VoucherOperationError("voucher_already_used", "Ingresso já utilizado ou indisponível para entrada.", 409);
    }
    if (String(row.stvoucher ?? "").trim() === "vencido" || date > row.dtvalidade) {
      throw new VoucherOperationError("voucher_expired", `Ingresso vencido em ${formatDateBr(row.dtvalidade)}. A entrada não está autorizada.`, 409);
    }
    if (date < row.dtinicio_validade) {
      throw new VoucherOperationError("voucher_not_yet_valid", `Ingresso válido a partir de ${formatDateBr(row.dtinicio_validade)}.`, 409);
    }
    const openDay = await client.query(`
      SELECT agenda.idagenda FROM agenda
      WHERE agenda.dtagenda = $2::date
        AND agenda.tpagenda IN ('padra', 'promo') AND agenda.stagenda IN ('abe', 'lot')
        AND NOT EXISTS (
          SELECT 1 FROM operacao_dias WHERE parque = $1 AND data = $2::date AND estado = 'closed'
        )
      LIMIT 1 FOR SHARE OF agenda
    `, [park, date]);
    if (openDay.rows.length === 0) {
      throw new VoucherOperationError("voucher_day_closed", "Não há day use aberto nesta data. Utilize o ingresso em um dia aberto dentro da validade.", 409);
    }
  }
  const hold = row?.idcompra ? await getSchoolPaymentHold(client, row.idcompra) : null;
  if (hold && hold.status !== "released") throw new VoucherOperationError("school_payment_held", "Pagamento contabilizado; ingresso retido para análise do atendimento.", 409);
  if (row?.idcompra) {
    try { await assertOnlineCapacityReleased(client, row.idcompra); }
    catch (error) {
      if (error instanceof OnlineCapacityError && error.code === "online_capacity_delivery_hold") {
        throw new VoucherOperationError(error.code, "Pagamento confirmado; ingresso retido para análise da capacidade pelo atendimento.", 409);
      }
      throw error;
    }
  }
  assertAdmissionDate(context, date);
  const updated = await client.query(
    `
      UPDATE voucher
      SET stusado = 's',
          dtuso = $2,
          hruso = $3,
          validacao_periodo_id = $4,
          validado_em = clock_timestamp(),
          validado_por_nome = $5,
          validado_por_cpf = $6
      WHERE idvoucher = $1 AND stusado = 'n'
        AND $2::date = (clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date
    `,
    [voucherId, date, time, 'kind' in context ? null : context.session.id, actor?.name?.trim() || null, String(actor?.cpf ?? "").replace(/\D/g, "") || null],
  );
  if (updated.rowCount === 0) throw new VoucherOperationError("cash_date_not_today", "A data do caixa terminou. Atualize a tela.", 409);
}

export async function markVoucherUnused(client: PoolClient, voucherId: number, date: string) {
  const updated = await client.query(
    `
      UPDATE voucher
      SET stusado = 'n',
          dtuso = NULL,
          hruso = NULL,
          validacao_periodo_id = NULL,
          validado_em = NULL,
          validado_por_nome = NULL,
          validado_por_cpf = NULL
      WHERE idvoucher = $1 AND $2::date = (clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date
    `,
    [voucherId, date],
  );
  if (updated.rowCount === 0) throw new VoucherOperationError("cash_date_not_today", "A data do caixa terminou. Atualize a tela.", 409);
}

export async function markVoucherInvalid(
  client: PoolClient,
  voucherId: number,
  date: string,
  time: string,
) {
  const updated = await client.query(
    `
      UPDATE voucher
      SET stusado = 'inv',
          dtuso = $2,
          hruso = $3
      WHERE idvoucher = $1 AND $2::date = (clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date
    `,
    [voucherId, date, time],
  );
  if (updated.rowCount === 0) throw new VoucherOperationError("cash_date_not_today", "A data do caixa terminou. Atualize a tela.", 409);
}

export async function appendTicketWarnings(
  warnings: string[],
  action: "validate" | "unvalidate" | "invalidate",
  pairs: Array<{ purchaseId: number; voucherId: number }>,
) {
  if (pairs.length === 0) {
    return warnings;
  }

  let result;

  try {
    result = await syncTicketValidation(pairs, action);
  } catch {
    return [
      ...warnings,
      "A operação foi registrada no site, mas não foi possível comunicar a alteração ao serviço externo de ingressos.",
    ];
  }

  if (result.status === "sent") {
    return warnings;
  }

  console.warn("voucher-external-sync-skipped", { action, pairs, reason: result.skippedReason });
  return [
    ...warnings,
    "A operação foi registrada no site, mas não foi possível comunicar a alteração ao serviço externo de ingressos.",
  ];
}

export function asVoucherOperationError(error: unknown) {
  if (error instanceof VoucherOperationError) {
    return error;
  }
  if (error instanceof CashSessionError) return new VoucherOperationError(error.code, error.message, error.status);

  return new VoucherOperationError(
    "voucher_operation_unavailable",
    "Nao foi possivel concluir a operacao de voucher agora.",
    502,
  );
}
