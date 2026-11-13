import { assertOnlineCapacityReleased, OnlineCapacityError } from "@/lib/online-capacity";
import { getIngressoSistemaDbPool } from "@/lib/ingresso-db";
import { registerOpsAuditLog } from "@/lib/ops-audit-log";
import { generateLocalVoucherQrCodes, TicketApiError } from "@/lib/ticket-api";
import { getSchoolPaymentHold } from "@/lib/school-payment-eligibility";
import { getOperationalParkId } from "@/lib/operational-day-contract";
import { PainelBilheteriaError, type BilheteriaActor, type PurchaseVoucherRow,
  type PainelBilheteriaVoucherPrintModel, type PainelBilheteriaPurchasePrintModel } from "@/lib/painel-bilheteria-print-contract";

// Preserve the existing panel display conventions without duplicating them.
export function createPainelBilheteriaPrintServices(display: {
  normalizeCpf: (value: string | null | undefined) => string | null;
  formatMoney: (value: string | number | null | undefined) => string;
  resolveVoucherDisplayLabel: (voucher: Pick<PurchaseVoucherRow, "descricao" | "tpvoucher">) => string;
}) {
const { normalizeCpf, formatMoney, resolveVoucherDisplayLabel } = display;
async function getPainelBilheteriaVoucherPrintModel(
  voucherId: number,
  actor?: BilheteriaActor | null,
): Promise<PainelBilheteriaVoucherPrintModel> {
  if (!Number.isInteger(voucherId) || voucherId <= 0) {
    throw new PainelBilheteriaError(
      "invalid_voucher_id",
      "Voucher invalido.",
      400,
    );
  }

  const pool = getIngressoSistemaDbPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const voucherResult = await client.query<PurchaseVoucherRow>(
      `
        SELECT
          voucher.idvoucher,
          voucher.idcompra,
          voucher.idagenda,
          voucher.numvoucher,
          voucher.tpvoucher,
          voucher.stusado,
          voucher.dtuso::text AS dtuso,
          voucher.vlunicompra::text AS vlunicompra,
          voucher.desconto_id,
          voucher.descricao,
          voucher.dtvalidade::text AS dtvalidade,
          voucher.dtinicio_validade::text AS dtinicio_validade,
          voucher.parque_operacional,
          compra.cpf,
          compra.tpcompra,
          compra.dtcompra::text AS dtcompra
        FROM voucher
        JOIN compra ON compra.idcompra = voucher.idcompra
        WHERE voucher.idvoucher = $1
        LIMIT 1
      `,
      [voucherId],
    );
    const voucher = voucherResult.rows[0] ?? null;

    if (!voucher || !voucher.idcompra) {
      throw new PainelBilheteriaError(
        "voucher_not_found",
        "Voucher nao encontrado.",
        404,
      );
    }
    if (voucher.parque_operacional != null && voucher.parque_operacional !== getOperationalParkId()) {
      throw new PainelBilheteriaError("voucher_park_mismatch", "O ingresso pertence a outro parque.", 409);
    }

    const hold = await getSchoolPaymentHold(client, voucher.idcompra);
    if (hold && hold.status !== "released") {
      throw new PainelBilheteriaError("school_payment_held",
        "Pagamento contabilizado; ingresso retido para análise do atendimento.", 409);
    }

    try { await assertOnlineCapacityReleased(client, voucher.idcompra); }
    catch (error) {
      if (error instanceof OnlineCapacityError && error.code === "online_capacity_delivery_hold") {
        throw new PainelBilheteriaError(error.code, "Pagamento confirmado; ingresso retido para análise da capacidade pelo atendimento.", 409);
      }
      throw error;
    }

    let agendaDate: string | null = null;

    if (voucher.idagenda && Number(voucher.idagenda) > 0) {
      const agendaResult = await client.query<{ dtagenda: string | null }>(
        `
          SELECT agenda.dtagenda::text AS dtagenda
          FROM agenda
          WHERE agenda.idagenda = $1
          LIMIT 1
        `,
        [voucher.idagenda],
      );
      agendaDate = agendaResult.rows[0]?.dtagenda ?? null;
    }

    const validUntilText = String(voucher.dtvalidade ?? "").slice(0, 10);

    await registerOpsAuditLog(
      client,
      {
        origem: "voucher",
        acao: "imprimir",
        compraId: voucher.idcompra,
        descricao: `Impressao operacional do voucher ${voucherId}.`,
        motivo: "Reemissao de QR individual no painel.",
        usuarioNome:
          [String(actor?.name ?? "").trim(), normalizeCpf(actor?.cpf ?? "")]
            .filter(Boolean)
            .join(" ") || null,
        detalhes: {
          via: "apps/web",
          voucherId,
          validUntil: validUntilText,
        },
      },
      "postgres",
    );

    await client.query("COMMIT");

    const qrCodeMap = await generateLocalVoucherQrCodes([
      {
        purchaseId: voucher.idcompra,
        voucherId,
        cpf: String(voucher.cpf ?? "").trim(),
        type: voucher.tpvoucher,
        purchaseLocation: "Bilheteria",
        purchaseDate: voucher.dtcompra ? voucher.dtcompra.slice(0, 10) : null,
        price: Number(voucher.vlunicompra ?? 0),
        tpcompra: String(voucher.tpcompra ?? "").trim(),
      },
    ]).catch((error) => {
      console.error("painel-bilheteria-print-qrcode-failed", error);
      return {} as Record<string, string>;
    });
    const qrCodeUrl = qrCodeMap[voucherId] ?? null;

    return {
      purchaseId: voucher.idcompra,
      voucherId,
      voucherCode: String(voucher.numvoucher ?? "").trim() || String(voucherId),
      voucherNumber: voucher.numvoucher,
      cpf: voucher.cpf ?? null,
      type: voucher.tpvoucher ?? null,
      typeLabel: resolveVoucherDisplayLabel(voucher),
      description: voucher.descricao,
      purchaseLocation: "Bilheteria",
      purchaseDate: voucher.dtcompra ? voucher.dtcompra.slice(0, 10) : null,
      price: formatMoney(voucher.vlunicompra),
      tpcompra: voucher.tpcompra ?? null,
      visitDate: agendaDate ? agendaDate.slice(0, 10) : null,
      validFrom: voucher.dtinicio_validade?.slice(0, 10) ?? null,
      validUntil: validUntilText,
      qrCodeUrl,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);

    if (error instanceof TicketApiError) {
      throw new PainelBilheteriaError(
        "voucher_print_unavailable",
        error.message,
        error.status,
      );
    }

    throw error;
  } finally {
    client.release();
  }
}

