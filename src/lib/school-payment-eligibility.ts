import type { PoolClient } from "pg";
import { siteSchoolAdmissionEnabled } from "@/lib/school-commerce-contract";

type QueryClient = Pick<PoolClient, "query">;
export async function schoolPaymentSchemaAvailable(client: QueryClient) {
  const table = await client.query<{ regclass: string | null }>("select to_regclass('public.commerce_school_payment_hold')::text as regclass");
  if (!table.rows[0]?.regclass) {
    if (siteSchoolAdmissionEnabled()) throw new Error("school_admission_schema_unavailable");
    return false;
  }
  return true;
}

export async function getSchoolPaymentHold(client: QueryClient, purchaseId: number) {
  if (!await schoolPaymentSchemaAvailable(client)) return null;
  const result = await client.query<{ status: string; source: string }>(
    "select status,source from commerce_school_payment_hold where order_id=$1", [purchaseId]);
  if (result.rows[0]) return result.rows[0];
  {
    const managed = await client.query(`select idcompra from compra where idcompra=$1
      and checkout_school_site_context is not null and trim(stcompra)='conc'`, [purchaseId]);
    if (managed.rowCount) return { status: "admission_missing", source: "site" };
  }
  return null;
}

export async function schoolTicketDeliveryAllowed(client: QueryClient, purchaseId: number) {
  const hold = await getSchoolPaymentHold(client, purchaseId);
  if (!hold) return true;
  if (hold.status !== "released") return false;
  if (hold.source !== "site") return true;
  // The tenant outbox owns initial delivery; explicit re-send remains available once it has sent all vouchers.
  const pending = await client.query(`select idvoucher from voucher where idcompra=$1
    and coalesce(voucherenviado,'n')<>'s' and stusado not in ('s','inv') limit 1`, [purchaseId]);
  return pending.rowCount === 0;
}
