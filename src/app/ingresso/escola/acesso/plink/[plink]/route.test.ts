import { beforeEach, describe, expect, it, vi } from "vitest";

const getPublicSchoolTripReportByPermalink = vi.fn();
const renderOpsSchoolTripReportPdfBuffer = vi.fn();

vi.mock("@/lib/public-school-trip-report", () => ({
  getPublicSchoolTripReportByPermalink,
  asPublicSchoolTripReportError: (error: unknown) => error,
}));

vi.mock("@/lib/ops-school-trip-report-pdf", () => ({
  renderOpsSchoolTripReportPdfBuffer,
}));

describe("ingresso/escola/acesso/plink/[plink] route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("streams the public school report pdf by permalink", async () => {
    getPublicSchoolTripReportByPermalink.mockResolvedValue({
      trip: {
        code: "ABC123",
        date: "2026-05-20",
        schoolName: "ESCOLA TESTE",
      },
      filters: { purchaseStatus: "conc" },
      indicators: {},
      statusOptions: [],
      students: [],
      educators: [],
    });
    renderOpsSchoolTripReportPdfBuffer.mockResolvedValue(Buffer.from("%PDF-fake"));

    const { GET } = await import(
      "@/app/ingresso/escola/acesso/plink/[plink]/route"
    );
    const response = await GET(
      new Request("https://example.com/ingresso/escola/acesso/plink/abc123slug"),
      { params: Promise.resolve({ plink: "abc123slug" }) },
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(getPublicSchoolTripReportByPermalink).toHaveBeenCalledWith("abc123slug");
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(body).toContain("%PDF");
  });

  it("returns 404 when the permalink is not found", async () => {
    getPublicSchoolTripReportByPermalink.mockRejectedValue({
      code: "public_school_trip_report_not_found",
      message: "Passeio escolar publico nao encontrado.",
      status: 404,
    });

    const { GET } = await import(
      "@/app/ingresso/escola/acesso/plink/[plink]/route"
    );
    const response = await GET(
      new Request("https://example.com/ingresso/escola/acesso/plink/missing"),
      { params: Promise.resolve({ plink: "missing" }) },
    );
    const body = await response.text();

    expect(response.status).toBe(404);
    expect(body).toContain("Passeio escolar publico nao encontrado.");
  });
});
