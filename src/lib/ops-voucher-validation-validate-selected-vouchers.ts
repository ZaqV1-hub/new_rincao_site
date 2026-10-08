import { getIngressoSistemaDbPool } from "@/lib/ingresso-db";
import { ensureVoucherLifecycleSchema } from "@/lib/voucher-repository";
import { getVouchersByIds } from "@/lib/ops-voucher-validation-queries";
import { VoucherOperationSuccess, VoucherOperationInputActor, VoucherOperationError, getSaoPauloDateParts, normalizeVoucherIds, normalizeCpfDigits, registerVoucherOperationAuditLog, isVoucherExpired, isOnlinePurchasePaid, isReservationPaid, buildReservationPaymentMessage, evaluateAgendaUsage, markVoucherUsed, appendTicketWarnings } from "@/lib/ops-voucher-validation-shared";

export async function validateSelectedVouchers(
  voucherIdsInput: number[],
  actor?: VoucherOperationInputActor | null,
): Promise<VoucherOperationSuccess> {
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
    const vouchers = await getVouchersByIds(client, voucherIds);
    const vouchersById = new Map(vouchers.map((voucher) => [voucher.idvoucher, voucher]));
    const affectedVoucherIds: number[] = [];
    const warnings: string[] = [];

    for (const voucherId of voucherIds) {
      const voucher = vouchersById.get(voucherId);

      if (!voucher) {
        warnings.push(`Voucher ${voucherId} nao encontrado.`);
        continue;
      }

      if (voucher.stusado === "s" || voucher.stusado === "inv") {
        warnings.push(
          `Voucher ${voucher.numvoucher ?? voucherId} ja utilizado ou indisponivel para validacao.`,
        );
        continue;
      }

      if (voucher.stusado !== "n") {
        warnings.push(
          `Voucher ${voucher.numvoucher ?? voucherId} nao esta disponivel para validacao.`,
        );
        continue;
      }

      if (isVoucherExpired(voucher, date)) {
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
      } else if (voucher.tpcompra === "reser") {
        if (!isReservationPaid(voucher)) {
          warnings.push(buildReservationPaymentMessage(voucher));
          continue;
        }
      } else {
        warnings.push(
          `Voucher ${voucher.numvoucher ?? voucherId} possui tipo de compra invalido para validacao.`,
        );
        continue;
      }

      await markVoucherUsed(client, voucher.idvoucher, date, time);
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
      action: "validate",
      mode: "selection",
      actor,
      vouchers,
      affectedVoucherIds,
      warnings,
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

