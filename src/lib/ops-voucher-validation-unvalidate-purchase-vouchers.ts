import { getIngressoSistemaDbPool } from "@/lib/ingresso-db";
import { getVouchersByPurchaseId } from "@/lib/ops-voucher-validation-queries";
import { requireVoucherPeriodId, lockVoucherCashContext, assertVoucherReversalAllowed, VoucherOperationSuccess, VoucherOperationInputActor, VoucherOperationError, getSaoPauloDateParts, normalizeCpfDigits, registerVoucherOperationAuditLog, markVoucherUnused, appendTicketWarnings } from "@/lib/ops-voucher-validation-shared";

export async function unvalidatePurchaseVouchers(
  purchaseId: number,
  actor?: VoucherOperationInputActor | null,
  periodId?: number,
): Promise<VoucherOperationSuccess> {
  requireVoucherPeriodId(periodId);
  if (!Number.isInteger(purchaseId) || purchaseId <= 0) {
    throw new VoucherOperationError(
      "invalid_purchase_id",
      "Informe um identificador de compra valido.",
      400,
    );
  }

  const { date } = getSaoPauloDateParts();
  const pool = getIngressoSistemaDbPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const cash = await lockVoucherCashContext(client, periodId, date, { purchaseId });
    const vouchers = await getVouchersByPurchaseId(client, purchaseId);

    if (vouchers.length === 0) {
      throw new VoucherOperationError(
        "purchase_not_found",
        "Compra nao encontrada para desvalidacao operacional.",
        404,
      );
    }

    const affectedVoucherIds: number[] = [];
    const warnings: string[] = [];

    for (const voucher of vouchers) {
      if (voucher.stusado !== "s") {
        warnings.push(
          `Voucher ${voucher.numvoucher ?? voucher.idvoucher} nao esta validado.`,
        );
        continue;
      }

      assertVoucherReversalAllowed(voucher, cash);
      await markVoucherUnused(client, voucher.idvoucher, date);
      affectedVoucherIds.push(voucher.idvoucher);

      console.info("ops-purchase-unvalidate", {
        purchaseId,
        voucherId: voucher.idvoucher,
        voucherNumber: voucher.numvoucher,
        actorName: String(actor?.name ?? "").trim() || null,
        actorCpf: String(actor?.cpf ?? "").trim() || null,
      });
    }

    if (affectedVoucherIds.length === 0) {
      throw new VoucherOperationError(
        "voucher_unvalidate_unavailable",
        "Nenhum voucher validado foi encontrado nesta compra.",
        409,
      );
    }

    const auditLogId = await registerVoucherOperationAuditLog(client, {
      cash: cash.session,
      action: "unvalidate",
      mode: "purchase",
      actor,
      vouchers,
      affectedVoucherIds,
      warnings,
      explicitPurchaseId: purchaseId,
    });
    await client.query("COMMIT");

    console.info("ops-purchase-unvalidate", {
      purchaseId,
      affectedVoucherIds,
      actorName: String(actor?.name ?? "").trim() || null,
      actorCpf: normalizeCpfDigits(actor?.cpf ?? "") || null,
      auditLogId,
    });

    const warningsWithTickets = await appendTicketWarnings(
      warnings,
      "unvalidate",
      vouchers
        .filter((voucher) => affectedVoucherIds.includes(voucher.idvoucher))
        .map((voucher) => ({
          purchaseId: Number(voucher.idcompra ?? purchaseId),
          voucherId: voucher.idvoucher,
        })),
    );

    return {
      action: "unvalidate",
      mode: "purchase",
      processedCount: affectedVoucherIds.length,
      affectedVoucherIds,
      warnings: warningsWithTickets,
      message: `Todos os vouchers validados da compra ${purchaseId} foram desvalidados.`,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
