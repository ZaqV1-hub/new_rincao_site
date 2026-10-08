import { getIngressoSistemaDbPool } from "@/lib/ingresso-db";
import { ensureVoucherLifecycleSchema } from "@/lib/voucher-repository";
import { getVouchersByPurchaseId } from "@/lib/ops-voucher-validation-queries";
import { VoucherOperationSuccess, VoucherOperationInputActor, VoucherOperationError, getSaoPauloDateParts, normalizeCpfDigits, registerVoucherOperationAuditLog, isVoucherExpired, isOnlinePurchasePaid, isReservationPaid, buildReservationPaymentMessage, evaluateAgendaUsage, markVoucherUsed, appendTicketWarnings } from "@/lib/ops-voucher-validation-shared";

export async function validatePurchaseVouchers(
  purchaseId: number,
  confirm = false,
  actor?: VoucherOperationInputActor | null,
): Promise<VoucherOperationSuccess> {
  if (!Number.isInteger(purchaseId) || purchaseId <= 0) {
    throw new VoucherOperationError(
      "invalid_purchase_id",
      "Informe um identificador de compra valido.",
      400,
    );
  }

  const { date, time } = getSaoPauloDateParts();
  await ensureVoucherLifecycleSchema();
  const pool = getIngressoSistemaDbPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const vouchers = await getVouchersByPurchaseId(client, purchaseId);

    if (vouchers.length === 0) {
      throw new VoucherOperationError(
        "purchase_not_found",
        "Compra nao encontrada para validacao operacional.",
        404,
      );
    }

    const affectedVoucherIds: number[] = [];
    const warnings: string[] = [];

    for (const voucher of vouchers) {
      if (voucher.stusado === "s" || voucher.stusado === "inv") {
        continue;
      }

      if (voucher.stusado !== "n") {
        warnings.push(`Voucher ${voucher.numvoucher ?? voucher.idvoucher} nao esta disponivel para validacao.`);
        continue;
      }

      if (isVoucherExpired(voucher, date)) {
        warnings.push(`Voucher ${voucher.numvoucher ?? voucher.idvoucher} vencido.`);
        continue;
      }

      if (voucher.tpcompra === "ponli") {
        if (voucher.stcompra !== "conc") {
          throw new VoucherOperationError(
            "voucher_payment_pending",
            `Voucher ${voucher.numvoucher ?? ""} pendente de pagamento.`,
            409,
          );
        }

        if (!isOnlinePurchasePaid(voucher)) {
          throw new VoucherOperationError(
            "voucher_payment_status_invalid",
            `A transacao do voucher ${voucher.numvoucher ?? ""} nao esta confirmada para validacao.`,
            409,
          );
        }

        const usage = evaluateAgendaUsage(voucher, confirm, date);

        if (usage.status === "invalid") {
          throw new VoucherOperationError(usage.code, usage.message, 409);
        }
      } else if (voucher.tpcompra === "reser") {
        if (!isReservationPaid(voucher)) {
          throw new VoucherOperationError(
            "voucher_payment_required",
            buildReservationPaymentMessage(voucher),
            409,
          );
        }
      } else {
        throw new VoucherOperationError(
          "voucher_invalid_purchase_type",
          "Tipo de compra invalido para o voucher.",
          409,
        );
      }

      await markVoucherUsed(client, voucher.idvoucher, date, time);
      affectedVoucherIds.push(voucher.idvoucher);
    }

    if (affectedVoucherIds.length === 0) {
      throw new VoucherOperationError(
        "voucher_validation_unavailable",
        "Nenhum voucher disponivel para validacao nesta compra.",
        409,
      );
    }

    const auditLogId = await registerVoucherOperationAuditLog(client, {
      action: "validate",
      mode: "purchase",
      actor,
      vouchers,
      affectedVoucherIds,
      warnings,
      explicitPurchaseId: purchaseId,
    });
    await client.query("COMMIT");

    console.info("ops-voucher-validate", {
      mode: "purchase",
      purchaseId,
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
          purchaseId: Number(voucher.idcompra ?? purchaseId),
          voucherId: voucher.idvoucher,
        })),
    );

    return {
      action: "validate",
      mode: "purchase",
      processedCount: affectedVoucherIds.length,
      affectedVoucherIds,
      warnings: warningsWithTickets,
      message: "Vouchers validados com sucesso! Entrada permitida.",
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
