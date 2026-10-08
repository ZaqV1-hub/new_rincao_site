import { getIngressoSistemaDbPool } from "@/lib/ingresso-db";
import { schoolPaymentSchemaAvailable, schoolTicketDeliveryAllowed } from "@/lib/school-payment-eligibility";

export type ConfirmedPurchaseRow = {
  idcompra: number;
  cpf: string | null;
  tpcompra: string | null;
  dtcompra: string | null;
  email: string | null;
  nmusuario: string | null;
  celular: string | null;
};

export type PendingTicketDeliveryPurchaseRow = {
  purchase_id: number;
  pending_vouchers: string;
};

export async function loadConfirmedPurchase(purchaseId: number) {
  const pool = getIngressoSistemaDbPool();
  if (!await schoolTicketDeliveryAllowed(pool, purchaseId)) return null;
  const purchase = await pool.query<ConfirmedPurchaseRow>(
    `
      SELECT
        compra.idcompra,
        compra.cpf,
        compra.tpcompra,
        compra.dtcompra::text AS dtcompra,
        usuario.email,
        usuario.nmusuario,
        usuario.celular
      FROM compra
      LEFT JOIN usuario ON usuario.cpf = compra.cpf
      WHERE compra.idcompra = $1
        AND compra.stcompra = 'conc'
      LIMIT 1
    `,
    [purchaseId],
  );

  return purchase.rows[0] ?? null;
}

export async function listPendingTicketDeliveryPurchases(
  recentDays: number,
  limit: number,
) {
  const pool = getIngressoSistemaDbPool();
  const admissionFilter = await schoolPaymentSchemaAvailable(pool) ? `
        AND NOT EXISTS (SELECT 1 FROM commerce_school_payment_hold h WHERE h.order_id=compra.idcompra
          AND (h.status<>'released' OR h.source='site'))
        AND (compra.checkout_school_site_context IS NULL OR EXISTS
          (SELECT 1 FROM commerce_school_payment_hold h WHERE h.order_id=compra.idcompra))` : "";
  const result = await pool.query<PendingTicketDeliveryPurchaseRow>(
    `
      SELECT
        compra.idcompra AS purchase_id,
        COUNT(*)::text AS pending_vouchers
      FROM compra
      JOIN voucher ON voucher.idcompra = compra.idcompra
      WHERE compra.stcompra = 'conc'
        AND voucher.stusado NOT IN ('s', 'inv')
        AND COALESCE(voucher.voucherenviado, 'n') <> 's'
        AND COALESCE(compra.dtpagamento, compra.dtcompra) >= CURRENT_DATE - $1::integer
      ${admissionFilter}
      GROUP BY compra.idcompra
      ORDER BY compra.idcompra ASC
      LIMIT $2
    `,
    [recentDays, limit],
  );

  return result.rows;
}

