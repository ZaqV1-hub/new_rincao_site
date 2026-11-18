import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { renderOpsClientTripSchoolReportPdfBuffer } from "@/lib/ops-client-trip-school-report-pdf";
import { renderOpsSchoolTripReportPdfBuffer } from "@/lib/ops-school-trip-report-pdf";
import {
  asPublicSchoolTripReportError,
  getPublicSchoolTripReportByPermalink,
} from "@/lib/public-school-trip-report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const reportHeaders = {
  "cache-control": "private, no-store, no-cache, max-age=0, must-revalidate",
  "pragma": "no-cache",
  "expires": "0",
  "referrer-policy": "no-referrer",
};

type RouteContext = {
  params: Promise<{
    plink: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const { plink } = await context.params;
    const result = await getPublicSchoolTripReportByPermalink(plink);
    const report = result.report;
    const url = new URL(request.url);
    const version = url.searchParams.get("atualizado") ?? "";
    const match = /^(\d{13})-([\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12})$/.exec(version);
    const age = match ? Date.now() - Number(match[1]) : Number.NaN;

    // Mobile PDF viewers can reuse a downloaded file even with no-store.
    // Keep the shared permalink, but open each report with a fresh URL and name.
    if (!Number.isFinite(age) || age < 0 || age > 60_000) {
      url.searchParams.set("atualizado", `${Date.now()}-${randomUUID()}`);
      return new NextResponse(null, {
        status: 307,
        headers: {
          ...reportHeaders,
          location: `${url.pathname}${url.search}`,
        },
      });
    }

    let pdfBuffer: Awaited<ReturnType<typeof renderOpsSchoolTripReportPdfBuffer>>;

    if (result.kind === "client") {
      pdfBuffer = await renderOpsClientTripSchoolReportPdfBuffer(result.report, "school");
    } else {
      pdfBuffer = await renderOpsSchoolTripReportPdfBuffer(result.report, "school");
    }

    const filename = `passeio-escolar-${report.trip.code}-${report.trip.date}-${version}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        ...reportHeaders,
        "content-type": "application/pdf",
        "content-disposition": `inline; filename="${filename}"`,
      },
    });
  } catch (error) {
    const publicError = asPublicSchoolTripReportError(error);

    return new NextResponse(publicError.message, {
      status: publicError.status,
      headers: {
        ...reportHeaders,
        "content-type": "text/plain; charset=utf-8",
      },
    });
  }
}
