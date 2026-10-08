import { createHmac } from "node:crypto";
import type { PoolClient } from "pg";
import { SchoolPurchaseError } from "@/lib/school-purchase-input";
import { schoolContractHash, schoolIdentityLockKey, siteSchoolAdmissionEnabled, type SiteSchoolContext } from "@/lib/school-commerce-contract";

type Selection = { schoolId: number; agendaId: number; schoolName: string; visitDate: string; studentName: string;
  educationType: string; educationYear: string; classLetter: string; amount: number };
type QueryClient = Pick<PoolClient, "query">;

export async function admitSiteSchoolPurchase(client: QueryClient, cpf: string, selection: Selection): Promise<SiteSchoolContext | null> {
  if (!siteSchoolAdmissionEnabled()) return null;
  const school = { school_id: selection.schoolId, agenda_id: selection.agendaId, student_name: selection.studentName,
    education_type: selection.educationType, education_year: selection.educationYear, class_letter: selection.classLetter };
  await client.query("select pg_advisory_xact_lock(hashtext($1))", [schoolIdentityLockKey(school)]);
  const user = await client.query<{ nmusuario: string; email: string | null; celular: string | null; telefone: string | null }>(
    "select nmusuario,email,celular,telefone from usuario where cpf=$1", [cpf]);
  const buyerRow = user.rows[0];
  const phone = buyerRow?.celular || buyerRow?.telefone;
  if (!buyerRow?.nmusuario?.trim() || !phone?.trim()) {
    throw new SchoolPurchaseError("school_buyer_context_required", "Complete nome e telefone do pagador antes da compra.", 409);
  }
  const buyer = { name: buyerRow.nmusuario.trim(), cpf: cpf.replace(/\D/g, ""), phone: phone.trim(),
    ...(buyerRow.email ? { email: buyerRow.email } : {}) };
  const candidates = await client.query(`select c.idcompra::text as purchase_id,v.idvoucher::text as voucher_id
    from voucher v join compra c on c.idcompra=v.idcompra
    where v.idagenda=$1 and v.idescola=$2 and v.nomealuno=$3 and v.ensino_tipo=$4 and v.ensino_ano=$5 and v.turma_letra=$6
      and trim(lower(c.stcompra)) in ('conc','pago','paid') order by c.idcompra,v.idvoucher limit 101`,
    [selection.agendaId, selection.schoolId, selection.studentName, selection.educationType, selection.educationYear, selection.classLetter]);
  const tenantId = process.env.SCHOOL_COMMERCE_TENANT_ID?.trim();
  const baseUrl = process.env.SCHOOL_COMMERCE_TENANT_API_URL?.trim();
  const secret = process.env.SCHOOL_COMMERCE_HMAC_SECRET;
  if (!tenantId || !baseUrl || !secret) throw new SchoolPurchaseError("school_admission_unconfigured", "A compra escolar aguarda configuração do atendimento.", 503);
  const input = { tenant_id: tenantId, buyer, product_type: "school_trip", currency: "BRL",
    external_reference: "site-school-quote:" + schoolContractHash({ selection, buyer, candidates: candidates.rows }),
    metadata: { school_name: selection.schoolName },
    extensions: { school_purchase: { school_id: selection.schoolId, student_name: selection.studentName,
      education_type: selection.educationType, education_year: selection.educationYear, class_letter: selection.classLetter,
      visit_date: selection.visitDate, declared_amount: selection.amount } },
    items: [{ sku: `school:${selection.schoolId}`, title: "Passeio escolar", quantity: 1, visit_date: selection.visitDate, ticket_type: "escola" }] };
  const body = JSON.stringify(input);
  const timestamp = new Date().toISOString();
  let response: Response;
  try {
    response = await fetch(new URL("/quote", baseUrl), { method: "POST", redirect: "error", signal: AbortSignal.timeout(10000),
      headers: { "Content-Type": "application/json", "x-lumi-key-id": `lumi:${tenantId}`, "x-lumi-timestamp": timestamp,
        "x-lumi-signature": createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex") }, body });
  } catch { throw new SchoolPurchaseError("school_admission_unavailable", "A revisão escolar está indisponível. Tente novamente mais tarde.", 503); }
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.ok !== true) {
    const duplicate = result?.reason === "school_duplicate_confirmed";
    throw new SchoolPurchaseError(duplicate ? "school_duplicate_confirmed" : "school_review_required",
      duplicate ? "A revisão confirmou uma compra duplicada. Procure o atendimento." : "A compra aguarda revisão do atendimento. Tente novamente após a decisão.", response.status === 409 ? 409 : 503);
  }
  const quote = result.quote as SiteSchoolContext["quote"] | undefined;
  const snapshot = quote?.school_purchase;
  if (!snapshot || snapshot.schema_version !== "commerce_school_snapshot_v1" ||
      Object.entries(school).some(([key, value]) => snapshot[key as keyof typeof school] !== value) ||
      snapshot.school_name !== selection.schoolName || !snapshot.school_address?.trim() ||
      !snapshot.education_type_label?.trim() || !snapshot.education_year_label?.trim() ||
      snapshot.visit_date !== selection.visitDate || snapshot.declared_amount !== selection.amount || quote?.totalAmount !== selection.amount ||
      snapshot.class_display !== `${snapshot.education_type_label} - ${snapshot.education_year_label} - ${snapshot.class_letter}` ||
      !Array.isArray(quote.items) || quote.items.length !== 1) {
    throw new SchoolPurchaseError("school_quote_context_changed", "Os dados oficiais mudaram. Selecione novamente o passeio e a turma.", 409);
  }
  return { schema_version: "site_school_context_v1", tenant_id: tenantId, buyer, quote };
}

export async function bindSiteSchoolPurchase(client: QueryClient, purchaseId: number, context: SiteSchoolContext | null) {
  if (!context) return;
  const binding = schoolContractHash({ school_purchase: context.quote.school_purchase, buyer: { name: context.buyer.name, cpf: context.buyer.cpf } });
  try {
    const review = context.quote.school_review?.reference;
    if (review) {
      await client.query(`insert into commerce_school_review_claim(review_reference,order_id) values($1,$2)
        on conflict(review_reference) do nothing`, [review, purchaseId]);
      const claim = await client.query<{ order_id: string }>("select order_id::text from commerce_school_review_claim where review_reference=$1", [review]);
      if (claim.rows[0]?.order_id !== String(purchaseId)) throw new SchoolPurchaseError("school_review_already_used", "Esta revisão já foi utilizada em outra compra. Procure o atendimento.", 409);
    }
    await client.query(`update compra set checkout_session_id=$2,checkout_school_site_context=$3::jsonb,
      checkout_school_binding_hash=$4,checkout_school_review_id=$5 where idcompra=$1`,
      [purchaseId, `site-school:${purchaseId}`, JSON.stringify(context), binding, context.quote.school_review?.reference ?? null]);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "23505") {
      throw new SchoolPurchaseError("school_review_already_used", "Esta revisão já foi utilizada em outra compra. Procure o atendimento.", 409);
    }
    throw error;
  }
}
