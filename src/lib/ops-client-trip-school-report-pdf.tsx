import type { OpsClientTripSchoolReport } from "@/lib/ops-client-trip-school-report";
import { renderOpsTripSchoolReportPdfBuffer, type TripReportAudience } from "@/lib/ops-trip-school-report-pdf-core";

export async function renderOpsClientTripSchoolReportPdfBuffer(
  report: OpsClientTripSchoolReport,
  audience: TripReportAudience = "internal",
) {
  return renderOpsTripSchoolReportPdfBuffer(
    report,
    report.trip.clientName,
    audience,
  );
}
