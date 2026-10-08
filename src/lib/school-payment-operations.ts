import type { PoolClient } from "pg";
import { getIngressoSistemaDbPool } from "@/lib/ingresso-db";
import { getSchoolPaymentHold } from "@/lib/school-payment-eligibility";

type QueryClient = Pick<PoolClient, "query">;
export class SchoolPaymentOperationError extends Error {
  constructor(public code: string, message: string, public status: number) { super(message); }
}
export async function readSchoolPaymentOperations(purchaseId: number) {
  const pool = getIngressoSistemaDbPool();
  if (!await getSchoolPaymentHold(pool, purchaseId)) return { hold: null, events: [] };
  const hold = await pool.query(`select order_id::text,checkout_session_id,payment_id,status,source,review_reference,
    review_revision,attempt_count,created_at,updated_at from commerce_school_payment_hold where order_id=$1`, [purchaseId]);
  const events = await pool.query(`select id::text,status,review_reference,operation,created_at
    from commerce_school_payment_hold_event where order_id=$1 order by id desc limit 100`, [purchaseId]);
  return { hold: hold.rows[0] ?? null, events: events.rows };
}

export async function applySchoolPaymentOperation(client: QueryClient, purchaseId: number,
  input: { action: "reopen_review" | "follow_up"; reason: string; expected_revision: number; expected_status: string },
  actor: { name: string | null; cpf: string | null }) {
  if (!actor.cpf || !input.reason.trim() || input.reason.trim().length > 1000 ||
      !Number.isInteger(input.expected_revision) || input.expected_revision < 0) {
    throw new SchoolPaymentOperationError("school_operation_invalid", "Informe uma justificativa e atualize o estado da retenção.", 400);
  }
  await client.query("select idcompra from compra where idcompra=$1 for update", [purchaseId]);
  const result = await client.query<{ status: string; review_reference: string | null; review_revision: number }>(
    "select status,review_reference,review_revision from commerce_school_payment_hold where order_id=$1 for update", [purchaseId]);
  const hold = result.rows[0];
  if (!hold) throw new SchoolPaymentOperationError("school_hold_not_found", "Retenção não encontrada.", 404);
  if (hold.review_revision !== input.expected_revision || hold.status !== input.expected_status) {
    throw new SchoolPaymentOperationError("school_hold_changed", "A retenção mudou. Atualize antes de agir.", 409);
  }
  if (hold.status === "released") throw new SchoolPaymentOperationError("school_hold_released", "Esta compra já foi liberada pela admissão.", 409);
  let status = hold.status;
  let reference = hold.review_reference;
  if (input.action === "reopen_review") {
    if (!["duplicate_confirmed", "review_expired"].includes(hold.status)) {
      throw new SchoolPaymentOperationError("school_review_reopen_not_allowed", "Este motivo exige acompanhamento do atendimento.", 409);
    }
    status = "review_required";
    reference = null;
    await client.query(`update commerce_school_payment_hold set status=$2,review_reference=null,
      review_revision=review_revision+1,next_attempt_at=current_timestamp,updated_at=current_timestamp where order_id=$1`, [purchaseId, status]);
  } else if (input.action !== "follow_up") {
    throw new SchoolPaymentOperationError("school_operation_invalid", "Ação inválida.", 400);
  }
  await client.query(`insert into commerce_school_payment_hold_event(order_id,status,review_reference,operation)
    values($1,$2,$3,$4::jsonb)`, [purchaseId, status, reference, JSON.stringify({ action: input.action,
      reason: input.reason.trim(), actor, previous_status: hold.status, previous_reference: hold.review_reference,
      previous_revision: hold.review_revision })]);
  return { status, review_revision: hold.review_revision + (input.action === "reopen_review" ? 1 : 0) };
}

export async function runSchoolPaymentOperation(purchaseId: number,
  input: Parameters<typeof applySchoolPaymentOperation>[2], actor: Parameters<typeof applySchoolPaymentOperation>[3]) {
  const client = await getIngressoSistemaDbPool().connect();
  try {
    await client.query("begin");
    const result = await applySchoolPaymentOperation(client, purchaseId, input, actor);
    await client.query("commit");
    return result;
  } catch (error) { await client.query("rollback").catch(() => undefined); throw error; }
  finally { client.release(); }
}
