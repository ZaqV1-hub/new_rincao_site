import { createHash, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { getIngressoSistemaDbPool } from "@/lib/ingresso-db";
import { getOperationalParkId } from "@/lib/operational-day-contract";
import type { CatalogActor } from "@/lib/painel-operational-catalog";
import { siteSchoolAdmissionEnabled } from "@/lib/school-commerce-contract";
import { validateWhatsappPhoneForEnvironment } from "@/lib/ticket-service-config";
import { sendPurchaseTicketsWhatsApp } from "@/lib/ticket-service-whatsapp";
import type { TicketWhatsappSendResult } from "@/lib/ticket-service-contract";
import { registerOpsAuditLog } from "@/lib/ops-audit-log";

export type OperationalVoucherWhatsappStatus = "pending" | "dispatching" | "accepted" | "queued" | "failed" | "unknown";
export type OperationalVoucherWhatsappResult = {
  requestId: string; status: OperationalVoucherWhatsappStatus; destinationMasked: string; voucherIds: number[]; message: string;
};
export type OperationalVoucherWhatsappInput = {
  voucherIds: number[]; phoneNumber: string; destinationConfirmed: true; idempotencyKey: string;
};
export class OperationalVoucherWhatsappError extends Error {
  constructor(readonly code: string, message: string, readonly status = 409) { super(message); this.name = "OperationalVoucherWhatsappError"; }
}
function invalid(): never { throw new OperationalVoucherWhatsappError("whatsapp_invalid_input", "Confirme o destino e informe uma seleção e chave válidas.", 400); }
export function normalizeOperationalVoucherWhatsapp(value: unknown): OperationalVoucherWhatsappInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid();
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some(key => !["voucherIds", "phoneNumber", "destinationConfirmed", "idempotencyKey"].includes(key)) ||
    input.destinationConfirmed !== true || !Array.isArray(input.voucherIds) || input.voucherIds.length < 1 || input.voucherIds.length > 1000 ||
    input.voucherIds.some(id => typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0) ||
    new Set(input.voucherIds).size !== input.voucherIds.length || typeof input.phoneNumber !== "string" || input.phoneNumber.length > 40 ||
    !/^[+\d\s().-]+$/.test(input.phoneNumber) || typeof input.idempotencyKey !== "string" || !/^[A-Za-z0-9:_-]{1,100}$/.test(input.idempotencyKey)) return invalid();
  const phoneNumber = input.phoneNumber.replace(/\D/g, "");
  if (!/^\d{11,15}$/.test(phoneNumber)) return invalid();
  return { voucherIds: [...input.voucherIds].sort((a, b) => a - b), phoneNumber, destinationConfirmed: true, idempotencyKey: input.idempotencyKey };
}
type RequestRow = {
  request_id: string; request_hash: string; destination: string; voucher_ids: (string | number)[]; status: OperationalVoucherWhatsappStatus; actor_cpf: string;
};
const messages: Record<OperationalVoucherWhatsappStatus, string> = {
  pending: "Solicitação registrada; ainda não despachada.",
  dispatching: "Solicitação em processamento. Consulte esta mesma tentativa; não faça novo envio.",
  accepted: "Solicitação aceita pelo serviço. A entrega ao destinatário não foi confirmada.",
  queued: "Solicitação enfileirada pelo serviço. A entrega ao destinatário não foi confirmada.",
  failed: "Solicitação não enviada. Confira os dados antes de autorizar uma nova solicitação.",
  unknown: "O resultado do envio é desconhecido. Não repita o envio sem conferência operacional.",
};
function result(row: RequestRow): OperationalVoucherWhatsappResult {
  return { requestId: row.request_id, status: row.status, destinationMasked: `••••••${row.destination.slice(-4)}`,
    voucherIds: row.voucher_ids.map(Number), message: messages[row.status] };
}
function configured() {
  const address = process.env.TICKETS_API_BASE_URL?.trim() || process.env.INGRESSO_TICKET_API_BASE_URL?.trim();
  if (!address) return false; // The shared transport's implicit production fallback is not authorization to dispatch.
  try { const url = new URL(address); return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password && !url.search && !url.hash; }
  catch { return false; }
}
type VoucherRow = { idvoucher: string | number; idcompra: string | number; parque_operacional: string | null; stusado: string | null;
  idagenda: number | null; dtinicio_validade: string | null; dtvalidade: string | null; stvoucher: string | null; vlunicompra: string | null };

