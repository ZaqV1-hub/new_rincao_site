import { getIngressoSistemaDbPool } from "@/lib/ingresso-db";
import { getVouchersByPurchaseId } from "@/lib/ops-voucher-validation-queries";
import { VoucherOperationSuccess, VoucherOperationInputActor, VoucherOperationError, getSaoPauloDateParts, normalizeCpfDigits, registerVoucherOperationAuditLog, markVoucherInvalid, appendTicketWarnings } from "@/lib/ops-voucher-validation-shared";

export async function invalidatePurchaseVouchers(
  purchaseId: number,
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
  const pool = getIngressoSistemaDbPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const vouchers = await getVouchersByPurchaseId(client, purchaseId);

    if (vouchers.length === 0) {
      throw new VoucherOperationError(
        "purchase_not_found",
        "Compra nao encontrada para invalidacao operacional.",
        404,
      );
    }

    const affectedVoucherIds: number[] = [];
    const warnings: string[] = [];

    for (const voucher of vouchers) {
      if (voucher.stusado === "inv") {
        continue;
      }

      await markVoucherInvalid(client, voucher.idvoucher, date, time);
      affectedVoucherIds.push(voucher.idvoucher);

      console.info("ops-purchase-invalidate", {
        purchaseId,
        voucherId: voucher.idvoucher,
        voucherNumber: voucher.numvoucher,
        actorName: String(actor?.name ?? "").trim() || null,
        actorCpf: String(actor?.cpf ?? "").trim() || null,
      });
    }

    if (affectedVoucherIds.length === 0) {
      throw new VoucherOperationError(
        "voucher_invalidate_unavailable",
        "Todos os vouchers da compra ja estavam invalidados.",
        409,
      );
    }

    const auditLogId = await registerVoucherOperationAuditLog(client, {
      action: "invalidate",
      mode: "purchase",
      actor,
      vouchers,
      affectedVoucherIds,
      warnings,
      explicitPurchaseId: purchaseId,
    });
    await client.query("COMMIT");

    console.info("ops-purchase-invalidate", {
      purchaseId,
      affectedVoucherIds,
      actorName: String(actor?.name ?? "").trim() || null,
      actorCpf: normalizeCpfDigits(actor?.cpf ?? "") || null,
      auditLogId,
    });

    const warningsWithTickets = await appendTicketWarnings(
      warnings,
      "invalidate",
      vouchers
        .filter((voucher) => affectedVoucherIds.includes(voucher.idvoucher))
        .map((voucher) => ({
          purchaseId: Number(voucher.idcompra ?? purchaseId),
          voucherId: voucher.idvoucher,
        })),
    );

    return {
      action: "invalidate",
      mode: "purchase",
      processedCount: affectedVoucherIds.length,
      affectedVoucherIds,
      warnings: warningsWithTickets,
      message: `Todos os vouchers elegiveis da compra ${purchaseId} foram invalidados.`,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
