import {
  asOpsSchoolTripReportError,
  formatOpsSchoolTripReportCsv,
  getOpsSchoolTripReport,
} from "@/lib/ops-school-trip-report";
import { renderOpsSchoolTripReportPdfBuffer } from "@/lib/ops-school-trip-report-pdf";
import { readRouteParams, runAuthorizedOpsRoute } from "@/lib/ops-route-utils";
import { handleOpsTripSchoolReportRoute } from "@/lib/ops-trip-school-report-route";

export const runtime = "nodejs";

async function readParams(context: {
  params: Promise<{ schoolId: string; agendaId: string }>;
}) {
  return readRouteParams(context);
}

export async function GET(
  request: Request,
  context: { params: Promise<{ schoolId: string; agendaId: string }> },
) {
  return runAuthorizedOpsRoute(
    request,
    {
      requiredPermission: "ops.read",
      painelPermissions: ["vis_escola"],
    },
    () =>
      handleOpsTripSchoolReportRoute({
        request,
        loadReport: async (purchaseStatus) => {
          const { schoolId, agendaId } = await readParams(context);

          return getOpsSchoolTripReport({
            agendaId,
            schoolId,
            purchaseStatus,
          });
        },
        formatCsv: formatOpsSchoolTripReportCsv,
        renderPdf: renderOpsSchoolTripReportPdfBuffer,
        asError: asOpsSchoolTripReportError,
        logKey: "ops-admin-school-trip-report-bff-failed",
      }),
  );
}
