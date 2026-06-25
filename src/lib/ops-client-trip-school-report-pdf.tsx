import type { OpsClientTripSchoolReport } from "@/lib/ops-client-trip-school-report";
import { renderOpsTripSchoolReportPdfBuffer } from "@/lib/ops-trip-school-report-pdf-core";

export async function renderOpsClientTripSchoolReportPdfBuffer(
  report: OpsClientTripSchoolReport,
) {
  return renderOpsTripSchoolReportPdfBuffer(
    report,
    report.trip.clientName,
  );
}
