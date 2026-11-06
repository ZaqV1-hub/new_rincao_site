import {
  createCsvFileResponse,
  createInlinePdfResponse,
  opsErrorResponse,
  opsOkResponse,
} from "@/lib/ops-route-utils";

type TripReportLike = {
  trip: {
    code: string;
    date: string;
  };
};

type OperationError = {
  code: string;
  message: string;
  status: number;
};

export async function handleOpsTripSchoolReportRoute<TReport extends TripReportLike>({
  request,
  loadReport,
  formatCsv,
  renderPdf,
  asError,
  logKey,
}: {
  request: Request;
  loadReport: (purchaseStatus: string | null) => Promise<TReport>;
  formatCsv: (report: TReport) => string;
  renderPdf: (report: TReport) => Promise<Buffer>;
  asError: (error: unknown) => OperationError;
  logKey: string;
}) {
  const url = new URL(request.url);

  try {
    const format = url.searchParams.get("format");
    const data = await loadReport(format === "pdf" ? "conc" : url.searchParams.get("purchaseStatus"));

    if (format === "csv") {
      const filename = `passeio-escolar-${data.trip.code}-${data.trip.date}.csv`;
      return createCsvFileResponse(filename, formatCsv(data));
    }

    if (format === "pdf") {
      const filename = `passeio-escolar-${data.trip.code}-${data.trip.date}.pdf`;
      const pdfBuffer = await renderPdf(data);

      const response = createInlinePdfResponse(filename, pdfBuffer);
      response.headers.set("cache-control", "private, no-store");
      return response;
    }

    return opsOkResponse(data);
  } catch (error) {
    const operationError = asError(error);

    console.error(logKey, error);

    return opsErrorResponse(
      operationError.code,
      operationError.message,
      operationError.status,
    );
  }
}
