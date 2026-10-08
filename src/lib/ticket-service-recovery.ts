import { registerTicketDeliveryAudit } from "@/lib/ticket-delivery-audit";
import { listPendingTicketDeliveryPurchases } from "@/lib/ticket-purchase-eligibility";
import { PendingTicketDeliveryRecoveryItem, PendingTicketDeliveryRecoveryResult } from "@/lib/ticket-service-contract";
import { toValidInteger } from "@/lib/ticket-service-config";
import { processConfirmedPurchaseTickets } from "@/lib/ticket-service-fulfillment";

export async function recoverPendingTicketDeliveries(input?: {
  recentDays?: number;
  limit?: number;
}): Promise<PendingTicketDeliveryRecoveryResult> {
  const recentDays = toValidInteger(input?.recentDays, 7, 1, 90);
  const limit = toValidInteger(input?.limit, 50, 1, 200);
  const candidates = await listPendingTicketDeliveryPurchases(recentDays, limit);
  const items: PendingTicketDeliveryRecoveryItem[] = [];
  let recovered = 0;
  let skipped = 0;
  let failed = 0;

  for (const candidate of candidates) {
    const purchaseId = candidate.purchase_id;
    const pendingVouchers = Number(candidate.pending_vouchers) || 0;

    try {
      const result = await processConfirmedPurchaseTickets(purchaseId);

      await registerTicketDeliveryAudit({
        purchaseId,
        trigger: "delivery_recovery",
        result,
      }).catch((error) => {
        console.error("ticket-delivery-recovery-audit-failed", error);
      });

      if (result.status === "sent") {
        recovered += 1;
        items.push({
          purchaseId,
          pendingVouchers,
          result: "sent",
          sentVoucherIds: result.sentVoucherIds,
          note: "Entrega recuperada com sucesso.",
        });
        continue;
      }

      skipped += 1;
      items.push({
        purchaseId,
        pendingVouchers,
        result: "skipped",
        sentVoucherIds: [],
        note: `Entrega nao reenviada (${result.skippedReason ?? "skipped"}).`,
      });
    } catch (error) {
      failed += 1;
      await registerTicketDeliveryAudit({
        purchaseId,
        trigger: "delivery_recovery",
        error,
      }).catch((auditError) => {
        console.error("ticket-delivery-recovery-audit-failed", auditError);
      });
      items.push({
        purchaseId,
        pendingVouchers,
        result: "error",
        sentVoucherIds: [],
        note:
          error instanceof Error ?
            error.message :
            "Falha inesperada ao recuperar a entrega.",
      });
    }
  }

  return {
    action: "ticket_delivery_recovery",
    candidates: candidates.length,
    processed: items.length,
    recovered,
    skipped,
    failed,
    items,
    message:
      items.length > 0 ?
        `Recuperacao de entrega executada para ${items.length} compra(s).` :
        "Nenhuma compra elegivel para recuperacao de entrega.",
  };
}

