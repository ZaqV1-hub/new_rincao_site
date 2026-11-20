import type { CieloChargebackCase } from "@/lib/chargeback-contract";
import type { ChargebackQuery } from "@/lib/chargeback-repository";
import { findIssuerLossPurchase } from "@/lib/chargeback-dossier";
import { syncTicketValidation } from "@/lib/ticket-service";

type Loss = { id: number; lifecycle: unknown; payload: CieloChargebackCase; purchase_id: number | null; invalidated_vouchers: number[] | null };

export async function reconcileIssuerLosses(client: ChargebackQuery) {
  const due = await client.query<Loss>(`SELECT id, lifecycle, payload, purchase_id, invalidated_vouchers FROM chargeback_cases
    WHERE voucher_block_enabled AND status='resolved' AND lower(trim(result_message))='a favor do emissor'
      AND voucher_block_completed_at IS NULL AND (issue IS NULL OR next_attempt_at<=now())
    ORDER BY next_attempt_at,id LIMIT 5`);
  let failed = 0;
  for (const loss of due.rows) {
    let purchaseId = loss.purchase_id;
    let ids = loss.invalidated_vouchers;
    let issue = "Falha ao bloquear ingressos após decisão a favor do emissor.";
    try {
      if (ids === null) {
        const actions = (Array.isArray(loss.lifecycle) ? loss.lifecycle : [loss.lifecycle])
          .filter(entry => entry && typeof entry.actionDate === "string");
        const latest = actions.map(entry => entry.actionDate).sort().at(-1);
        const outcomes = actions.filter(entry => entry.actionDate === latest)
          .map(entry => String(entry.action ?? entry.message ?? "").trim().toLowerCase());
        if (!latest || !outcomes.includes("a favor do emissor") || outcomes.includes("a favor do estabelecimento")) {
          issue = "Confira a decisão final conflitante ou incompleta da Cielo antes de bloquear ingressos.";
          throw new Error("issuer_loss_outcome_unverified");
        }
        await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
        try {
          const linked = await findIssuerLossPurchase(client, loss.payload);
          if (!linked || (purchaseId !== null && purchaseId !== linked)) {
            issue = "Decisão a favor do emissor. Confira o vínculo entre compra, pagamento e valor antes de bloquear ingressos.";
            throw new Error("issuer_loss_purchase_unverified");
          }
          purchaseId = linked;
          const changed = await client.query<{ idvoucher: number }>(`UPDATE voucher SET stusado='inv',
            dtuso=(now() AT TIME ZONE 'America/Sao_Paulo')::date, hruso=(now() AT TIME ZONE 'America/Sao_Paulo')::time
            WHERE idcompra=$1 AND stusado='n' RETURNING idvoucher`, [linked]);
          ids = changed.rows.map(row => row.idvoucher);
          await client.query("UPDATE chargeback_cases SET purchase_id=$2,invalidated_vouchers=$3,updated_at=now() WHERE id=$1", [loss.id, linked, ids]);
          await client.query("COMMIT");
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        }
      }
      if (ids.length) {
        issue = "Ingressos bloqueados no sistema. Sincronização com o serviço de ingressos pendente.";
        if (process.env.CIELO_CHARGEBACK_ENVIRONMENT === "production" && process.env.INGRESSO_TICKET_API_TESTING === "true") {
          throw new Error("ticket_service_test_mode");
        }
        if (!purchaseId) throw new Error("issuer_loss_purchase_missing");
        const linked = purchaseId;
        const result = await syncTicketValidation(ids.map(voucherId => ({ purchaseId: linked, voucherId })), "invalidate");
        if (result.status !== "sent") throw new Error("ticket_invalidation_pending");
      }
      await client.query("UPDATE chargeback_cases SET voucher_block_completed_at=now(),issue=NULL,updated_at=now() WHERE id=$1", [loss.id]);
    } catch {
      await client.query("UPDATE chargeback_cases SET issue=$2,next_attempt_at=now()+interval '6 hours',updated_at=now() WHERE id=$1", [loss.id, issue]);
      failed++;
    }
  }
  return failed;
}