async function preflight(client: PoolClient, purchaseId: number, voucherIds: number[], park: string) {
  // Separate statements ensure holds are read freshly after a concurrent parent writer releases its lock.
  const purchase = (await client.query<{ stcompra: string | null; checkout_school_site_context: unknown }>(
    "SELECT stcompra,to_jsonb(compra)->'checkout_school_site_context' AS checkout_school_site_context FROM compra WHERE idcompra=$1 FOR UPDATE", [purchaseId])).rows[0];
  if (!purchase) throw new OperationalVoucherWhatsappError("purchase_not_found", "Compra não encontrada.", 404);
  if (purchase.stcompra?.trim() !== "conc") throw new OperationalVoucherWhatsappError("purchase_not_confirmed", "A compra precisa estar confirmada para solicitar o envio.");
  const vouchers = (await client.query<VoucherRow>(`SELECT idvoucher,idcompra,parque_operacional,stusado,idagenda,
    dtinicio_validade::text,dtvalidade::text,stvoucher,vlunicompra::text FROM voucher
    WHERE idcompra=$1 AND idvoucher=ANY($2::bigint[]) ORDER BY idvoucher FOR UPDATE`, [purchaseId, voucherIds])).rows;
  if (vouchers.length !== voucherIds.length || vouchers.some(v => v.parque_operacional !== null && v.parque_operacional !== park)) {
    throw new OperationalVoucherWhatsappError("voucher_selection_unavailable", "A seleção não está disponível nesta compra e parque.", 404);
  }
  if (vouchers.some(v => !["n", "s"].includes(v.stusado?.trim() ?? ""))) {
    throw new OperationalVoucherWhatsappError("voucher_selection_unavailable", "A seleção contém voucher inválido ou indisponível.");
  }
  const capacity = (await client.query<{ delivery_hold: boolean }>("SELECT delivery_hold FROM online_capacity_reservations WHERE idcompra=$1", [purchaseId])).rows[0];
  if (capacity?.delivery_hold) throw new OperationalVoucherWhatsappError("voucher_delivery_held", "O envio está retido para conferência pelo atendimento.");
  const table = (await client.query<{ available: string | null }>("SELECT to_regclass('commerce_school_payment_hold')::text AS available")).rows[0]?.available;
  if (!table && (purchase.checkout_school_site_context != null || siteSchoolAdmissionEnabled())) {
    throw new OperationalVoucherWhatsappError("voucher_delivery_unavailable", "Não foi possível conferir a liberação do envio.", 503);
  }
  if (table) {
    const hold = (await client.query<{ status: string; source: string }>("SELECT status,source FROM commerce_school_payment_hold WHERE order_id=$1", [purchaseId])).rows[0];
    if ((hold && hold.status !== "released") || (!hold && purchase.checkout_school_site_context != null)) {
      throw new OperationalVoucherWhatsappError("voucher_delivery_held", "O envio está retido para conferência pelo atendimento.");
    }
    if (hold?.source === "site") {
      const pending = await client.query("SELECT idvoucher FROM voucher WHERE idcompra=$1 AND COALESCE(voucherenviado,'n')<>'s' AND stusado NOT IN ('s','inv') LIMIT 1", [purchaseId]);
      if (pending.rowCount) throw new OperationalVoucherWhatsappError("voucher_delivery_held", "A entrega inicial desta compra ainda está pendente.");
    }
  }
  return { purchaseStatus: purchase.stcompra, vouchers };
}

async function expireDispatch(client: Pick<PoolClient, "query">, park: string, key: string) {
  await client.query(`UPDATE voucher_notification_requests SET status='unknown',failure_code='dispatch_expired',
    completed_at=clock_timestamp(),updated_at=clock_timestamp(),lease_expires_at=NULL
    WHERE parque=$1 AND idempotency_key=$2 AND status='dispatching' AND lease_expires_at<=clock_timestamp()`, [park, key]);
}

const safeSkipped = new Set(["invalid_phone_number", "phone_not_allowed_for_testing", "purchase_not_confirmed", "no_selected_vouchers", "ticket_service_not_configured", "ticket_auth_failed"]);
async function dispatch(purchaseId: number, input: OperationalVoucherWhatsappInput): Promise<{ status: OperationalVoucherWhatsappStatus; failure: string | null }> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    // The shared helper has no AbortSignal. Timeout means unknown, even if its request completes later.
    const sending = sendPurchaseTicketsWhatsApp(purchaseId, input.voucherIds, input.phoneNumber);
    const timeout = new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), 25_000); });
    const outcome: TicketWhatsappSendResult | null = await Promise.race([sending, timeout]);
    if (!outcome) return { status: "unknown", failure: "dispatch_timeout" };
    if (outcome.status === "skipped") return safeSkipped.has(outcome.skippedReason ?? "")
      ? { status: "failed", failure: "dispatch_declined_before_send" } : { status: "unknown", failure: "dispatch_uncertain" };
    if (outcome.status !== "sent" || outcome.purchaseId !== purchaseId || !Array.isArray(outcome.sentVoucherIds) ||
      outcome.sentVoucherIds.length !== input.voucherIds.length || [...outcome.sentVoucherIds].sort((a,b) => a-b).some((id,index) => id !== input.voucherIds[index])) {
      return { status: "unknown", failure: "dispatch_selection_mismatch" };
    }
    return { status: outcome.deliveryStatus === "queued" || outcome.upstreamStatus === 202 ? "queued" : "accepted", failure: null };
  } catch {
    // Upstream 500/network errors can follow partial delivery. Never log an error containing the destination/payload.
    return { status: "unknown", failure: "dispatch_uncertain" };
  } finally { if (timer) clearTimeout(timer); }
}

