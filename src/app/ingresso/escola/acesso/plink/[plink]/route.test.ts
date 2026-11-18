import { beforeEach, describe, expect, it, vi } from "vitest";

const getPublicSchoolTripReportByPermalink = vi.fn();
const renderOpsSchoolTripReportPdfBuffer = vi.fn();
const renderOpsClientTripSchoolReportPdfBuffer = vi.fn();

vi.mock("@/lib/public-school-trip-report", () => ({
  getPublicSchoolTripReportByPermalink,
  asPublicSchoolTripReportError: (error: unknown) => error,
}));

vi.mock("@/lib/ops-school-trip-report-pdf", () => ({
  renderOpsSchoolTripReportPdfBuffer,
}));

vi.mock("@/lib/ops-client-trip-school-report-pdf", () => ({
  renderOpsClientTripSchoolReportPdfBuffer,
}));

function reportResult(kind = "school") {
  return {
    kind,
    report: {
      trip: { code: "ABC123", date: "2026-05-20", schoolName: "ESCOLA TESTE" },
      filters: { purchaseStatus: "conc" },
      indicators: {},
      statusOptions: [],
      students: [],
      educators: [],
    },
  };
}

const context = { params: Promise.resolve({ plink: "abc123slug" }) };
const permalink = "https://example.com/ingresso/escola/acesso/plink/abc123slug";

describe("ingresso/escola/acesso/plink/[plink] route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("streams the public school report pdf by permalink", async () => {
    getPublicSchoolTripReportByPermalink.mockResolvedValue({
      kind: "school",
      report: {
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
      },
    });
    renderOpsSchoolTripReportPdfBuffer.mockResolvedValue(Buffer.from("%PDF-fake"));

    const { GET } = await import(
      "@/app/ingresso/escola/acesso/plink/[plink]/route"
    );
    const redirect = await GET(
      new Request("https://example.com/ingresso/escola/acesso/plink/abc123slug"),
      { params: Promise.resolve({ plink: "abc123slug" }) },
    );
    expect(redirect.status).toBe(307);
    expect(redirect.headers.get("cache-control")).toContain("no-store");
    const location = redirect.headers.get("location")!;
    expect(location).toMatch(/^\/ingresso\/escola\/acesso\/plink\/abc123slug\?atualizado=/);
    const response = await GET(new Request(new URL(location, permalink)), context);
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(getPublicSchoolTripReportByPermalink).toHaveBeenCalledWith("abc123slug");
    expect(renderOpsSchoolTripReportPdfBuffer).toHaveBeenCalledWith(
      expect.objectContaining({ filters: { purchaseStatus: "conc" } }),
      "school",
    );
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("content-disposition")).toContain(
      new URL(location, permalink).searchParams.get("atualizado")!,
    );
    expect(body).toContain("%PDF");
  });

  it("opens distinct files and reloads the current report on repeated mobile and desktop visits", async () => {
    const { GET } = await import("@/app/ingresso/escola/acesso/plink/[plink]/route");
    getPublicSchoolTripReportByPermalink.mockResolvedValue(reportResult("client"));
    renderOpsClientTripSchoolReportPdfBuffer
      .mockResolvedValueOnce(Buffer.from("%PDF-31"))
      .mockResolvedValueOnce(Buffer.from("%PDF-136"));
    const first = await GET(new Request(permalink, { headers: { "user-agent": "Android" } }), context);
    const second = await GET(new Request(permalink, { headers: { "user-agent": "Windows" } }), context);
    expect(first.headers.get("location")).not.toBe(second.headers.get("location"));
    const firstPdf = await GET(new Request(new URL(first.headers.get("location")!, permalink)), context);
    const secondPdf = await GET(new Request(new URL(second.headers.get("location")!, permalink)), context);
    expect(await firstPdf.text()).toBe("%PDF-31");
    expect(await secondPdf.text()).toBe("%PDF-136");
    expect(firstPdf.headers.get("content-disposition")).not.toBe(secondPdf.headers.get("content-disposition"));
    expect(renderOpsClientTripSchoolReportPdfBuffer).toHaveBeenCalledTimes(2);
    expect(getPublicSchoolTripReportByPermalink).toHaveBeenCalledTimes(4);
  });

  it("refreshes an old PDF address while keeping the existing permalink", async () => {
    const { GET } = await import("@/app/ingresso/escola/acesso/plink/[plink]/route");
    getPublicSchoolTripReportByPermalink.mockResolvedValue(reportResult());
    const oldVersion = `${Date.now() - 120_000}-12345678-1234-4123-8123-123456789abc`;
    const response = await GET(new Request(permalink + "?atualizado=" + oldVersion), context);
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).not.toContain(oldVersion);
    expect(response.headers.get("location")).toContain("/abc123slug?atualizado=");
    expect(renderOpsSchoolTripReportPdfBuffer).not.toHaveBeenCalled();
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
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(body).toContain("Passeio escolar publico nao encontrado.");
  });
});
