import { getIngressoSistemaDbPool } from "@/lib/ingresso-db";
import { VoucherTicketRow, TicketValidationVoucherRow } from "@/lib/ticket-service-contract";

export async function loadTicketValidationVoucher(
  purchaseId: number,
  voucherId: number,
) {
  const pool = getIngressoSistemaDbPool();
  const result = await pool.query<TicketValidationVoucherRow>(
    `
      SELECT
        voucher.idcompra,
        voucher.idvoucher,
        voucher.numvoucher,
        voucher.tpvoucher,
        voucher.vlunicompra::text AS vlunicompra,
        voucher.identificacao,
        agenda.dtagenda::text AS dtagenda,
        compra.cpf,
        compra.tpcompra,
        compra.dtcompra::text AS dtcompra,
        usuario.celular
      FROM voucher
      JOIN compra ON compra.idcompra = voucher.idcompra
      LEFT JOIN agenda ON agenda.idagenda = voucher.idagenda
      LEFT JOIN usuario ON usuario.cpf = compra.cpf
      WHERE voucher.idcompra = $1
        AND voucher.idvoucher = $2
      LIMIT 1
    `,
    [purchaseId, voucherId],
  );

  return result.rows[0] ?? null;
}

export async function loadPendingTicketVouchers(purchaseId: number) {
  const pool = getIngressoSistemaDbPool();
  const vouchers = await pool.query<VoucherTicketRow>(
    `
      SELECT
        voucher.idvoucher,
        voucher.numvoucher,
        voucher.tpvoucher,
        voucher.descricao,
        voucher.vlunicompra::text AS vlunicompra,
        voucher.stusado,
        voucher.voucherenviado,
        voucher.identificacao,
        voucher.idagenda,
        agenda.dtagenda::text AS dtagenda
      FROM voucher
      LEFT JOIN agenda ON agenda.idagenda = voucher.idagenda
      WHERE voucher.idcompra = $1
        AND voucher.stusado NOT IN ('s', 'inv')
        AND COALESCE(voucher.voucherenviado, 'n') <> 's'
      ORDER BY voucher.idvoucher ASC
    `,
    [purchaseId],
  );

  return vouchers.rows;
}

export async function loadSelectedTicketVouchers(
  purchaseId: number,
  voucherIds: number[],
) {
  if (voucherIds.length === 0) {
    return [];
  }

  const pool = getIngressoSistemaDbPool();
  const vouchers = await pool.query<VoucherTicketRow>(
    `
      SELECT
        voucher.idvoucher,
        voucher.numvoucher,
        voucher.tpvoucher,
        voucher.descricao,
        voucher.vlunicompra::text AS vlunicompra,
        voucher.stusado,
        voucher.voucherenviado,
        voucher.identificacao,
        voucher.idagenda,
        agenda.dtagenda::text AS dtagenda
      FROM voucher
      LEFT JOIN agenda ON agenda.idagenda = voucher.idagenda
      WHERE voucher.idcompra = $1
        AND voucher.idvoucher = ANY($2::int[])
        AND voucher.stusado <> 'inv'
      ORDER BY voucher.idvoucher ASC
    `,
    [purchaseId, voucherIds],
  );

  return vouchers.rows;
}

export async function markVouchersSent(voucherIds: number[]) {
  if (voucherIds.length === 0) {
    return;
  }

  const pool = getIngressoSistemaDbPool();

  await pool.query(
    `
      UPDATE voucher
      SET voucherenviado = 's'
      WHERE idvoucher = ANY($1::int[])
    `,
    [voucherIds],
  );
}
