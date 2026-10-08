import { getIngressoSistemaDbPool } from "@/lib/ingresso-db";
import { customerApiErrorResponse } from "@/lib/customer-api-route";
import { getSchoolPaymentHold } from "@/lib/school-payment-eligibility";

// Call after the owning customer and purchase have been authenticated.
export async function refuseHeldSchoolVoucher(purchaseId: number) {
  const hold = await getSchoolPaymentHold(getIngressoSistemaDbPool(), purchaseId);
  return hold && hold.status !== "released"
    ? customerApiErrorResponse("school_payment_held", "Pagamento contabilizado; ingresso retido para análise do atendimento.", 409)
    : null;
}
