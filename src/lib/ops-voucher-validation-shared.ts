import { VoucherValidationRow, VoucherAgendaUsageResult, VoucherOperationError } from "@/lib/ops-voucher-validation-contract";
export { VoucherOperationError } from "@/lib/ops-voucher-validation-contract";
export type { VoucherValidationRow, SchoolTripVoucherRow, VoucherOperationMode, VoucherOperationSuccess, VoucherOperationInputActor, VoucherAgendaUsageResult } from "@/lib/ops-voucher-validation-contract";
export { buildAuditActorName, normalizeCpfDigits, getAffectedVoucherRows, collectAffectedAgendaIds, resolveAuditPurchaseId, buildVoucherAuditDescription, buildVoucherAuditReason, registerVoucherOperationAuditLog } from "@/lib/ops-voucher-validation-audit";
import { type PoolClient } from "pg";
import { getSchoolPaymentHold } from "@/lib/school-payment-eligibility";
import { syncTicketValidation } from "@/lib/ticket-service";

export function getSaoPauloDateParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
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
  const validUntil = addMonthsToDateString(row.dtcompra, 6);

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
  return `Voucher ${row.numvoucher ?? ""} ja utilizado em: ${formatDateBr(row.dtuso)} ${String(row.hruso ?? "").trim()}`.trim();
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

export async function markVoucherUsed(
  client: PoolClient,
  voucherId: number,
  date: string,
  time: string,
) {
  const voucher = await client.query<{ idcompra: number }>("select idcompra from voucher where idvoucher=$1", [voucherId]);
  const hold = voucher.rows[0] ? await getSchoolPaymentHold(client, voucher.rows[0].idcompra) : null;
  if (hold && hold.status !== "released") throw new VoucherOperationError("school_payment_held", "Pagamento contabilizado; ingresso retido para análise do atendimento.", 409);
  await client.query(
    `
      UPDATE voucher
      SET stusado = 's',
          dtuso = $2,
          hruso = $3
      WHERE idvoucher = $1
    `,
    [voucherId, date, time],
  );
}

export async function markVoucherUnused(client: PoolClient, voucherId: number) {
  await client.query(
    `
      UPDATE voucher
      SET stusado = 'n',
          dtuso = NULL,
          hruso = NULL
      WHERE idvoucher = $1
    `,
    [voucherId],
  );
}

export async function markVoucherInvalid(
  client: PoolClient,
  voucherId: number,
  date: string,
  time: string,
) {
  await client.query(
    `
      UPDATE voucher
      SET stusado = 'inv',
          dtuso = $2,
          hruso = $3
      WHERE idvoucher = $1
    `,
    [voucherId, date, time],
  );
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
      "Aviso: sincronizacao com o servico de tickets nao concluida (ticket_sync_failed).",
    ];
  }

  if (result.status === "sent") {
    return warnings;
  }

  return [
    ...warnings,
    `Aviso: sincronizacao com o servico de tickets nao concluida (${result.skippedReason ?? "ticket_sync_failed"}).`,
  ];
}

export function asVoucherOperationError(error: unknown) {
  if (error instanceof VoucherOperationError) {
    return error;
  }

  return new VoucherOperationError(
    "voucher_operation_unavailable",
    "Nao foi possivel concluir a operacao de voucher agora.",
    502,
  );
}
