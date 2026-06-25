import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticateOperationsRequest = vi.fn();
const authorizePainelApiAccess = vi.fn();
const listOpsClientTrips = vi.fn();
const createOpsClientTrip = vi.fn();
const asOpsClientTripError = vi.fn();

vi.mock("@/lib/ops-auth", () => ({
  authenticateOperationsRequest,
}));

vi.mock("@/lib/painel-api-auth", () => ({
  authorizePainelApiAccess,
}));

vi.mock("@/lib/ops-client-trips", () => ({
  listOpsClientTrips,
  createOpsClientTrip,
  asOpsClientTripError,
}));

describe("ops/admin/clients/trips route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateOperationsRequest.mockReturnValue({ ok: true });
    authorizePainelApiAccess.mockResolvedValue({ ok: true, legacyResources: [] });
    asOpsClientTripError.mockImplementation((error: unknown) => error);
  });

  it("lists trips with filters", async () => {
    listOpsClientTrips.mockResolvedValue({
      filters: {
        code: "ABC123",
        query: "",
        typeId: null,
        status: "",
        fromDate: "",
        toDate: "",
        page: 1,
        pageSize: 20,
      },
      indicators: {
        performed: 1,
        upcoming: 2,
        total: 3,
      },
      typeOptions: [],
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
      pageCount: 1,
    });

    const { GET } = await import("@/app/api/ops/admin/clients/trips/route");
    const response = await GET(
      new Request("https://example.com/api/ops/admin/clients/trips?code=ABC123"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(listOpsClientTrips).toHaveBeenCalledWith(
      expect.objectContaining({ code: "ABC123" }),
    );
    expect(body.ok).toBe(true);
  });

  it("creates a trip binding", async () => {
    createOpsClientTrip.mockResolvedValue({
      agendaId: 10,
      clientId: 20,
      auditLogId: 30,
      message: "Passeio vinculado e faixas salvas com sucesso.",
    });

    const { POST } = await import("@/app/api/ops/admin/clients/trips/route");
    const response = await POST(
      new Request("https://example.com/api/ops/admin/clients/trips", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          agendaId: 10,
          clientId: 20,
          acceptsFamily: true,
          faixas: [{ minAge: 6, maxAge: 12, value: "39.90" }],
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(createOpsClientTrip).toHaveBeenCalledWith(
      expect.objectContaining({
        agendaId: 10,
        clientId: 20,
        acceptsFamily: true,
      }),
    );
    expect(body.data.message).toBe("Passeio vinculado e faixas salvas com sucesso.");
  });
});
