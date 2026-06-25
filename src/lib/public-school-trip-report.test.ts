import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPublicSchoolTripReportByPermalink } from "@/lib/public-school-trip-report";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  getOpsSchoolTripReport: vi.fn(),
}));

vi.mock("@/lib/ingresso-db", () => ({
  getIngressoDbPool: () => ({
    query: mocks.query,
  }),
}));

vi.mock("@/lib/ops-school-trip-report", () => ({
  getOpsSchoolTripReport: mocks.getOpsSchoolTripReport,
}));

describe("public-school-trip-report", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads the public school trip report from a legacy permalink", async () => {
    mocks.query.mockResolvedValue({
      rows: [{ idescola: 464, idagenda: 2306 }],
    });
    mocks.getOpsSchoolTripReport.mockResolvedValue({
      trip: {
        agendaId: 2306,
        schoolId: 464,
        schoolName: "ESCOLA TESTE",
        code: "ABC123",
        date: "2026-05-20",
      },
      filters: { purchaseStatus: "conc" },
      indicators: { totalCount: 2 },
      statusOptions: [],
      students: [],
      educators: [],
    });

    await expect(
      getPublicSchoolTripReportByPermalink("abc123slug"),
    ).resolves.toMatchObject({
      trip: {
        agendaId: 2306,
        schoolId: 464,
        schoolName: "ESCOLA TESTE",
      },
      filters: {
        purchaseStatus: "conc",
      },
    });
    expect(mocks.getOpsSchoolTripReport).toHaveBeenCalledWith({
      agendaId: 2306,
      schoolId: 464,
      purchaseStatus: "conc",
    });
  });

  it("returns not found when the permalink does not map to an open school trip", async () => {
    mocks.query.mockResolvedValue({
      rows: [],
    });

    await expect(
      getPublicSchoolTripReportByPermalink("missing"),
    ).rejects.toMatchObject({
      code: "public_school_trip_report_not_found",
      status: 404,
    });
    expect(mocks.getOpsSchoolTripReport).not.toHaveBeenCalled();
  });
});
