import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticateOperationsRequest = vi.fn();
const authorizePainelApiAccess = vi.fn();
const getOpsSchoolTripReport = vi.fn();
const formatOpsSchoolTripReportCsv = vi.fn();
const renderOpsSchoolTripReportPdfBuffer = vi.fn();
const asOpsSchoolTripReportError = vi.fn();

vi.mock("@/lib/ops-auth", () => ({
  authenticateOperationsRequest,
}));

vi.mock("@/lib/painel-api-auth", () => ({
  authorizePainelApiAccess,
}));

vi.mock("@/lib/ops-school-trip-report", () => ({
  getOpsSchoolTripReport,
  formatOpsSchoolTripReportCsv,
  asOpsSchoolTripReportError,
}));

vi.mock("@/lib/ops-school-trip-report-pdf", () => ({
  renderOpsSchoolTripReportPdfBuffer,
}));

describe("ops/admin/schools/[schoolId]/trips/[agendaId]/report route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateOperationsRequest.mockReturnValue({ ok: true });
    authorizePainelApiAccess.mockResolvedValue({ ok: true, legacyResources: [] });
    asOpsSchoolTripReportError.mockImplementation((error: unknown) => error);
  });

  it("returns json by default", async () => {
    getOpsSchoolTripReport.mockResolvedValue({
      trip: { agendaId: 10, schoolId: 20, schoolName: "Colegio", code: "ABC123" },
      filters: { purchaseStatus: "" },
      statusOptions: [{ value: "", label: "Todos" }],
      indicators: {},
      students: [],
      educators: [],
    });

    const { GET } = await import(
      "@/app/api/ops/admin/schools/[schoolId]/trips/[agendaId]/report/route"
    );
    const response = await GET(
      new Request(
        "https://example.com/api/ops/admin/schools/20/trips/10/report",
      ),
      {
        params: Promise.resolve({ schoolId: "20", agendaId: "10" }),
      },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(getOpsSchoolTripReport).toHaveBeenCalledWith({
      agendaId: "10",
      schoolId: "20",
      purchaseStatus: null,
    });
    expect(body.ok).toBe(true);
  });

  it("streams csv when requested", async () => {
    getOpsSchoolTripReport.mockResolvedValue({
      trip: { agendaId: 10, schoolId: 20, schoolName: "Colegio", code: "ABC123" },
      filters: { purchaseStatus: "conc" },
      statusOptions: [{ value: "", label: "Todos" }],
      indicators: {},
      students: [],
      educators: [],
    });
    formatOpsSchoolTripReportCsv.mockReturnValue("codigo;escola\nABC123;Colegio\n");

    const { GET } = await import(
      "@/app/api/ops/admin/schools/[schoolId]/trips/[agendaId]/report/route"
    );
    const response = await GET(
      new Request(
        "https://example.com/api/ops/admin/schools/20/trips/10/report?purchaseStatus=conc&format=csv",
      ),
      {
        params: Promise.resolve({ schoolId: "20", agendaId: "10" }),
      },
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(formatOpsSchoolTripReportCsv).toHaveBeenCalled();
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(body).toContain("ABC123");
  });

  it("streams pdf when requested", async () => {
    getOpsSchoolTripReport.mockResolvedValue({
      trip: { agendaId: 10, schoolId: 20, schoolName: "Colegio", code: "ABC123" },
      filters: { purchaseStatus: "" },
      statusOptions: [{ value: "", label: "Todos" }],
      indicators: {},
      students: [],
      educators: [],
    });
    renderOpsSchoolTripReportPdfBuffer.mockResolvedValue(Buffer.from("%PDF-fake"));

    const { GET } = await import(
      "@/app/api/ops/admin/schools/[schoolId]/trips/[agendaId]/report/route"
    );
    const response = await GET(
      new Request(
        "https://example.com/api/ops/admin/schools/20/trips/10/report?format=pdf",
      ),
      {
        params: Promise.resolve({ schoolId: "20", agendaId: "10" }),
      },
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(renderOpsSchoolTripReportPdfBuffer).toHaveBeenCalled();
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(body).toContain("%PDF");
  });
});