export async function sendOperationalVoucherWhatsapp(purchaseId: number, value: unknown, actor: CatalogActor): Promise<OperationalVoucherWhatsappResult> {
  if (!Number.isSafeInteger(purchaseId) || purchaseId <= 0) return invalid();
  const input = normalizeOperationalVoucherWhatsapp(value);
  const actorCpf = String(actor.cpf ?? "").replace(/\D/g, "");
  if (!/^\d{11}$/.test(actorCpf)) throw new OperationalVoucherWhatsappError("whatsapp_actor_unavailable", "Sua sessão não identifica o operador desta solicitação.", 403);
  const park = getOperationalParkId();
  const hash = createHash("sha256").update(JSON.stringify({ park, purchaseId, ...input })).digest("hex");
  const pool = getIngressoSistemaDbPool();
  const client = await pool.connect();
  let claimed: RequestRow;
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`voucher-whatsapp:${park}:${input.idempotencyKey}`]);
    const existing = (await client.query<RequestRow>("SELECT * FROM voucher_notification_requests WHERE parque=$1 AND idempotency_key=$2 FOR UPDATE", [park,input.idempotencyKey])).rows[0];
    if (existing) {
      if (existing.actor_cpf !== actorCpf) throw new OperationalVoucherWhatsappError("whatsapp_request_forbidden", "Esta solicitação pertence a outro operador.", 403);
      if (existing.request_hash !== hash) throw new OperationalVoucherWhatsappError("whatsapp_idempotency_conflict", "Esta chave já pertence a outra solicitação.");
      await expireDispatch(client,park,input.idempotencyKey);
      const current = (await client.query<RequestRow>("SELECT * FROM voucher_notification_requests WHERE request_id=$1", [existing.request_id])).rows[0];
      await client.query("COMMIT");
      return result(current);
    }
    if (!configured()) throw new OperationalVoucherWhatsappError("whatsapp_not_configured", "O envio de WhatsApp não está configurado neste ambiente.", 503);
    if (!validateWhatsappPhoneForEnvironment(input.phoneNumber)) throw new OperationalVoucherWhatsappError("whatsapp_invalid_input", "O destino não está autorizado neste ambiente.", 400);
    const snapshot = await preflight(client,purchaseId,input.voucherIds,park);
    claimed = (await client.query<RequestRow>(`INSERT INTO voucher_notification_requests
      (request_id,parque,idempotency_key,request_hash,purchase_id,voucher_ids,destination,destination_confirmed,actor_name,actor_cpf,material_snapshot,status,dispatch_started_at,lease_expires_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,true,$8,$9,$10::jsonb,'dispatching',clock_timestamp(),clock_timestamp()+INTERVAL '60 seconds') RETURNING *`,
    [randomUUID(),park,input.idempotencyKey,hash,purchaseId,input.voucherIds,input.phoneNumber,actor.name,actorCpf,JSON.stringify(snapshot)])).rows[0];
    await registerOpsAuditLog(client, {
      origem: "voucher", acao: "whatsapp_request", compraId: purchaseId,
      descricao: "Solicitação de envio de vouchers por WhatsApp registrada.", motivo: "Destino conferido pelo operador",
      usuarioNome: actor.name,
      detalhes: { requestId: claimed.request_id, voucherIds: input.voucherIds, destinationMasked: result(claimed).destinationMasked },
    }, "postgres");
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally { client.release(); }

  const outcome = await dispatch(purchaseId,input);
  // No retry after a lost result write: the durable claim will expire to unknown on consultation.
  const saved = (await pool.query<RequestRow>(`UPDATE voucher_notification_requests SET
    status=CASE WHEN lease_expires_at<=clock_timestamp() THEN 'unknown' ELSE $2 END,
    failure_code=CASE WHEN lease_expires_at<=clock_timestamp() THEN 'dispatch_expired' ELSE $3 END,
    completed_at=clock_timestamp(),updated_at=clock_timestamp(),lease_expires_at=NULL
    WHERE request_id=$1 AND status='dispatching' RETURNING *`, [claimed.request_id,outcome.status,outcome.failure])).rows[0];
  if (saved) return result(saved);
  const current = (await pool.query<RequestRow>("SELECT * FROM voucher_notification_requests WHERE request_id=$1", [claimed.request_id])).rows[0];
  return result(current);
}
