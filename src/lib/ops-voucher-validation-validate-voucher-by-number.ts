import { getIngressoSistemaDbPool } from "@/lib/ingresso-db";
import { ensureVoucherLifecycleSchema } from "@/lib/voucher-repository";
import { getVoucherByNumber } from "@/lib/ops-voucher-validation-queries";
import { requireVoucherPeriodId, lockVoucherCashContext, alreadyUsedError, VoucherOperationSuccess, VoucherOperationInputActor, VoucherOperationError, getSaoPauloDateParts, formatDateBr, normalizeVoucherNumber, normalizeCpfDigits, registerVoucherOperationAuditLog, addMonthsToDateString, isVoucherExpired, isOnlinePurchasePaid, buildReservationPaymentMessage, evaluateAgendaUsage, markVoucherUsed, appendTicketWarnings } from "@/lib/ops-voucher-validation-shared";

export async function validateVoucherByNumber(
  voucherNumberInput: string,
  confirm = false,
  actor?: VoucherOperationInputActor | null,
  periodId?: number,
): Promise<VoucherOperationSuccess> {
  requireVoucherPeriodId(periodId);
  const voucherNumber = normalizeVoucherNumber(voucherNumberInput);

  if (!voucherNumber) {
    throw new VoucherOperationError(
      "invalid_voucher_number",
      "Informe um numero de voucher valido.",
      400,
    );
  }

  const { date, time } = getSaoPauloDateParts();
  await ensureVoucherLifecycleSchema();
  const pool = getIngressoSistemaDbPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const cash = await lockVoucherCashContext(client, periodId, date);
    const voucher = await getVoucherByNumber(client, voucherNumber);

    if (!voucher) {
      throw new VoucherOperationError(
        "voucher_not_found",
        `Voucher ${voucherNumber} nao localizado.`,
        404,
      );
    }

    if (!["ponli", "bilhe"].includes(voucher.tpcompra ?? "")) {
      throw new VoucherOperationError(
        "voucher_payment_required",
        buildReservationPaymentMessage(voucher),
        409,
      );
    }

    if (voucher.stusado === "inv") {
      throw new VoucherOperationError("voucher_invalidated", "Ingresso invalidado. A entrada não está autorizada.", 409);
    }

    if (voucher.stusado !== "n") {
      throw alreadyUsedError(voucher);
    }

    if (voucher.dtinicio_validade != null && isVoucherExpired(voucher, date)) {
      throw new VoucherOperationError(
        "voucher_expired",
        `Ingresso vencido em ${formatDateBr(voucher.dtvalidade ?? null)}. A entrada não está autorizada.`,
        409,
      );
    }

    if (isVoucherExpired(voucher, date) && !confirm) {
      const validUntil = addMonthsToDateString(voucher.dtcompra, 6);
      throw new VoucherOperationError(
        "voucher_expired_confirmation_required",
        `Ingresso foi vencido dia ${formatDateBr(validUntil)}. Deseja validar?`,
        409,
      );
    }

    if (voucher.stcompra !== "conc") {
      throw new VoucherOperationError(
        "voucher_payment_pending",
        `Voucher ${voucher.numvoucher ?? ""} pendente de pagamento.`,
        409,
      );
    }

    if (voucher.tpcompra === "ponli" ? !isOnlinePurchasePaid(voucher) : voucher.stcompra !== "conc") {
      throw new VoucherOperationError(
        "voucher_payment_status_invalid",
        `A transacao do voucher ${voucher.numvoucher ?? ""} nao esta confirmada para validacao.`,
        409,
      );
    }

    const usage = evaluateAgendaUsage(voucher, confirm, date);

    if (usage.status === "invalid" || usage.status === "confirmation_required") {
      throw new VoucherOperationError(usage.code, usage.message, 409);
    }

    await markVoucherUsed(client, voucher.idvoucher, date, time, cash, actor);
    const auditLogId = await registerVoucherOperationAuditLog(client, {
      cash: cash.session,
      action: "validate",
      mode: "voucher_number",
      actor,
      vouchers: [voucher],
      affectedVoucherIds: [voucher.idvoucher],
      explicitPurchaseId: Number(voucher.idcompra ?? 0) || null,
      requestedVoucherNumber: voucher.numvoucher ?? voucherNumber,
    });
    await client.query("COMMIT");

    console.info("ops-voucher-validate", {
      mode: "voucher_number",
      voucherId: voucher.idvoucher,
      voucherNumber: voucher.numvoucher ?? voucherNumber,
      purchaseId: voucher.idcompra,
      actorName: String(actor?.name ?? "").trim() || null,
      actorCpf: normalizeCpfDigits(actor?.cpf ?? "") || null,
      auditLogId,
    });

    const warnings = await appendTicketWarnings([], "validate", [
      {
        purchaseId: Number(voucher.idcompra ?? 0),
        voucherId: voucher.idvoucher,
      },
    ]);

    return {
      action: "validate",
      mode: "voucher_number",
      processedCount: 1,
      affectedVoucherIds: [voucher.idvoucher],
      warnings,
      message: `${voucher.numvoucher ?? voucherNumber} - Voucher Validado com sucesso! Entrada permitida`,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
