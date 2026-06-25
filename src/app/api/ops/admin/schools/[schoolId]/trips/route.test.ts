import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticateOperationsRequest = vi.fn();
const authorizePainelApiAccess = vi.fn();
const getOpsSchoolTripsScreenData = vi.fn();
const createOpsSchoolTripDate = vi.fn();
const asOpsSchoolTripsError = vi.fn();

vi.mock("@/lib/ops-auth", () => ({
  authenticateOperationsRequest,
}));

vi.mock("@/lib/painel-api-auth", () => ({
  authorizePainelApiAccess,
}));

vi.mock("@/lib/ops-school-trips", () => ({
  getOpsSchoolTripsScreenData,
  createOpsSchoolTripDate,
  asOpsSchoolTripsError,
}));

describe("ops/admin/schools/[schoolId]/trips route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateOperationsRequest.mockReturnValue({ ok: true });
    authorizePainelApiAccess.mockResolvedValue({ ok: true, legacyResources: [] });
    asOpsSchoolTripsError.mockImplementation((error: unknown) => error);
  });

  it("loads school trip dates", async () => {
    getOpsSchoolTripsScreenData.mockResolvedValue({
      search: { query: "" },
      selectedSchool: {
        schoolId: 12,
        name: "Escola Rincao",
        status: "ati",
        trips: [],
      },
    });

    const { GET } = await import(
      "@/app/api/ops/admin/schools/[schoolId]/trips/route"
    );
    const response = await GET(
      new Request("https://example.com/api/ops/admin/schools/12/trips"),
      {
        params: Promise.resolve({ schoolId: "12" }),
      },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(getOpsSchoolTripsScreenData).toHaveBeenCalledWith({
      schoolId: "12",
    });
    expect(body.ok).toBe(true);
  });

  it("creates a trip date", async () => {
    createOpsSchoolTripDate.mockResolvedValue({
      schoolId: 12,
      agendaId: 77,
      auditLogId: 701,
      message: "Data de passeio vinculada com sucesso.",
    });

    const { POST } = await import(
      "@/app/api/ops/admin/schools/[schoolId]/trips/route"
    );
    const response = await POST(
      new Request("https://example.com/api/ops/admin/schools/12/trips", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          visitDate: "15/06/2026",
        }),
      }),
      {
        params: Promise.resolve({ schoolId: "12" }),
      },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(createOpsSchoolTripDate).toHaveBeenCalledWith(
      expect.objectContaining({
        schoolId: "12",
        visitDate: "15/06/2026",
      }),
    );
    expect(body.data.message).toBe("Data de passeio vinculada com sucesso.");
  });
});
