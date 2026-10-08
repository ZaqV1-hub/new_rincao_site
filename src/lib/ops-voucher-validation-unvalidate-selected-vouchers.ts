import { getIngressoSistemaDbPool } from "@/lib/ingresso-db";
import { getVouchersByIds } from "@/lib/ops-voucher-validation-queries";
import { VoucherOperationSuccess, VoucherOperationInputActor, VoucherOperationError, normalizeVoucherIds, normalizeCpfDigits, registerVoucherOperationAuditLog, markVoucherUnused, appendTicketWarnings } from "@/lib/ops-voucher-validation-shared";

export async function unvalidateSelectedVouchers(
  voucherIdsInput: number[],
  actor?: VoucherOperationInputActor | null,
): Promise<VoucherOperationSuccess> {
  const voucherIds = normalizeVoucherIds(voucherIdsInput);

  if (voucherIds.length === 0) {
    throw new VoucherOperationError(
      "invalid_voucher_selection",
      "Informe vouchers validos para desvalidacao operacional.",
      400,
    );
  }

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

      if (voucher.stusado !== "s") {
        warnings.push(
          `Voucher ${voucher.numvoucher ?? voucherId} nao esta validado.`,
        );
        continue;
      }

      await markVoucherUnused(client, voucher.idvoucher);
      affectedVoucherIds.push(voucher.idvoucher);

      console.info("ops-voucher-unvalidate", {
        voucherId: voucher.idvoucher,
        voucherNumber: voucher.numvoucher,
        purchaseId: voucher.idcompra,
        actorName: String(actor?.name ?? "").trim() || null,
        actorCpf: String(actor?.cpf ?? "").trim() || null,
      });
    }

    if (affectedVoucherIds.length === 0) {
      throw new VoucherOperationError(
        "voucher_unvalidate_unavailable",
        warnings[0] ?? "Nenhum voucher pode ser desvalidado.",
        409,
      );
    }

    const auditLogId = await registerVoucherOperationAuditLog(client, {
      action: "unvalidate",
      mode: "selection",
      actor,
      vouchers,
      affectedVoucherIds,
      warnings,
    });
    await client.query("COMMIT");

    console.info("ops-voucher-unvalidate", {
      mode: "selection",
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
          purchaseId: Number(voucher.idcompra ?? 0),
          voucherId: voucher.idvoucher,
        })),
    );

    return {
      action: "unvalidate",
      mode: "selection",
      processedCount: affectedVoucherIds.length,
      affectedVoucherIds,
      warnings: warningsWithTickets,
      message: `${affectedVoucherIds.length} voucher(s) desvalidado(s) com sucesso.`,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

