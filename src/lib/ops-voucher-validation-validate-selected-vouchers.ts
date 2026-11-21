import type { ExpiredVoucherSelection } from "@/lib/expired-voucher-selection";
import { getIngressoSistemaDbPool } from "@/lib/ingresso-db";
import { ensureVoucherLifecycleSchema } from "@/lib/voucher-repository";
import { getVouchersByIds } from "@/lib/ops-voucher-validation-queries";
import { requireVoucherPeriodId, lockVoucherCashContext, buildAlreadyUsedMessage, VoucherOperationSuccess, VoucherOperationInputActor, VoucherOperationError, getSaoPauloDateParts, normalizeVoucherIds, normalizeCpfDigits, registerVoucherOperationAuditLog, isVoucherExpired, isOnlinePurchasePaid, isReservationPaid, buildReservationPaymentMessage, evaluateAgendaUsage, markVoucherUsed, appendTicketWarnings, formatDateBr, voucherExpirationDate } from "@/lib/ops-voucher-validation-shared";

export async function validateSelectedVouchers(
  voucherIdsInput: number[],
  actor?: VoucherOperationInputActor | null,
  periodId?: number,
  expectedPurchaseId?: number,
  confirmedExpirations?: ExpiredVoucherSelection[],
): Promise<VoucherOperationSuccess> {
  requireVoucherPeriodId(periodId);
  const voucherIds = normalizeVoucherIds(voucherIdsInput);

  if (voucherIds.length === 0) {
    throw new VoucherOperationError(
      "invalid_voucher_selection",
      "Informe vouchers validos para validacao operacional.",
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
    const vouchers = await getVouchersByIds(client, voucherIds, expectedPurchaseId);
    const vouchersById = new Map(vouchers.map((voucher) => [voucher.idvoucher, voucher]));
    const affectedVoucherIds: number[] = [];
    const warnings: string[] = [];
    const readyVouchers: typeof vouchers = [];
    const expiredAdmissions: (ExpiredVoucherSelection & { admittedOn: string })[] = [];
    const expiredVouchers: (ExpiredVoucherSelection & { number: string })[] = [];
    const confirmedById = new Map(confirmedExpirations?.map(({ voucherId, expiredOn }) => [voucherId, expiredOn]));

    for (const voucherId of voucherIds) {
      const voucher = vouchersById.get(voucherId);

      if (!voucher) {
        warnings.push(`Voucher ${voucherId} nao encontrado.`);
        continue;
      }

      if (voucher.stusado === "s" || voucher.stusado === "inv") {
        warnings.push(
          voucher.stusado === "s" ? buildAlreadyUsedMessage(voucher) : `Voucher ${voucher.numvoucher ?? voucherId} indisponivel para validacao.`,
        );
        continue;
      }

      if (voucher.stusado !== "n") {
        warnings.push(
          `Voucher ${voucher.numvoucher ?? voucherId} nao esta disponivel para validacao.`,
        );
        continue;
      }

      const expired = isVoucherExpired(voucher, date);
      if (expired && !confirmedExpirations) {
        warnings.push(`Voucher ${voucher.numvoucher ?? voucherId} vencido.`);
        continue;
      }

      if (voucher.tpcompra === "ponli") {
        if (voucher.stcompra !== "conc") {
          warnings.push(
            `Voucher ${voucher.numvoucher ?? voucherId} pendente de pagamento.`,
          );
          continue;
        }

        if (!isOnlinePurchasePaid(voucher)) {
          warnings.push(
            `A transacao do voucher ${voucher.numvoucher ?? voucherId} nao esta confirmada para validacao.`,
          );
          continue;
        }

        const usage = evaluateAgendaUsage(voucher, false, date);

        if (usage.status !== "ok") {
          warnings.push(usage.message);
          continue;
        }
      } else if ((voucher.tpcompra === "reser" || voucher.tpcompra === "bilhe")) {
        if (voucher.tpcompra === "bilhe" ? voucher.stcompra !== "conc" : !isReservationPaid(voucher)) {
          warnings.push(buildReservationPaymentMessage(voucher));
          continue;
        }
      } else {
        warnings.push(
          `Voucher ${voucher.numvoucher ?? voucherId} possui tipo de compra invalido para validacao.`,
        );
        continue;
      }

      if (expired) {
        const expiredOn = voucherExpirationDate(voucher);
        if (confirmedById.get(voucherId) !== expiredOn) {
          expiredVouchers.push({ voucherId, expiredOn, number: voucher.numvoucher ?? String(voucherId) });
          continue;
        }
        expiredAdmissions.push({ voucherId, expiredOn, admittedOn: date });
      }
      readyVouchers.push(voucher);
    }

    if (expiredVouchers.length) {
      const items = expiredVouchers.map(({ number, expiredOn }) =>
        expiredOn ? `${number} (venceu em ${formatDateBr(expiredOn)})` : `${number} (data não registrada)`);
      const error = new VoucherOperationError("voucher_expired_confirmation_required",
        `${items.join("; ")}. Deseja validar mesmo assim, sem reagendar?`, 409);
      error.expiredVouchers = expiredVouchers.map(({ voucherId, expiredOn }) => ({ voucherId, expiredOn }));
      throw error;
    }

    for (const voucher of readyVouchers) {
      await markVoucherUsed(client, voucher.idvoucher, date, time, cash, actor, { allowExpired: expiredAdmissions.some((item) => item.voucherId === voucher.idvoucher) });
      affectedVoucherIds.push(voucher.idvoucher);
    }

    if (affectedVoucherIds.length === 0) {
      throw new VoucherOperationError(
        "voucher_validation_unavailable",
        warnings[0] ?? "Nenhum voucher pode ser validado.",
        409,
      );
    }

    const auditLogId = await registerVoucherOperationAuditLog(client, {
      cash: cash.session,
      action: "validate",
      mode: "selection",
      actor,
      vouchers,
      affectedVoucherIds,
      warnings,
      expiredAdmissions,
    });
    await client.query("COMMIT");

    console.info("ops-voucher-validate", {
      mode: "selection",
      affectedVoucherIds,
      actorName: String(actor?.name ?? "").trim() || null,
      actorCpf: normalizeCpfDigits(actor?.cpf ?? "") || null,
      auditLogId,
    });

    const warningsWithTickets = await appendTicketWarnings(
      warnings,
      "validate",
      vouchers
        .filter((voucher) => affectedVoucherIds.includes(voucher.idvoucher))
        .map((voucher) => ({
          purchaseId: Number(voucher.idcompra ?? 0),
          voucherId: voucher.idvoucher,
        })),
    );

    return {
      action: "validate",
      mode: "selection",
      processedCount: affectedVoucherIds.length,
      affectedVoucherIds,
      warnings: warningsWithTickets,
      message: `${affectedVoucherIds.length} voucher(s) validado(s) com sucesso.`,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
