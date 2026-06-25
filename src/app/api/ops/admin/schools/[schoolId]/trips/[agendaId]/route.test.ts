import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticateOperationsRequest = vi.fn();
const authorizePainelApiAccess = vi.fn();
const updateOpsSchoolTripDateStatus = vi.fn();
const deleteOpsSchoolTripDate = vi.fn();
const asOpsSchoolTripsError = vi.fn();

vi.mock("@/lib/ops-auth", () => ({
  authenticateOperationsRequest,
}));

vi.mock("@/lib/painel-api-auth", () => ({
  authorizePainelApiAccess,
}));

vi.mock("@/lib/ops-school-trips", () => ({
  updateOpsSchoolTripDateStatus,
  deleteOpsSchoolTripDate,
  asOpsSchoolTripsError,
}));

describe("ops/admin/schools/[schoolId]/trips/[agendaId] route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateOperationsRequest.mockReturnValue({ ok: true });
    authorizePainelApiAccess.mockResolvedValue({ ok: true, legacyResources: [] });
    asOpsSchoolTripsError.mockImplementation((error: unknown) => error);
  });

  it("updates the trip date status", async () => {
    updateOpsSchoolTripDateStatus.mockResolvedValue({
      schoolId: 12,
      agendaId: 77,
      status: "ina",
      auditLogId: 701,
      message: "Status da data atualizado com sucesso.",
    });

    const { PATCH } = await import(
      "@/app/api/ops/admin/schools/[schoolId]/trips/[agendaId]/route"
    );
    const response = await PATCH(
      new Request("https://example.com/api/ops/admin/schools/12/trips/77", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          status: "ina",
        }),
      }),
      {
        params: Promise.resolve({ schoolId: "12", agendaId: "77" }),
      },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(updateOpsSchoolTripDateStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        schoolId: "12",
        agendaId: "77",
        status: "ina",
      }),
    );
    expect(body.data.message).toBe("Status da data atualizado com sucesso.");
  });

  it("removes the trip date binding", async () => {
    deleteOpsSchoolTripDate.mockResolvedValue({
      schoolId: 12,
      agendaId: 77,
      auditLogId: 702,
      message: "Data de passeio removida com sucesso.",
    });

    const { DELETE } = await import(
      "@/app/api/ops/admin/schools/[schoolId]/trips/[agendaId]/route"
    );
    const response = await DELETE(
      new Request("https://example.com/api/ops/admin/schools/12/trips/77", {
        method: "DELETE",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          reason: "Limpeza",
        }),
      }),
      {
        params: Promise.resolve({ schoolId: "12", agendaId: "77" }),
      },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(deleteOpsSchoolTripDate).toHaveBeenCalledWith(
      expect.objectContaining({
        schoolId: "12",
        agendaId: "77",
        reason: "Limpeza",
      }),
    );
    expect(body.data.message).toBe("Data de passeio removida com sucesso.");
  });
});