async function getPainelBilheteriaPurchasePrintModel(
  purchaseId: number,
  actor?: BilheteriaActor | null,
  voucherIds?: number[],
): Promise<PainelBilheteriaPurchasePrintModel> {
  if (!Number.isInteger(purchaseId) || purchaseId <= 0) {
    throw new PainelBilheteriaError(
      "invalid_purchase_id",
      "Compra invalida.",
      400,
    );
  }
  if (voucherIds !== undefined && (!Array.isArray(voucherIds) || voucherIds.length < 1 || voucherIds.length > 1000 ||
    voucherIds.some((id) => !Number.isSafeInteger(id) || id <= 0) || new Set(voucherIds).size !== voucherIds.length)) {
    throw new PainelBilheteriaError("invalid_voucher_selection", "Selecione de 1 a 1000 ingressos distintos.", 400);
  }

  const pool = getIngressoSistemaDbPool();
  const purchaseResult = await pool.query<{ idcompra: number }>(
    `
      SELECT compra.idcompra
      FROM compra
      WHERE compra.idcompra = $1
        AND compra.tpcompra IN ('bilhe', 'reser', 'ponli')
      LIMIT 1
    `,
    [purchaseId],
  );

  if (purchaseResult.rowCount === 0) {
    throw new PainelBilheteriaError(
      "purchase_not_found",
      "Compra nao encontrada.",
      404,
    );
  }

  const voucherResult = await pool.query<{ idvoucher: number; parque_operacional: string | null }>(
    `
      SELECT voucher.idvoucher, voucher.parque_operacional
      FROM voucher
      WHERE voucher.idcompra = $1
        ${voucherIds === undefined ? "" : "AND voucher.idvoucher=ANY($2::bigint[])"}
      ORDER BY voucher.idvoucher
    `,
    voucherIds === undefined ? [purchaseId] : [purchaseId, voucherIds],
  );

  if (voucherIds !== undefined && voucherResult.rows.length !== voucherIds.length) {
    throw new PainelBilheteriaError("invalid_voucher_selection", "Todos os ingressos selecionados devem pertencer à compra.", 409);
  }
  if (voucherResult.rows.some((row) => row.parque_operacional != null && row.parque_operacional !== getOperationalParkId())) {
    throw new PainelBilheteriaError("voucher_park_mismatch", "O ingresso pertence a outro parque.", 409);
  }

  if (voucherResult.rowCount === 0) {
    throw new PainelBilheteriaError(
      "voucher_not_found",
      "Nenhum voucher encontrado para impressao.",
      404,
    );
  }

  const vouchers = await Promise.all(
    voucherResult.rows.map((row) =>
      getPainelBilheteriaVoucherPrintModel(row.idvoucher, actor),
    ),
  );

  return {
    purchaseId,
    vouchers,
  };
}

return { getPainelBilheteriaVoucherPrintModel, getPainelBilheteriaPurchasePrintModel };
}
