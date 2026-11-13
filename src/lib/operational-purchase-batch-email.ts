import { getIngressoSistemaDbPool } from "@/lib/ingresso-db";
import { getOperationalParkId } from "@/lib/operational-day-contract";
import { isSmtpConfigured, sendLegacyEmailOnce } from "@/lib/legacy-email";
import type { CatalogActor } from "@/lib/painel-operational-catalog";
import { PurchaseBatchError, invalidPurchaseBatch, type PurchaseBatchItem } from "./operational-purchase-batch-contract";

export type PurchaseBatchEmailSummary = { configured: boolean; pending: number; dispatching: number; accepted: number; failed: number; unknown: number };
export type PurchaseBatchEmailHistory = { batchId: string; purchaseIds: number[]; createdAt: string; summary: PurchaseBatchEmailSummary }[];
type Notice = { id: string; destination: string; material_snapshot: { purchaseId: number; reason: string; vouchers: PurchaseBatchItem["vouchers"] } };
const escape = (text: string) => text.replace(/[&<>"']/g,char => ({ '&': '&amp;','<': '&lt;','>': '&gt;','"': '&quot;',"'": '&#39;' })[char]!);
function html(notice: Notice) {
  const { purchaseId,reason,vouchers } = notice.material_snapshot;
  const date = (value: string) => escape(value.split('-').reverse().join('/'));
  return `<h1>Atualização da compra #${purchaseId}</h1><p>Alteramos a data ou validade dos seus ingressos. Os valores pagos foram mantidos.</p>
    <p>Motivo: ${escape(reason)}</p><ul>${vouchers.map(v => `<li>Voucher #${v.id}: válido de ${date(v.nextFrom)} até ${date(v.nextUntil)}.</li>`).join('')}</ul>
    <p>Consulte os ingressos atualizados na sua conta no site. O uso continua sendo único, em dia de day use aberto dentro da validade.</p>`;
}

export async function listPurchaseBatchEmail(actor: CatalogActor): Promise<PurchaseBatchEmailHistory> {
  if (!actor.cpf || !/^\d{11}$/.test(actor.cpf)) throw new PurchaseBatchError("batch_forbidden","Sua sessão precisa identificar o operador.",403);
  const rows = (await getIngressoSistemaDbPool().query<{ id: string; purchase_ids: number[]; created_at: Date; summary: Omit<PurchaseBatchEmailSummary,"configured"> }>(`SELECT b.id,b.result->'applied' AS purchase_ids,b.created_at,
    jsonb_build_object('pending',COUNT(*) FILTER(WHERE e.status='pending'),'dispatching',COUNT(*) FILTER(WHERE e.status='dispatching'),
      'accepted',COUNT(*) FILTER(WHERE e.status='accepted'),'failed',COUNT(*) FILTER(WHERE e.status='failed'),'unknown',COUNT(*) FILTER(WHERE e.status='unknown')) AS summary
    FROM purchase_batches b JOIN purchase_batch_email e ON e.batch_id=b.id WHERE b.parque=$1 AND b.actor_cpf=$2
    GROUP BY b.id ORDER BY BOOL_OR(e.status IN ('pending','dispatching')) DESC,b.created_at DESC LIMIT 20`, [getOperationalParkId(),actor.cpf])).rows;
  return rows.map(row => ({ batchId: row.id,purchaseIds: row.purchase_ids,createdAt: row.created_at.toISOString(),summary: { configured: isSmtpConfigured(),...row.summary } }));
}

/** Claims commit before SMTP. A later call may claim pending notices, never an uncertain dispatch. */
export async function dispatchPurchaseBatchEmail(batchId: unknown, actor: CatalogActor): Promise<PurchaseBatchEmailSummary> {
  if (typeof batchId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(batchId)) return invalidPurchaseBatch();
  const pool = getIngressoSistemaDbPool(),client = await pool.connect(),park = getOperationalParkId();
  const configured = isSmtpConfigured();
  let notices: Notice[] = [];
  try {
    await client.query("BEGIN");
    const batch = (await client.query<{ actor_cpf: string }>("SELECT actor_cpf FROM purchase_batches WHERE id=$1 AND parque=$2 FOR UPDATE", [batchId,park])).rows[0];
    if (!batch || batch.actor_cpf !== actor.cpf) throw new PurchaseBatchError("batch_forbidden","Este lote não pertence ao operador e parque atuais.",403);
    await client.query(`UPDATE purchase_batch_email SET status='unknown',completed_at=clock_timestamp(),lease_expires_at=NULL
      WHERE batch_id=$1 AND status='dispatching' AND lease_expires_at<=clock_timestamp()`, [batchId]);
    if (configured) {
      notices = (await client.query<Notice>("SELECT id,destination,material_snapshot FROM purchase_batch_email WHERE batch_id=$1 AND status='pending' ORDER BY id LIMIT 5 FOR UPDATE", [batchId])).rows;
      if (notices.length) await client.query(`UPDATE purchase_batch_email SET status='dispatching',dispatch_started_at=clock_timestamp(),lease_expires_at=clock_timestamp()+interval '60 seconds'
        WHERE id=ANY($1::uuid[])`, [notices.map(n => n.id)]);
    }
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  await Promise.all(notices.map(async notice => {
    let status: "accepted" | "failed" | "unknown" = "unknown";
    try { status = await sendLegacyEmailOnce({ to: notice.destination,toName: null,subject: `Atualização da compra #${notice.material_snapshot.purchaseId}`,
      html: html(notice),messageId: `<purchase-update-${notice.id}@${park}.local>` }); } catch { /* The durable claim still prevents a second send. */ }
    await pool.query(`UPDATE purchase_batch_email SET status=$2,completed_at=clock_timestamp(),lease_expires_at=NULL WHERE id=$1 AND status='dispatching'`, [notice.id,status]);
  }));
  const counts = (await pool.query<Omit<PurchaseBatchEmailSummary,"configured">>(`SELECT
    (COUNT(*) FILTER(WHERE status='pending'))::int AS pending,(COUNT(*) FILTER(WHERE status='dispatching'))::int AS dispatching,
    (COUNT(*) FILTER(WHERE status='accepted'))::int AS accepted,(COUNT(*) FILTER(WHERE status='failed'))::int AS failed,
    (COUNT(*) FILTER(WHERE status='unknown'))::int AS unknown FROM purchase_batch_email WHERE batch_id=$1`, [batchId])).rows[0];
  return { configured,...counts };
}
