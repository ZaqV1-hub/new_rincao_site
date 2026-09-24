import { getIngressoSistemaDbPool } from "@/lib/ingresso-db";
import {
  getNativeCieloCheckoutStatus,
  isCieloEcommerceConfigured,
} from "@/lib/cielo-ecommerce";
import { reconcilePaymentFromGatewayPayload } from "@/lib/payment-reconciliation";

type PaymentSyncCandidateRow = {
  purchase_id: number;
  purchase_date: string | null;
  purchase_status: string | null;
  payment_id: string | null;
  gateway_status: string | null;
};

export type OperationalPaymentSyncItem = {
  purchaseId: number;
  paymentId: string | null;
  result:
    | "reconciled"
    | "cancelled"
    | "not_found"
    | "skipped"
    | "error";
  purchaseStatus: string | null;
  gatewayStatus: number | null;
  note: string;
};

export type SyncOperationalPaymentStatusesInput = {
  recentDays?: number;
  cancelAfterDays?: number;
  cancelStale?: boolean;
  limit?: number;
  perDayLimit?: number;
  purchaseId?: number;
};

export type SyncOperationalPaymentStatusesSuccess = {
  action: "payment_sync";
  configured: boolean;
  candidates: number;
  processed: number;
  reconciled: number;
  cancelled: number;
  missing: number;
  skipped: number;
  failed: number;
  items: OperationalPaymentSyncItem[];
  message: string;
};

class OperationalPaymentSyncError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "OperationalPaymentSyncError";
    this.code = code;
    this.status = status;
  }
}

function toValidInteger(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(parsed, min), max);
}

function isOlderThanDays(dateText: string | null, days: number) {
  if (!dateText) {
    return false;
  }

  const parsed = new Date(dateText);

  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  const threshold = new Date();
  threshold.setHours(0, 0, 0, 0);
  threshold.setDate(threshold.getDate() - days);

  return parsed.getTime() < threshold.getTime();
}

export function asOperationalPaymentSyncError(error: unknown) {
  if (error instanceof OperationalPaymentSyncError) {
    return error;
  }

  return new OperationalPaymentSyncError(
    "ops_payment_sync_unavailable",
    "Nao foi possivel executar a reconciliacao operacional de pagamentos.",
    502,
  );
}

async function listPaymentSyncCandidates(
  recentDays: number,
  limit: number,
  purchaseId?: number,
  perDayLimit?: number,
) {
  const pool = getIngressoSistemaDbPool();
  const client = await pool.connect();

  try {
    const candidateColumns = `
          compra.idcompra AS purchase_id,
          compra.dtcompra::text AS purchase_date,
          compra.stcompra AS purchase_status,
          pagamento.idpagseguro AS payment_id,
          pagamento.status::text AS gateway_status
    `;
    const candidateSource = `
        FROM compra
        LEFT JOIN LATERAL (
          SELECT
            pagpagseguro.idpagseguro,
            pagpagseguro.status
          FROM pagpagseguro
          WHERE pagpagseguro.idcompra = compra.idcompra
          ORDER BY pagpagseguro.date DESC NULLS LAST, pagpagseguro.idpagseguro DESC
          LIMIT 1
        ) pagamento ON true
        WHERE compra.tpcompra = 'ponli'
          AND compra.formapag = 'pgseg'
          AND compra.stcompra <> 'canc'
          AND (
            ($3::integer IS NOT NULL AND compra.idcompra = $3)
            OR ($3::integer IS NULL AND compra.dtcompra >= CURRENT_DATE - $1::integer)
          )
          AND (
            pagamento.idpagseguro IS NOT NULL
            OR compra.stcompra = 'pend'
          )
          AND (
            pagamento.status IS NULL
            OR pagamento.status IN (0, 1, 2, 5, 8, 9, 12)
            OR compra.stcompra = 'pend'
          )
    `;
    const sql = perDayLimit === undefined ?
      `
        SELECT ${candidateColumns}
        ${candidateSource}
        ORDER BY compra.idcompra DESC
        LIMIT $2
      ` :
      `
        SELECT purchase_id, purchase_date, purchase_status, payment_id, gateway_status
        FROM (
          SELECT ${candidateColumns},
            ROW_NUMBER() OVER (
              PARTITION BY compra.dtcompra::date
              ORDER BY compra.idcompra DESC
            ) AS day_rank
          ${candidateSource}
        ) ranked_candidates
        WHERE day_rank <= $4
        ORDER BY purchase_id DESC
        LIMIT $2
      `;
    const result = await client.query<PaymentSyncCandidateRow>(
      sql,
      perDayLimit === undefined ?
        [recentDays, limit, purchaseId ?? null] :
        [recentDays, limit, purchaseId ?? null, perDayLimit],
    );

    return result.rows;
  } finally {
    client.release();
  }
}

