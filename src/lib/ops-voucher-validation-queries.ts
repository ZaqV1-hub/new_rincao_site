import type { PoolClient } from "pg";
import type { VoucherValidationRow, SchoolTripVoucherRow } from "@/lib/ops-voucher-validation-shared";
const VALIDATION_COLUMNS = `voucher.idvoucher,voucher.idagenda,voucher.numvoucher,voucher.stusado,voucher.stvoucher,
        to_char(voucher.dtuso, 'YYYY-MM-DD') AS dtuso,voucher.hruso::text AS hruso,voucher.idcompra,
        to_char(compra.dtcompra, 'YYYY-MM-DD') AS dtcompra,compra.tpcompra,compra.stcompra,compra.formapag,
        pagpagseguro.status AS payment_status,agenda.dtagenda::text AS dtagenda,agenda.tpagenda`;

export async function getVoucherByNumber(client: PoolClient, voucherNumber: string) {
  const result = await client.query<VoucherValidationRow>(
    `
      SELECT ${VALIDATION_COLUMNS}
      FROM voucher
      JOIN compra ON compra.idcompra = voucher.idcompra
      LEFT JOIN pagpagseguro ON pagpagseguro.idcompra = voucher.idcompra
      LEFT JOIN agenda ON agenda.idagenda = voucher.idagenda
      WHERE voucher.numvoucher = $1
      LIMIT 1
      FOR UPDATE OF voucher, compra
    `,
    [voucherNumber],
  );

  return result.rows[0] ?? null;
}

export async function getVouchersByPurchaseId(client: PoolClient, purchaseId: number) {
  const result = await client.query<VoucherValidationRow>(
    `
      SELECT ${VALIDATION_COLUMNS}
      FROM voucher
      JOIN compra ON compra.idcompra = voucher.idcompra
      LEFT JOIN pagpagseguro ON pagpagseguro.idcompra = voucher.idcompra
      LEFT JOIN agenda ON agenda.idagenda = voucher.idagenda
      WHERE voucher.idcompra = $1
      ORDER BY voucher.idvoucher ASC
      FOR UPDATE OF voucher, compra
    `,
    [purchaseId],
  );

  return result.rows;
}

export async function getVouchersByIds(client: PoolClient, voucherIds: number[]) {
  const result = await client.query<VoucherValidationRow>(
    `
      SELECT ${VALIDATION_COLUMNS}
      FROM voucher
      JOIN compra ON compra.idcompra = voucher.idcompra
      LEFT JOIN pagpagseguro ON pagpagseguro.idcompra = voucher.idcompra
      LEFT JOIN agenda ON agenda.idagenda = voucher.idagenda
      WHERE voucher.idvoucher = ANY($1::int[])
      ORDER BY voucher.idvoucher ASC
      FOR UPDATE OF voucher, compra
    `,
    [voucherIds],
  );

  return result.rows;
}

export async function getSchoolTripVouchers(
  client: PoolClient,
  schoolId: number,
  agendaId: number,
) {
  const result = await client.query<SchoolTripVoucherRow>(
    `
      SELECT ${VALIDATION_COLUMNS}, voucher.idescola
      FROM voucher
      JOIN compra ON compra.idcompra = voucher.idcompra
      LEFT JOIN pagpagseguro ON pagpagseguro.idcompra = voucher.idcompra
      LEFT JOIN agenda ON agenda.idagenda = voucher.idagenda
      WHERE voucher.idescola = $1
        AND voucher.idagenda = $2
        AND COALESCE(voucher.tpparticipante, '') <> 'educador'
      ORDER BY voucher.idvoucher ASC
      FOR UPDATE OF voucher, compra
    `,
    [schoolId, agendaId],
  );

  return result.rows;
}
