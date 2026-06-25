import {
  asOpsClientTripSchoolReportError,
  formatOpsClientTripSchoolReportCsv,
  getOpsClientTripSchoolReport,
} from "@/lib/ops-client-trip-school-report";
import { renderOpsClientTripSchoolReportPdfBuffer } from "@/lib/ops-client-trip-school-report-pdf";
import { runAuthorizedOpsRoute } from "@/lib/ops-route-utils";
import { handleOpsTripSchoolReportRoute } from "@/lib/ops-trip-school-report-route";

export const runtime = "nodejs";

async function readAgendaId(context: {
  params: Promise<{ agendaId: string }>;
}) {
  const { agendaId } = await context.params;
  return agendaId;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ agendaId: string }> },
) {
  return runAuthorizedOpsRoute(
    request,
    {
      requiredPermission: "ops.read",
      painelPermissions: ["vis_clientes", "vis_escola"],
    },
    () =>
      handleOpsTripSchoolReportRoute({
        request,
        loadReport: async () => {
          const url = new URL(request.url);

          return getOpsClientTripSchoolReport({
            agendaId: await readAgendaId(context),
            clientId: url.searchParams.get("clientId"),
            purchaseStatus: url.searchParams.get("purchaseStatus"),
          });
        },
        formatCsv: formatOpsClientTripSchoolReportCsv,
        renderPdf: renderOpsClientTripSchoolReportPdfBuffer,
        asError: asOpsClientTripSchoolReportError,
        logKey: "ops-admin-client-trip-school-report-bff-failed",
      }),
  );
}
