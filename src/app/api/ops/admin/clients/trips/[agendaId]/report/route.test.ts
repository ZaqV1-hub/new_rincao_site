import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticateOperationsRequest = vi.fn();
const authorizePainelApiAccess = vi.fn();
const getOpsClientTripSchoolReport = vi.fn();
const formatOpsClientTripSchoolReportCsv = vi.fn();
const renderOpsClientTripSchoolReportPdfBuffer = vi.fn();
const asOpsClientTripSchoolReportError = vi.fn();

vi.mock("@/lib/ops-auth", () => ({
  authenticateOperationsRequest,
}));

vi.mock("@/lib/painel-api-auth", () => ({
  authorizePainelApiAccess,
}));

vi.mock("@/lib/ops-client-trip-school-report", () => ({
  getOpsClientTripSchoolReport,
  formatOpsClientTripSchoolReportCsv,
  asOpsClientTripSchoolReportError,
}));

vi.mock("@/lib/ops-client-trip-school-report-pdf", () => ({
  renderOpsClientTripSchoolReportPdfBuffer,
}));

describe("ops/admin/clients/trips/[agendaId]/report route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateOperationsRequest.mockReturnValue({ ok: true });
    authorizePainelApiAccess.mockResolvedValue({ ok: true, legacyResources: [] });
    asOpsClientTripSchoolReportError.mockImplementation((error: unknown) => error);
  });

  it("returns json by default", async () => {
    getOpsClientTripSchoolReport.mockResolvedValue({
      trip: { agendaId: 10, clientId: 20, clientName: "Colegio", code: "ABC123" },
      filters: { purchaseStatus: "" },
      statusOptions: [{ value: "", label: "Todos" }],
      indicators: {},
      students: [],
      educators: [],
    });

    const { GET } = await import(
      "@/app/api/ops/admin/clients/trips/[agendaId]/report/route"
    );
    const response = await GET(
      new Request(
        "https://example.com/api/ops/admin/clients/trips/10/report?clientId=20",
      ),
      {
        params: Promise.resolve({ agendaId: "10" }),
      },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(getOpsClientTripSchoolReport).toHaveBeenCalledWith({
      agendaId: "10",
      clientId: "20",
      purchaseStatus: null,
    });
    expect(body.ok).toBe(true);
  });

  it("streams csv when requested", async () => {
    getOpsClientTripSchoolReport.mockResolvedValue({
      trip: { agendaId: 10, clientId: 20, clientName: "Colegio", code: "ABC123" },
      filters: { purchaseStatus: "conc" },
      statusOptions: [{ value: "", label: "Todos" }],
      indicators: {},
      students: [],
      educators: [],
    });
    formatOpsClientTripSchoolReportCsv.mockReturnValue("codigo;cliente\nABC123;Colegio\n");

    const { GET } = await import(
      "@/app/api/ops/admin/clients/trips/[agendaId]/report/route"
    );
    const response = await GET(
      new Request(
        "https://example.com/api/ops/admin/clients/trips/10/report?clientId=20&purchaseStatus=conc&format=csv",
      ),
      {
        params: Promise.resolve({ agendaId: "10" }),
      },
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(formatOpsClientTripSchoolReportCsv).toHaveBeenCalled();
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(body).toContain("ABC123");
  });

  it("streams pdf when requested", async () => {
    getOpsClientTripSchoolReport.mockResolvedValue({
      trip: { agendaId: 10, clientId: 20, clientName: "Colegio", code: "ABC123" },
      filters: { purchaseStatus: "" },
      statusOptions: [{ value: "", label: "Todos" }],
      indicators: {},
      students: [],
      educators: [],
    });
    renderOpsClientTripSchoolReportPdfBuffer.mockResolvedValue(
      Buffer.from("%PDF-fake"),
    );

    const { GET } = await import(
      "@/app/api/ops/admin/clients/trips/[agendaId]/report/route"
    );
    const response = await GET(
      new Request(
        "https://example.com/api/ops/admin/clients/trips/10/report?clientId=20&format=pdf",
      ),
      {
        params: Promise.resolve({ agendaId: "10" }),
      },
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(renderOpsClientTripSchoolReportPdfBuffer).toHaveBeenCalled();
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(body).toContain("%PDF");
  });
});
