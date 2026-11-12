import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import { getIngressoSistemaDbDialect, getIngressoSistemaDbPool } from "@/lib/ingresso-db";
import type { CieloChargebackCase } from "@/lib/chargeback-contract";

export type ChargebackQuery = Pick<PoolClient, "query">;
export type ChargebackStatus = "queued" | "retry" | "exception" | "rejected" | "submitting" | "uncertain" | "submitted" | "resolved" | "remote_done";
export type ChargebackCaseSummary = {
  id: number;
  purchaseId: number | null;
  idCase: string;
  idChargeback: string;
  establishmentNumber: string;
  deadline: string;
  reason: string;
  amount: string;
  status: ChargebackStatus;
  issue: string | null;
  updatedAt: string;
  lastSyncedAt: string | null;
  hasDossier: boolean;
  submittedAt: string | null;
  remoteStatus: string;
  resultMessage: string | null;
};

export type StoredChargeback = {
  id: number;
  payload: CieloChargebackCase;
  status: ChargebackStatus;
  attempts: number;
  issue: string | null;
  purchase_id: number | null;
  submitted_dossier_id: number | null;
  submitted_at: Date | null;
};

function positiveId(value: number) {
  if (!Number.isSafeInteger(value) || value <= 0 || value > 2147483647) throw new Error("Identificador inválido.");
}

export async function withChargebackWorkerLock<T>(work: (client: ChargebackQuery) => Promise<T>): Promise<T | null> {
  if (getIngressoSistemaDbDialect() !== "postgres") throw new Error("Chargeback requer PostgreSQL no banco do sistema.");
  const client = await getIngressoSistemaDbPool().connect();
  let locked = false;
  let connectionError: Error | undefined;
  try {
    let result;
    try { result = await client.query<{ locked: boolean }>("SELECT pg_try_advisory_lock(739124, 1) AS locked"); }
    catch (error) { connectionError = new Error("chargeback_lock_failed"); throw error; }
    locked = result.rows[0]?.locked === true;
    if (!locked) return null;
    return await work(client);
  } finally {
    // Destroy the connection if unlocking fails, so it cannot retain a pooled lock.
    if (locked) {
      try {
        const result = await client.query("SELECT pg_advisory_unlock(739124, 1) AS unlocked");
        if (result.rows[0]?.unlocked !== true) connectionError = new Error("chargeback_unlock_failed");
      } catch { connectionError = new Error("chargeback_unlock_failed"); }
    }
    client.release(connectionError);
  }
}

export async function recordChargebackNotification(input: { kind: string; establishmentNumber: string; idCase: string; fingerprint: string }) {
  const eventKey = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  await getIngressoSistemaDbPool().query(
    `INSERT INTO chargeback_events (event_key, kind, establishment_number, id_case)
     VALUES ($1,$2,$3,$4) ON CONFLICT (event_key) DO NOTHING`,
    [eventKey, input.kind, input.establishmentNumber, input.idCase],
  );
}

export async function upsertChargeback(client: ChargebackQuery, payload: CieloChargebackCase) {
  const result = await client.query<{ id: number }>(
    `INSERT INTO chargeback_cases (establishment_number, id_chargeback, id_case, payload)
     VALUES ($1,$2,$3,$4::jsonb)
     ON CONFLICT (establishment_number, id_chargeback) DO UPDATE SET
       payload = CASE WHEN chargeback_cases.payload->>'remoteStatus'='DONE' AND EXCLUDED.payload->>'remoteStatus'='PENDING'
         THEN chargeback_cases.payload ELSE EXCLUDED.payload END, last_synced_at = NOW(), updated_at = NOW(),
       next_attempt_at = CASE WHEN chargeback_cases.payload IS DISTINCT FROM EXCLUDED.payload
         AND chargeback_cases.status NOT IN ('submitting','uncertain','submitted','resolved','rejected')
         THEN NOW() ELSE chargeback_cases.next_attempt_at END
     RETURNING id`,
    [payload.establishmentNumber, payload.idChargeback, payload.idCase, JSON.stringify(payload)],
  );
  return result.rows[0].id;
}

export async function getDueChargebacks(client: ChargebackQuery) {
  const result = await client.query<StoredChargeback>(
    `SELECT id, payload, status, attempts, issue, purchase_id, submitted_dossier_id, submitted_at
     FROM chargeback_cases WHERE next_attempt_at <= NOW() AND status NOT IN ('resolved','rejected')
     ORDER BY CASE WHEN status IN ('queued','retry','exception','submitting','uncertain') THEN 0 ELSE 1 END,
       NULLIF(payload->>'treatmentDeadline','') ASC NULLS LAST, id LIMIT 10`,
  );
  return result.rows;
}