async function cancelStalePendingPurchase(purchaseId: number) {
  const pool = getIngressoSistemaDbPool();
  const client = await pool.connect();

  try {
    await client.query(
      `
        UPDATE compra
        SET stcompra = 'canc'
        WHERE idcompra = $1
          AND stcompra = 'pend'
      `,
      [purchaseId],
    );
  } finally {
    client.release();
  }
}

export async function syncOperationalPaymentStatuses(
  input?: SyncOperationalPaymentStatusesInput,
): Promise<SyncOperationalPaymentStatusesSuccess> {
  const recentDays = toValidInteger(input?.recentDays, 7, 1, 90);
  const cancelAfterDays = toValidInteger(input?.cancelAfterDays, 5, 1, 30);
  const limit = toValidInteger(input?.limit, 50, 1, 700);
  const perDayLimit = input?.perDayLimit === undefined ?
    undefined :
    toValidInteger(input.perDayLimit, 100, 1, 100);
  const purchaseId = input?.purchaseId;

  if (
    purchaseId !== undefined &&
    (!Number.isSafeInteger(purchaseId) ||
      purchaseId <= 0 ||
      purchaseId > 2_147_483_647)
  ) {
    throw new OperationalPaymentSyncError(
      "invalid_purchase_id",
      "Compra invalida para conciliacao.",
      400,
    );
  }

  if (!isCieloEcommerceConfigured()) {
    return {
      action: "payment_sync",
      configured: false,
      candidates: 0,
      processed: 0,
      reconciled: 0,
      cancelled: 0,
      missing: 0,
      skipped: 0,
      failed: 0,
      items: [],
      message:
        "Integracao Cielo nao configurada; reconciliacao operacional em lote ignorada.",
    };
  }

  const candidates = await listPaymentSyncCandidates(
    recentDays,
    purchaseId ? 1 : limit,
    purchaseId,
    perDayLimit,
  );
  const items: OperationalPaymentSyncItem[] = [];
  let reconciled = 0;
  let cancelled = 0;
  let missing = 0;
  let skipped = 0;
  let failed = 0;

  for (const candidate of candidates) {
    try {
      const statusPayload = await getNativeCieloCheckoutStatus({
        paymentId: candidate.payment_id,
        reference: String(candidate.purchase_id),
        purchaseId: candidate.purchase_id,
      });

      if (statusPayload.status === "00") {
        const reconciliation = await reconcilePaymentFromGatewayPayload(
          statusPayload,
          candidate.purchase_id,
        );

        reconciled += 1;
        items.push({
          purchaseId: candidate.purchase_id,
          paymentId: candidate.payment_id,
          result: "reconciled",
          purchaseStatus: reconciliation.purchaseStatus,
          gatewayStatus: reconciliation.gatewayStatus,
          note: `Compra reconciliada com ledger ${reconciliation.ledgerAction}.`,
        });
        continue;
      }

      if (
        statusPayload.status === "30" &&
        input?.cancelStale !== false &&
        !candidate.payment_id &&
        candidate.purchase_status === "pend" &&
        isOlderThanDays(candidate.purchase_date, cancelAfterDays)
      ) {
        await cancelStalePendingPurchase(candidate.purchase_id);

        cancelled += 1;
        items.push({
          purchaseId: candidate.purchase_id,
          paymentId: null,
          result: "cancelled",
          purchaseStatus: "canc",
          gatewayStatus: null,
          note:
            "Compra pendente sem transacao localizada foi cancelada pelo job.",
        });
        continue;
      }

      missing += 1;
      items.push({
        purchaseId: candidate.purchase_id,
        paymentId: candidate.payment_id,
        result: "not_found",
        purchaseStatus: candidate.purchase_status,
        gatewayStatus:
          candidate.gateway_status != null ? Number(candidate.gateway_status) : null,
        note: String(statusPayload.msgRetorno ?? "Transacao nao encontrada."),
      });
    } catch (error) {
      failed += 1;
      items.push({
        purchaseId: candidate.purchase_id,
        paymentId: candidate.payment_id,
        result: "error",
        purchaseStatus: candidate.purchase_status,
        gatewayStatus:
          candidate.gateway_status != null ? Number(candidate.gateway_status) : null,
        note:
          error instanceof Error ?
            error.message :
            "Falha inesperada ao reconciliar a compra.",
      });
    }
  }

  skipped = items.filter((item) => item.result === "skipped").length;

  return {
    action: "payment_sync",
    configured: true,
    candidates: candidates.length,
    processed: items.length,
    reconciled,
    cancelled,
    missing,
    skipped,
    failed,
    items,
    message:
      items.length > 0 ?
        `Reconciliacao operacional executada para ${items.length} compra(s).` :
        "Nenhuma compra elegivel para reconciliacao operacional.",
  };
}
