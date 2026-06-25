import {
  unvalidatePurchaseVouchers,
  unvalidateSelectedVouchers,
} from "@/lib/ops-voucher-validation";
import {
  invalidUnvalidateVoucherResponse,
  runOpsVoucherOperationRoute,
  readVoucherOperationPayload,
} from "@/lib/ops-voucher-route";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return runOpsVoucherOperationRoute(request, {
    readContext: readVoucherOperationPayload,
    invalidResponse: invalidUnvalidateVoucherResponse,
    logKey: "ops-voucher-unvalidate-bff-failed",
    run: async (context) =>
      context.voucherIds.length === 0 &&
      (!Number.isInteger(context.purchaseId) || context.purchaseId <= 0)
        ? null
        : Number.isInteger(context.purchaseId) && context.purchaseId > 0
          ? await unvalidatePurchaseVouchers(context.purchaseId, context.actor)
          : await unvalidateSelectedVouchers(context.voucherIds, context.actor),
  });
}
