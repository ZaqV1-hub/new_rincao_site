import type { CieloChargebackCase } from "@/lib/chargeback-contract";
import { CieloChargebackError, submitCieloChargebackDefense } from "@/lib/cielo-chargeback";
import type { ChargebackQuery } from "@/lib/chargeback-repository";

export async function presentChargebackDefense(client: ChargebackQuery, caseId: number, chargeback: CieloChargebackCase, dossierId: number, pdf: Buffer, reason: string) {
  const claimed = await client.query<{ attempts: number }>(
    `UPDATE chargeback_cases SET status='submitting',submitted_dossier_id=$2,issue=NULL,updated_at=NOW()
     WHERE id=$1 AND status IN ('queued','retry','exception') RETURNING attempts`, [caseId, dossierId],
  );
  if (claimed.rowCount !== 1) throw new Error("chargeback_submission_already_started");

  let receipt: unknown;
  try {
    receipt = await submitCieloChargebackDefense(chargeback, pdf, reason);
  } catch (error) {
    const known = error instanceof CieloChargebackError;
    const uncertain = !known || error.uncertain;
    const canRetry = known && error.transient && claimed.rows[0].attempts + 1 < 12;
    const status = uncertain ? "uncertain" : canRetry ? "retry" : "rejected";
    const issue = uncertain
      ? "Envio com resultado incerto. Aguardando confirmação da Cielo."
      : canRetry
        ? "Falha temporária no envio. Nova tentativa programada."
        : "Envio automático interrompido. Verifique a configuração da integração e o caso na Cielo.";
    const errorCode = known && /^cielo_[a-z0-9_]{1,75}$/.test(error.code) ? error.code : "chargeback_submission_failed";
    await client.query(
      `UPDATE chargeback_cases SET status=$2,issue=$3,receipt=$4::jsonb,attempts=attempts+1,
       next_attempt_at=NOW()+INTERVAL '5 minutes',updated_at=NOW() WHERE id=$1 AND status='submitting'`,
      [caseId, status, issue, JSON.stringify({ errorCode })],
    );
    throw error;
  }

  // A failure here leaves 'submitting' persisted. Recovery must query Cielo, never resend blindly.
  await client.query(
    `UPDATE chargeback_cases SET status='submitted',receipt=$2::jsonb,submitted_at=NOW(),issue=NULL,
     next_attempt_at=NOW()+INTERVAL '6 hours',updated_at=NOW() WHERE id=$1 AND status='submitting'`,
    [caseId, JSON.stringify(receipt)],
  );
}