export async function saveChargebackDossier(client: ChargebackQuery, caseId: number, snapshot: unknown, pdf: Buffer, policyVersion: string) {
  if (pdf.length > 8000000 || !pdf.subarray(0, 5).equals(Buffer.from("%PDF-"))) throw new Error("PDF inválido ou acima de 8 MB.");
  const sha256 = createHash("sha256").update(pdf).digest("hex");
  const snapshotJson = JSON.stringify(snapshot);
  const snapshotHash = createHash("sha256").update(snapshotJson).digest("hex");
  const result = await client.query<{ id: number }>(
    `INSERT INTO chargeback_dossiers (case_id,snapshot,pdf,sha256,policy_version,snapshot_hash)
     VALUES ($1,$2::jsonb,$3,$4,$5,$6)
     ON CONFLICT (case_id, sha256, snapshot_hash, policy_version) DO UPDATE SET sha256 = EXCLUDED.sha256 RETURNING id`,
    [caseId, snapshotJson, pdf, sha256, policyVersion, snapshotHash],
  );
  return result.rows[0].id;
}

export async function updateChargebackState(client: ChargebackQuery, caseId: number, status: ChargebackStatus, issue: string | null, delayMinutes: number) {
  await client.query(
    `UPDATE chargeback_cases SET status=$2, issue=$3, attempts=attempts+1,
     next_attempt_at=NOW()+($4 * INTERVAL '1 minute'), updated_at=NOW() WHERE id=$1`,
    [caseId, status, issue, delayMinutes],
  );
}

export async function listChargebackCases(input: { purchaseId?: number; limit?: number; offset?: number } = {}): Promise<{ items: ChargebackCaseSummary[]; total: number }> {
  if (input.purchaseId !== undefined) positiveId(input.purchaseId);
  const limit = input.limit ?? 25;
  const offset = input.offset ?? 0;
  if (!Number.isInteger(limit) || limit < 1 || limit > 200 || !Number.isSafeInteger(offset) || offset < 0) throw new Error("Paginação inválida.");
  const pool = getIngressoSistemaDbPool();
  const rows = await pool.query(
    `SELECT c.*, EXISTS(SELECT 1 FROM chargeback_dossiers d WHERE d.case_id=c.id) AS has_dossier
     FROM chargeback_cases c WHERE ($1::integer IS NULL OR purchase_id=$1)
     ORDER BY NULLIF(payload->>'treatmentDeadline','') ASC NULLS LAST, id DESC LIMIT $2 OFFSET $3`,
    [input.purchaseId ?? null, limit, offset],
  );
  const count = await pool.query<{ total: string }>("SELECT COUNT(*)::text AS total FROM chargeback_cases WHERE ($1::integer IS NULL OR purchase_id=$1)", [input.purchaseId ?? null]);
  return {
    total: Number(count.rows[0]?.total ?? 0),
    items: rows.rows.map((row) => {
      const payload = row.payload as CieloChargebackCase;
      return {
        id: row.id, purchaseId: row.purchase_id, idCase: payload.idCase,
        idChargeback: payload.idChargeback, establishmentNumber: payload.establishmentNumber,
        deadline: payload.treatmentDeadline, reason: payload.chargebackDetails.reasonDescription,
        amount: payload.transactionAmount, status: row.status, issue: row.issue,
        updatedAt: new Date(row.updated_at).toISOString(),
        lastSyncedAt: row.last_synced_at ? new Date(row.last_synced_at).toISOString() : null,
        hasDossier: row.has_dossier, submittedAt: row.submitted_at ? new Date(row.submitted_at).toISOString() : null,
        remoteStatus: payload.remoteStatus, resultMessage: row.result_message,
      };
    }),
  };
}

export async function getChargebackDossier(caseId: number) {
  positiveId(caseId);
  const result = await getIngressoSistemaDbPool().query<{ pdf: Buffer; sha256: string; id_case: string }>(
    `SELECT d.pdf,d.sha256,c.id_case FROM chargeback_dossiers d JOIN chargeback_cases c ON c.id=d.case_id
     WHERE c.id=$1 ORDER BY (d.id=c.submitted_dossier_id) DESC NULLS LAST, d.id DESC LIMIT 1`, [caseId],
  );
  const row = result.rows[0];
  return row ? { pdf: row.pdf, sha256: row.sha256, filename: `${row.id_case}.pdf` } : null;
}
