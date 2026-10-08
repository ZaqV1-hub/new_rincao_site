import { schoolPaymentSchemaAvailable } from "@/lib/school-payment-eligibility";
import type { PaymentReconciliationRecord, QueryClient } from "@/lib/payment-reconciliation-contract";
import { schoolContractHash, schoolIdentityLockKey, siteSchoolAdmissionEnabled, type SiteSchoolContext } from "@/lib/school-commerce-contract";

type SchoolPayment = { context: SiteSchoolContext | null; session: string; origin: string | null };

export async function lockSiteSchoolPayment(client: QueryClient, purchaseId: number): Promise<SchoolPayment | null> {
  if (!siteSchoolAdmissionEnabled()) {
    if (!await schoolPaymentSchemaAvailable(client)) return null;
  }
  const result = await client.query(`select c.origem_checkout,c.checkout_session_id,c.checkout_school_site_context
    from compra c where c.idcompra=$1 and exists(select 1 from voucher v where v.idcompra=c.idcompra
      and v.tpvoucher='escol' and coalesce(v.tpparticipante,'')<>'educador')`, [purchaseId]);
  const row = result.rows[0];
  if (!row || row.origem_checkout !== "site") return null;
  const context = row.checkout_school_site_context as SiteSchoolContext | null;
  if (!context && !siteSchoolAdmissionEnabled()) return null;
  if (context?.quote?.school_purchase) {
    await client.query("select pg_advisory_xact_lock(hashtext($1))", [schoolIdentityLockKey(context.quote.school_purchase)]);
  }
  return { context, origin: row.origem_checkout, session: row.checkout_session_id || `site-school:${purchaseId}` };
}

export async function queueSiteSchoolPayment(client: QueryClient, record: PaymentReconciliationRecord, school: SchoolPayment | null) {
  if (!school) return;
  const current = await client.query("select origem_checkout,checkout_school_site_context from compra where idcompra=$1", [record.purchaseId]);
  if (current.rows[0]?.origem_checkout !== school.origin || schoolContractHash(current.rows[0]?.checkout_school_site_context) !== schoolContractHash(school.context)) {
    throw new Error("site_school_payment_context_changed");
  }
  const status = school.context ? "queued" : "context_required";
  const held = await client.query(`insert into commerce_school_payment_hold(order_id,checkout_session_id,payment_id,status,delivery_disposition,source,payment_payload)
    values ($1,$2,$3,$4,'deliver','site',$5)
    on conflict(order_id) do nothing returning order_id`, [record.purchaseId, school.session, record.gatewayPaymentId, status, record.xml]);
  if (held.rowCount) {
    await client.query("insert into commerce_school_payment_hold_event(order_id,status) values($1,$2)", [record.purchaseId, status]);
  } else {
    const prior = await client.query("select payment_id,source from commerce_school_payment_hold where order_id=$1", [record.purchaseId]);
    if (prior.rows[0]?.payment_id !== record.gatewayPaymentId || prior.rows[0]?.source !== "site") throw new Error("site_school_hold_payment_conflict");
  }
}
