import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import type { CieloChargebackCase } from "@/lib/chargeback-contract";
import { getCieloChargebackDocument, getCieloChargebackLifecycle, isCieloChargebackConfigured, listCieloChargebacks, listCieloChargebackPage } from "@/lib/cielo-chargeback";
import { collectChargebackEvidence, describeChargebackIssue, evaluateChargebackEvidence } from "@/lib/chargeback-dossier";
import { renderChargebackDossierPdf } from "@/lib/chargeback-dossier-pdf";
import { getDueChargebacks, saveChargebackDossier, updateChargebackState, upsertChargeback, withChargebackWorkerLock, type ChargebackQuery, type StoredChargeback } from "@/lib/chargeback-repository";
import { presentChargebackDefense } from "@/lib/chargeback-submission";
import { queueLegacyEmail } from "@/lib/legacy-email";

function dateToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function shiftDate(date: string, days: number) {
  const shifted = new Date(`${date}T12:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

async function listInWindows(status: "PENDING" | "DONE", startDate: string, idCase?: string) {
  let end = shiftDate(dateToday(), 1);
  const cases: CieloChargebackCase[] = [];
  while (startDate < end) {
    const start = shiftDate(end, -179) > startDate ? shiftDate(end, -179) : startDate;
    cases.push(...await listCieloChargebacks(status, { startDate: start, endDate: end, idCase }));
    if (idCase && cases.length) break;
    end = start;
  }
  return cases;
}

async function refreshCase(payload: CieloChargebackCase) {
  const date = payload.chargebackDetails.receptionDate?.slice(0, 10) || payload.transactionDetails.transactionDate.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("case_date_unavailable");
  const matches = (items: CieloChargebackCase[]) => items.find((item) => item.idChargeback === payload.idChargeback && item.idCase === payload.idCase && item.establishmentNumber === payload.establishmentNumber);
  const pending = matches(await listInWindows("PENDING", shiftDate(date, -1), payload.idCase));
  if (pending) return pending;
  const done = matches(await listInWindows("DONE", shiftDate(date, -1), payload.idCase));
  if (!done) throw new Error("case_not_confirmed");
  return done;
}

async function saveLifecycle(client: ChargebackQuery, row: StoredChargeback, current: CieloChargebackCase) {
  const lifecycle = await getCieloChargebackLifecycle(current.idCase);
  const entries = Array.isArray(lifecycle) ? lifecycle : [lifecycle];
  const latest = entries.filter((entry) => entry && typeof entry === "object")
    .sort((a, b) => String(a.actionDate ?? "").localeCompare(String(b.actionDate ?? ""))).at(-1);
  const message = typeof latest?.action === "string" ? latest.action : typeof latest?.message === "string" ? latest.message : null;
  await client.query(
    `UPDATE chargeback_cases SET lifecycle=$2::jsonb,result_message=$3,payload=$4::jsonb,
     last_synced_at=NOW(),updated_at=NOW() WHERE id=$1`, [row.id, JSON.stringify(lifecycle), message, JSON.stringify(current)],
  );
  return ["a favor do estabelecimento", "a favor do emissor"].includes(message?.trim().toLocaleLowerCase("pt-BR") ?? "");
}

function materialEvidence(value: Awaited<ReturnType<typeof collectChargebackEvidence>>) {
  return { ...value, capturedAt: null, communicationsCapturedAt: null, livePaymentCheckedAt: null };
}

export async function processChargeback(client: ChargebackQuery, row: StoredChargeback) {
  const fetched = await refreshCase(row.payload);
  const current = row.payload.remoteStatus === "DONE" && fetched.remoteStatus === "PENDING" ? row.payload : fetched;

  if (row.status === "submitting" || row.status === "uncertain") {
    const document = await getCieloChargebackDocument(current) as { file?: string | string[] } | null;
    const file = Array.isArray(document?.file) ? document.file[0] : document?.file;
    const archived = await client.query<{ sha256: string }>("SELECT sha256 FROM chargeback_dossiers WHERE id=$1 AND case_id=$2", [row.submitted_dossier_id, row.id]);
    if (typeof file === "string" && archived.rows[0]?.sha256 === createHash("sha256").update(Buffer.from(file, "base64")).digest("hex")) {
      await client.query("UPDATE chargeback_cases SET status='submitted',issue=NULL,receipt=$2::jsonb,next_attempt_at=NOW()+INTERVAL '6 hours',updated_at=NOW() WHERE id=$1", [row.id, JSON.stringify({ confirmedBy: "supportDocument", checkedAt: new Date().toISOString() })]);
      if (await saveLifecycle(client, row, current)) await updateChargebackState(client, row.id, "resolved", null, 360);
    } else {
      await updateChargebackState(client, row.id, "uncertain", "Envio anterior sem confirmação. A reconciliação continua; solicite confirmação à Cielo. O sistema não retransmite sem garantia contra duplicação.", 30);
    }
    return;
  }

  if (current.remoteStatus === "DONE" || row.status === "submitted" || row.status === "remote_done") {
    const terminal = await saveLifecycle(client, row, current);
    const status = terminal ? "resolved" : row.status === "submitted" ? "submitted" : "remote_done";
    await updateChargebackState(client, row.id, status, null, 360);
    return;
  }

  if (!current.treatmentDeadline || current.treatmentDeadline < dateToday()) {
    await updateChargebackState(client, row.id, "exception", "Prazo de defesa expirado ou indisponível na Cielo.", 1440);
    return;
  }
  const evidence = await collectChargebackEvidence(current);
  await client.query("UPDATE chargeback_cases SET purchase_id=$2,payload=$3::jsonb,last_synced_at=NOW() WHERE id=$1", [row.id, evidence.purchaseId, JSON.stringify(current)]);
  const evaluation = evaluateChargebackEvidence(evidence);
  const previous = (await client.query<{ id: number; snapshot: typeof evidence; pdf: Buffer; policy_version: string }>(
    "SELECT id,snapshot,pdf,policy_version FROM chargeback_dossiers WHERE case_id=$1 ORDER BY id DESC LIMIT 1", [row.id],
  )).rows[0];
  const unchanged = previous?.policy_version === evaluation.policyVersion && isDeepStrictEqual(materialEvidence(previous.snapshot), materialEvidence(evidence));
  const pdf = unchanged ? previous.pdf : await renderChargebackDossierPdf(evidence);
  const dossierId = unchanged ? previous.id : await saveChargebackDossier(client, row.id, evidence, pdf, evaluation.policyVersion);
  if (!evaluation.eligible) {
    await updateChargebackState(client, row.id, "exception", evaluation.issues.map(describeChargebackIssue).join(" ").slice(0, 2000), 360);
    return;
  }

  // Recheck remote eligibility after collection/rendering, before recording a transmission intent.
  const refreshed = await refreshCase(current);
  if (refreshed.remoteStatus !== "PENDING" || JSON.stringify(refreshed) !== JSON.stringify(current) || refreshed.treatmentDeadline < dateToday()) {
    await upsertChargeback(client, refreshed);
    await updateChargebackState(client, row.id, "retry", "Caso alterado durante a coleta. Aguardando nova verificação.", 5);
    return;
  }
  const latestEvidence = await collectChargebackEvidence(refreshed);
  if (!evaluateChargebackEvidence(latestEvidence).eligible || !isDeepStrictEqual(materialEvidence(latestEvidence), materialEvidence(evidence))) {
    await updateChargebackState(client, row.id, "retry", "Evidências alteradas durante a geração. Nova coleta programada.", 5);
    return;
  }
  await presentChargebackDefense(client, row.id, refreshed, dossierId, pdf, evaluation.reason);
}

async function alertExceptions(client: ChargebackQuery) {
  const recipient = process.env.CIELO_CHARGEBACK_ALERT_EMAIL?.trim();
  if (!recipient) throw new Error("chargeback_alert_email_missing");
  const result = await client.query<{ id: number; id_case: string; status: string; issue: string | null; deadline: string; alert_key: string | null }>(
    `SELECT id,id_case,status,issue,payload->>'treatmentDeadline' AS deadline,alert_key FROM chargeback_cases
     WHERE status IN ('exception','rejected','uncertain','submitting') OR
       (status IN ('queued','retry') AND NULLIF(payload->>'treatmentDeadline','')::date <= CURRENT_DATE+1)
     ORDER BY id`,
  );
  for (const item of result.rows) {
    const key = createHash("sha256").update(`${item.status}|${item.issue}|${item.deadline}`).digest("hex");
    if (key === item.alert_key) continue;
    // The email only includes identifiers and status. Detailed evidence stays behind panel authentication.
    const emailId = await queueLegacyEmail({ to: recipient, toName: null, subject: `Contestação Cielo ${item.id_case} precisa de atenção`, html: `<p>O processamento automático do caso ${item.id_case} encontrou uma exceção.</p><p>Consulte Compras → Contestações no painel para ver o motivo e o prazo.</p>` });
    if (!emailId) throw new Error("chargeback_alert_not_queued");
    await client.query("UPDATE chargeback_cases SET alert_key=$2 WHERE id=$1", [item.id, key]);
  }
  const unmatched = await client.query<{ id: string; id_case: string }>("SELECT id,id_case FROM chargeback_events WHERE processed_at IS NULL AND attempts>=12 AND alert_sent=FALSE ORDER BY id LIMIT 50");
  for (const event of unmatched.rows) {
    const emailId = await queueLegacyEmail({ to: recipient, toName: null, subject: `Contestação Cielo ${event.id_case} não localizada`, html: "<p>Uma notificação recebida não pôde ser confirmada após as tentativas automáticas. Verifique o caso no portal Cielo e os logs do job chargebacks.</p>" });
    if (!emailId) throw new Error("chargeback_alert_not_queued");
    await client.query("UPDATE chargeback_events SET alert_sent=TRUE WHERE id=$1", [event.id]);
  }
}

async function alertIntegrationFailure(client: ChargebackQuery) {
  const key = createHash("sha256").update(`integration-failure-${dateToday()}`).digest("hex");
  const existing = await client.query("SELECT id FROM chargeback_events WHERE event_key=$1", [key]);
  if (existing.rows.length) return;
  const emailId = await queueLegacyEmail({ to: process.env.CIELO_CHARGEBACK_ALERT_EMAIL!, toName: null, subject: "Falha na sincronização de contestações Cielo", html: "<p>A importação automática de contestações falhou. O sistema continuará tentando. Verifique a saúde do job chargebacks e os prazos no portal Cielo.</p>" });
  if (!emailId) throw new Error("chargeback_alert_not_queued");
  await client.query("INSERT INTO chargeback_events(event_key,kind,establishment_number,id_case,processed_at) VALUES ($1,'integration_failure','0000000000','0',NOW()) ON CONFLICT (event_key) DO NOTHING", [key]);
}

// Persist one page per tick so an old or large history cannot starve known deadlines.
async function reconcilePage(client: ChargebackQuery, historyStart: string) {
  const end = shiftDate(dateToday(), 1);
  const windowStart = (limit: string) => shiftDate(limit, -179) > historyStart ? shiftDate(limit, -179) : historyStart;
  await client.query(`INSERT INTO chargeback_reconciliation(id,phase,window_start,window_end,cycle_end)
    VALUES (1,'PENDING',$1,$2,$3) ON CONFLICT (id) DO NOTHING`, [windowStart(end), end, end]);
  await client.query(`UPDATE chargeback_reconciliation SET phase='PENDING',window_start=$1,window_end=$2,
    cycle_end=$3,page=0,completed_at=NULL,updated_at=NOW() WHERE id=1 AND completed_at<NOW()-INTERVAL '24 hours'`,
  [windowStart(end), end, end]);
  const cursor = (await client.query<{ phase: "PENDING" | "DONE"; start: string; end: string; cycle_end: string; page: number; completed_at: Date | null }>(
    "SELECT phase,window_start::text AS start,window_end::text AS end,cycle_end::text,page,completed_at FROM chargeback_reconciliation WHERE id=1",
  )).rows[0];
  if (cursor.completed_at) return 0;
  const result = await listCieloChargebackPage(cursor.phase, { startDate: cursor.start, endDate: cursor.end, page: cursor.page });
  for (const item of result.items) await upsertChargeback(client, item);
  if (!result.last) {
    await client.query("UPDATE chargeback_reconciliation SET page=page+1,updated_at=NOW() WHERE id=1");
  } else if (cursor.phase === "PENDING" && cursor.start > historyStart) {
    await client.query("UPDATE chargeback_reconciliation SET window_start=$1,window_end=$2,page=0,updated_at=NOW() WHERE id=1",
      [windowStart(cursor.start), cursor.start]);
  } else if (cursor.phase === "PENDING") {
    await client.query("UPDATE chargeback_reconciliation SET phase='DONE',window_start=$1,window_end=cycle_end,page=0,updated_at=NOW() WHERE id=1", [shiftDate(cursor.cycle_end, -31)]);
  } else {
    await client.query("UPDATE chargeback_reconciliation SET completed_at=NOW(),updated_at=NOW() WHERE id=1");
  }
  return result.items.length;
}

export async function runChargebackSync() {
  if (!isCieloChargebackConfigured()) throw new Error("chargeback_not_configured");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(process.env.CIELO_CHARGEBACK_ALERT_EMAIL ?? "")) throw new Error("chargeback_alert_email_missing");
  return withChargebackWorkerLock(async (client) => {
    const started = Date.now();
    let imported = 0;
    let processed = 0;
    let failed = 0;
    const history = await client.query<{ start: string | null }>("SELECT MIN(dtcompra)::date::text AS start FROM compra");
    const historyStart = process.env.CIELO_CHARGEBACK_START_DATE?.trim() || history.rows[0]?.start || shiftDate(dateToday(), -30);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(historyStart) || historyStart > dateToday()) throw new Error("chargeback_history_date_invalid");
    const pendingEvents = await client.query<{ id: string; id_case: string; establishment_number: string }>("SELECT id,id_case,establishment_number FROM chargeback_events WHERE processed_at IS NULL AND attempts<12 AND next_attempt_at<=NOW() ORDER BY id LIMIT 10");
    for (const row of await getDueChargebacks(client)) {
      if (Date.now() - started > 60000) break;
      try { await processChargeback(client, row); processed++; }
      catch {
        failed++;
        // Never replace an in-flight or completed submission with a sendable state after a DB/network failure.
        await client.query(
          `UPDATE chargeback_cases SET status=CASE WHEN status IN ('submitting','uncertain') THEN 'uncertain'
           WHEN status IN ('submitted','remote_done','resolved','rejected') THEN status WHEN attempts>=12 THEN 'exception' ELSE 'retry' END,
           issue=COALESCE(issue,'Falha ao consultar ou processar o caso. Nova tentativa programada.'),
           attempts=attempts+1,next_attempt_at=NOW()+(CASE WHEN attempts>=12 THEN INTERVAL '1 day' ELSE INTERVAL '30 minutes' END),updated_at=NOW() WHERE id=$1 AND attempts=$2`, [row.id, row.attempts],
        );
      }
    }
    const inboxStarted = Date.now();
    for (const event of pendingEvents.rows) {
      if (Date.now() - inboxStarted > 30000) break;
      let found = false;
      try {
        for (const status of ["PENDING", "DONE"] as const) {
          for (const item of await listInWindows(status, historyStart, event.id_case)) {
            if (item.establishmentNumber !== event.establishment_number) continue;
            await upsertChargeback(client, item);
            await client.query("UPDATE chargeback_cases SET next_attempt_at=NOW() WHERE establishment_number=$1 AND id_chargeback=$2", [item.establishmentNumber, item.idChargeback]);
            imported++;
            found = true;
          }
          if (found) break;
        }
      } catch { failed++; }
      if (found) {
        await client.query("UPDATE chargeback_events SET processed_at=NOW() WHERE id=$1", [event.id]);
      } else {
        await client.query("UPDATE chargeback_events SET attempts=attempts+1,next_attempt_at=NOW()+INTERVAL '30 minutes' WHERE id=$1", [event.id]);
      }
    }
    try { imported += await reconcilePage(client, historyStart); }
    catch {
      failed++;
      try { await alertIntegrationFailure(client); } catch { failed++; }
    }
    try { await alertExceptions(client); } catch { failed++; }
    return { imported, processed, failed, startedAt: new Date(started).toISOString(), finishedAt: new Date().toISOString() };
  });
}
