import {
  asOpsAgreementPurchaseReportError,
  getAgreementPurchaseReport,
} from "@/lib/ops-agreement-purchases";
import { runAuthorizedOpsRoute, runOpsRoute } from "@/lib/ops-route-utils";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return runAuthorizedOpsRoute(
    request,
    {
      requiredPermission: "ops.admin",
      painelPermissions: ["vis_conve", "vis_compra"],
    },
    () => {
      const url = new URL(request.url);

      return runOpsRoute(
        () =>
          getAgreementPurchaseReport({
            agreementName: url.searchParams.get("agreementName"),
            voucherNumber: url.searchParams.get("voucherNumber"),
            visitDateFrom: url.searchParams.get("visitDateFrom"),
            visitDateTo: url.searchParams.get("visitDateTo"),
            usedDateFrom: url.searchParams.get("usedDateFrom"),
            usedDateTo: url.searchParams.get("usedDateTo"),
            voucherType: url.searchParams.get("voucherType"),
            purchaseType: url.searchParams.get("purchaseType"),
            usedStatus: url.searchParams.get("usedStatus"),
            paymentStatus: url.searchParams.get("paymentStatus"),
            purchaseStatus: url.searchParams.get("purchaseStatus"),
            paymentMethodType: url.searchParams.get("paymentMethodType"),
          }),
        {
          mapError: asOpsAgreementPurchaseReportError,
          logTag: "ops-agreement-purchases-report-bff-failed",
        },
      );
    },
  );
}
