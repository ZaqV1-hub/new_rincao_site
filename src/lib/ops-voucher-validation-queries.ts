import type { PoolClient } from "pg";
import { getOperationalParkId } from "@/lib/operational-day-contract";
import { VoucherOperationError } from "@/lib/ops-voucher-validation-contract";
import type { VoucherValidationRow, SchoolTripVoucherRow } from "@/lib/ops-voucher-validation-shared";
const VALIDATION_COLUMNS = `voucher.idvoucher,voucher.idagenda,voucher.numvoucher,voucher.stusado,voucher.stvoucher,
        voucher.validacao_periodo_id,voucher.validado_em::text,voucher.validado_por_nome,voucher.periodo_id,voucher.closed_at::text,
        voucher.tpvoucher,voucher.servico_id,compra.caixa_periodo_id,
        ARRAY(SELECT periodo_id FROM compra_pagamentos WHERE idcompra=voucher.idcompra AND periodo_id IS NOT NULL) AS payment_period_ids,
        (SELECT local_nome FROM caixa_periodos WHERE id=voucher.validacao_periodo_id) AS validacao_local_nome,
        to_char(voucher.dtinicio_validade, 'YYYY-MM-DD') AS dtinicio_validade,
        to_char(voucher.dtvalidade, 'YYYY-MM-DD') AS dtvalidade, voucher.parque_operacional,
        to_char(voucher.dtuso, 'YYYY-MM-DD') AS dtuso,voucher.hruso::text AS hruso,voucher.idcompra,
        to_char(compra.dtcompra, 'YYYY-MM-DD') AS dtcompra,compra.tpcompra,compra.stcompra,compra.formapag,
        pagpagseguro.status AS payment_status,agenda.dtagenda::text AS dtagenda,agenda.tpagenda`;

// Lock parent purchases first, matching payment reconciliation before voucher row locks.
async function lockVoucherPurchases(client: PoolClient, condition: string, values: unknown[]) {
  await client.query(`SELECT compra.idcompra FROM compra
    WHERE compra.idcompra IN (SELECT voucher.idcompra FROM voucher WHERE ${condition})
    ORDER BY compra.idcompra FOR UPDATE OF compra`, values);
}

export async function getVoucherByNumber(client: PoolClient, voucherNumber: string) {
  await lockVoucherPurchases(client, "voucher.numvoucher = $1", [voucherNumber]);
  const result = await client.query<VoucherValidationRow>(
    `
      SELECT ${VALIDATION_COLUMNS}
      FROM voucher
      JOIN compra ON compra.idcompra = voucher.idcompra
      LEFT JOIN pagpagseguro ON pagpagseguro.idcompra = voucher.idcompra
      LEFT JOIN agenda ON agenda.idagenda = voucher.idagenda
      WHERE voucher.numvoucher = $1
      LIMIT 1
      FOR UPDATE OF voucher
    `,
    [voucherNumber],
  );

  return result.rows[0] ?? null;
}

export async function getVouchersByPurchaseId(client: PoolClient, purchaseId: number) {
  await lockVoucherPurchases(client, "voucher.idcompra = $1", [purchaseId]);
  const result = await client.query<VoucherValidationRow>(
    `
      SELECT ${VALIDATION_COLUMNS}
      FROM voucher
      JOIN compra ON compra.idcompra = voucher.idcompra
      LEFT JOIN pagpagseguro ON pagpagseguro.idcompra = voucher.idcompra
      LEFT JOIN agenda ON agenda.idagenda = voucher.idagenda
      WHERE voucher.idcompra = $1
      ORDER BY voucher.idvoucher ASC
      FOR UPDATE OF voucher
    `,
    [purchaseId],
  );

  return result.rows;
}

export async function getVouchersByIds(client: PoolClient, voucherIds: number[], expectedPurchaseId?: number) {
  if (expectedPurchaseId !== undefined && (!Number.isSafeInteger(expectedPurchaseId) || expectedPurchaseId <= 0)) {
    throw new VoucherOperationError("invalid_purchase_id", "Informe uma compra válida.", 400);
  }
  await lockVoucherPurchases(client, "voucher.idvoucher = ANY($1::int[])", [voucherIds]);
  const result = await client.query<VoucherValidationRow>(
    `
      SELECT ${VALIDATION_COLUMNS}
      FROM voucher
      JOIN compra ON compra.idcompra = voucher.idcompra
      LEFT JOIN pagpagseguro ON pagpagseguro.idcompra = voucher.idcompra
      LEFT JOIN agenda ON agenda.idagenda = voucher.idagenda
      WHERE voucher.idvoucher = ANY($1::int[])
      ORDER BY voucher.idvoucher ASC
      FOR UPDATE OF voucher
    `,
    [voucherIds],
  );

  // Check the entire selection after row locks, before any voucher can be changed.
  if (expectedPurchaseId !== undefined) {
    const foundIds = new Set(result.rows.map((voucher) => voucher.idvoucher));
    if (voucherIds.some((id) => !foundIds.has(id)) || result.rows.some((voucher) => voucher.idcompra !== expectedPurchaseId)) {
      throw new VoucherOperationError("voucher_purchase_mismatch", "Todos os vouchers selecionados devem pertencer à compra informada.", 409);
    }
    const park = getOperationalParkId();
    if (result.rows.some((voucher) => voucher.parque_operacional != null && voucher.parque_operacional !== park)) {
      throw new VoucherOperationError("voucher_park_mismatch", "O ingresso pertence a outro parque.", 409);
    }
  }
  return result.rows;
}

export async function getSchoolTripVouchers(
  client: PoolClient,
  schoolId: number,
  agendaId: number,
) {
  await lockVoucherPurchases(client, "voucher.idescola = $1 AND voucher.idagenda = $2", [schoolId, agendaId]);
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
        AND compra.stcompra = 'conc'
        AND (compra.tpcompra = 'bilhe' OR (compra.tpcompra = 'ponli' AND pagpagseguro.status IN (3,4))
          OR (compra.tpcompra = 'reser' AND COALESCE(UPPER(TRIM(compra.formapag)), '') NOT IN ('', 'N/A')))
      ORDER BY voucher.idvoucher ASC
      FOR UPDATE OF voucher
    `,
    [schoolId, agendaId],
  );

  return result.rows;
}
