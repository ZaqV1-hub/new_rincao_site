import { getIngressoSistemaDbPool } from "@/lib/ingresso-db";
import { getVouchersByIds } from "@/lib/ops-voucher-validation-queries";
import { VoucherOperationSuccess, VoucherOperationInputActor, VoucherOperationError, getSaoPauloDateParts, normalizeVoucherIds, normalizeCpfDigits, registerVoucherOperationAuditLog, markVoucherInvalid, appendTicketWarnings } from "@/lib/ops-voucher-validation-shared";

export async function invalidateSelectedVouchers(
  voucherIdsInput: number[],
  actor?: VoucherOperationInputActor | null,
): Promise<VoucherOperationSuccess> {
  const voucherIds = normalizeVoucherIds(voucherIdsInput);

  if (voucherIds.length === 0) {
    throw new VoucherOperationError(
      "invalid_voucher_selection",
      "Informe vouchers validos para invalidacao operacional.",
      400,
    );
  }

  const { date, time } = getSaoPauloDateParts();
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

      if (voucher.stusado === "inv") {
        warnings.push(
          `Voucher ${voucher.numvoucher ?? voucherId} ja esta invalidado.`,
        );
        continue;
      }

      await markVoucherInvalid(client, voucher.idvoucher, date, time);
      affectedVoucherIds.push(voucher.idvoucher);

      console.info("ops-voucher-invalidate", {
        voucherId: voucher.idvoucher,
        voucherNumber: voucher.numvoucher,
        purchaseId: voucher.idcompra,
        actorName: String(actor?.name ?? "").trim() || null,
        actorCpf: String(actor?.cpf ?? "").trim() || null,
      });
    }

    if (affectedVoucherIds.length === 0) {
      throw new VoucherOperationError(
        "voucher_invalidate_unavailable",
        warnings[0] ?? "Nenhum voucher pode ser invalidado.",
        409,
      );
    }

    const auditLogId = await registerVoucherOperationAuditLog(client, {
      action: "invalidate",
      mode: "selection",
      actor,
      vouchers,
      affectedVoucherIds,
      warnings,
    });
    await client.query("COMMIT");

    console.info("ops-voucher-invalidate", {
      mode: "selection",
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
          purchaseId: Number(voucher.idcompra ?? 0),
          voucherId: voucher.idvoucher,
        })),
    );

    return {
      action: "invalidate",
      mode: "selection",
      processedCount: affectedVoucherIds.length,
      affectedVoucherIds,
      warnings: warningsWithTickets,
      message: `${affectedVoucherIds.length} voucher(s) invalidado(s) com sucesso.`,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

