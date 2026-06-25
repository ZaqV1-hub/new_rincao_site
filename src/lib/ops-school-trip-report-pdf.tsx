import type { OpsSchoolTripReport } from "@/lib/ops-school-trip-report";
import { renderOpsTripSchoolReportPdfBuffer } from "@/lib/ops-trip-school-report-pdf-core";

export async function renderOpsSchoolTripReportPdfBuffer(
  report: OpsSchoolTripReport,
) {
  return renderOpsTripSchoolReportPdfBuffer(
    report,
    report.trip.schoolName,
  );
}
