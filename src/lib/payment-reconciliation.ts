import {
  cancelCodindicaCashback,
  processCodindicaCashback,
} from "@/lib/codindica-cashback";
import { getIngressoSistemaDbPool } from "@/lib/ingresso-db";
import { queuePurchaseConfirmationEmail } from "@/lib/purchase-confirmation-email";
import { registerTicketDeliveryAudit } from "@/lib/ticket-delivery-audit";
import { processConfirmedPurchaseTickets } from "@/lib/ticket-service";

import type { PaymentReconciliationApplyResult } from "@/lib/payment-reconciliation-contract";
import { normalizePaymentReconciliationPayload } from "@/lib/payment-reconciliation-payload";
import { applyPaymentReconciliationRecord } from "@/lib/payment-reconciliation-writer";
export type { GatewayPurchaseStatus, PaymentReconciliationRecord } from "@/lib/payment-reconciliation-contract";
export { mapGatewayStatusToPurchaseStatus, normalizePaymentReconciliationPayload } from "@/lib/payment-reconciliation-payload";
export { applyPaymentReconciliationRecord } from "@/lib/payment-reconciliation-writer";

export async function reconcilePaymentFromGatewayPayload(
  payload: unknown,
  expectedPurchaseId: number,
) {
  const record = normalizePaymentReconciliationPayload(
    payload,
    expectedPurchaseId,
  );
  const pool = getIngressoSistemaDbPool();
  const client = await pool.connect();
  let result: PaymentReconciliationApplyResult;

  try {
    await client.query("BEGIN");
    result = await applyPaymentReconciliationRecord(client, record);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }

  if (result.purchaseStatus === "conc" && result.ledgerAction !== "unchanged") {
    await processConfirmedPurchaseTickets(result.purchaseId)
      .then(async (ticketResult) => {
        console.info("confirmed-purchase-ticket-processing-result", {
          purchaseId: result.purchaseId,
          status: ticketResult.status,
          sentVoucherIds: ticketResult.sentVoucherIds,
          skippedReason: ticketResult.skippedReason ?? null,
        });
        await registerTicketDeliveryAudit({
          purchaseId: result.purchaseId,
          trigger: "payment_reconciliation",
          gatewayPaymentId: result.gatewayPaymentId,
          gatewayStatus: result.gatewayStatus,
          result: ticketResult,
        }).catch((error) => {
          console.error("confirmed-purchase-ticket-audit-failed", error);
        });
      })
      .catch(async (error) => {
        console.error("confirmed-purchase-ticket-processing-failed", error);
        await registerTicketDeliveryAudit({
          purchaseId: result.purchaseId,
          trigger: "payment_reconciliation",
          gatewayPaymentId: result.gatewayPaymentId,
          gatewayStatus: result.gatewayStatus,
          error,
        }).catch((auditError) => {
          console.error("confirmed-purchase-ticket-audit-failed", auditError);
        });
      });
    await queuePurchaseConfirmationEmail(result.purchaseId).catch((error) => {
      console.error("confirmed-purchase-email-queue-failed", error);
    });
    await processCodindicaCashback(result.purchaseId).catch((error) => {
      console.error("confirmed-purchase-cashback-processing-failed", error);
    });
  } else if (result.purchaseStatus === "canc") {
    await cancelCodindicaCashback(result.purchaseId).catch((error) => {
      console.error("cancelled-purchase-cashback-processing-failed", error);
    });
  }

  return result;
}
