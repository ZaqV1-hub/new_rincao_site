import { NextResponse } from "next/server";
import { renderOpsClientTripSchoolReportPdfBuffer } from "@/lib/ops-client-trip-school-report-pdf";
import { renderOpsSchoolTripReportPdfBuffer } from "@/lib/ops-school-trip-report-pdf";
import {
  asPublicSchoolTripReportError,
  getPublicSchoolTripReportByPermalink,
} from "@/lib/public-school-trip-report";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    plink: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { plink } = await context.params;
    const result = await getPublicSchoolTripReportByPermalink(plink);
    const report = result.report;
    let pdfBuffer: Awaited<ReturnType<typeof renderOpsSchoolTripReportPdfBuffer>>;

    if (result.kind === "client") {
      pdfBuffer = await renderOpsClientTripSchoolReportPdfBuffer(result.report);
    } else {
      pdfBuffer = await renderOpsSchoolTripReportPdfBuffer(result.report);
    }

    const filename = `passeio-escolar-${report.trip.code}-${report.trip.date}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `inline; filename="${filename}"`,
      },
    });
  } catch (error) {
    const publicError = asPublicSchoolTripReportError(error);

    return new NextResponse(publicError.message, {
      status: publicError.status,
      headers: {
        "content-type": "text/plain; charset=utf-8",
      },
    });
  }
}
