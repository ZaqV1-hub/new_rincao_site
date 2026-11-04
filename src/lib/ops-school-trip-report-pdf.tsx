import type { OpsSchoolTripReport } from "@/lib/ops-school-trip-report";
import { renderOpsTripSchoolReportPdfBuffer, type TripReportAudience } from "@/lib/ops-trip-school-report-pdf-core";

export async function renderOpsSchoolTripReportPdfBuffer(
  report: OpsSchoolTripReport,
  audience: TripReportAudience = "internal",
) {
  return renderOpsTripSchoolReportPdfBuffer(
    report,
    report.trip.schoolName,
    audience,
  );
}
