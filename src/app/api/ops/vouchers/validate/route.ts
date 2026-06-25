import {
  validatePurchaseVouchers,
  validateSchoolTripVouchers,
  validateSelectedVouchers,
  validateVoucherByNumber,
} from "@/lib/ops-voucher-validation";
import {
  invalidValidateVoucherResponse,
  readValidateVoucherPayload,
  runOpsVoucherOperationRoute,
} from "@/lib/ops-voucher-route";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return runOpsVoucherOperationRoute(request, {
    readContext: readValidateVoucherPayload,
    invalidResponse: invalidValidateVoucherResponse,
    logKey: "ops-voucher-validate-bff-failed",
    run: async (context) =>
      context.voucherNumber
        ? await validateVoucherByNumber(
            context.voucherNumber,
            context.confirm,
            context.actor,
          )
        : Number.isInteger(context.purchaseId) && context.purchaseId > 0
          ? await validatePurchaseVouchers(
              context.purchaseId,
              context.confirm,
              context.actor,
            )
          : Number.isInteger(context.schoolId) &&
              context.schoolId > 0 &&
              Number.isInteger(context.agendaId) &&
              context.agendaId > 0
            ? await validateSchoolTripVouchers(
                context.schoolId,
                context.agendaId,
                context.actor,
              )
            : context.voucherIds.length > 0
              ? await validateSelectedVouchers(context.voucherIds, context.actor)
              : null,
  });
}
