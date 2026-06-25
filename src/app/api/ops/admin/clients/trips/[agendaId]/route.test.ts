import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticateOperationsRequest = vi.fn();
const authorizePainelApiAccess = vi.fn();
const updateOpsClientTrip = vi.fn();
const unlinkOpsClientTrip = vi.fn();
const asOpsClientTripError = vi.fn();

vi.mock("@/lib/ops-auth", () => ({
  authenticateOperationsRequest,
}));

vi.mock("@/lib/painel-api-auth", () => ({
  authorizePainelApiAccess,
}));

vi.mock("@/lib/ops-client-trips", () => ({
  updateOpsClientTrip,
  unlinkOpsClientTrip,
  asOpsClientTripError,
}));

describe("ops/admin/clients/trips/[agendaId] route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateOperationsRequest.mockReturnValue({ ok: true });
    authorizePainelApiAccess.mockResolvedValue({ ok: true, legacyResources: [] });
    asOpsClientTripError.mockImplementation((error: unknown) => error);
  });

  it("updates a trip binding", async () => {
    updateOpsClientTrip.mockResolvedValue({
      agendaId: 10,
      clientId: 20,
      auditLogId: 30,
      message: "Passeio atualizado com sucesso.",
    });

    const { PATCH } = await import(
      "@/app/api/ops/admin/clients/trips/[agendaId]/route"
    );
    const response = await PATCH(
      new Request("https://example.com/api/ops/admin/clients/trips/10", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          clientId: 20,
          acceptsFamily: false,
          faixas: [{ minAge: 13, maxAge: 17, value: "49.90" }],
        }),
      }),
      {
        params: Promise.resolve({ agendaId: "10" }),
      },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(updateOpsClientTrip).toHaveBeenCalledWith(
      expect.objectContaining({
        agendaId: "10",
        clientId: 20,
      }),
    );
    expect(body.data.message).toBe("Passeio atualizado com sucesso.");
  });

  it("unlinks a trip binding", async () => {
    unlinkOpsClientTrip.mockResolvedValue({
      agendaId: 10,
      clientId: 20,
      auditLogId: 30,
      message: "Passeio desvinculado com sucesso.",
    });

    const { DELETE } = await import(
      "@/app/api/ops/admin/clients/trips/[agendaId]/route"
    );
    const response = await DELETE(
      new Request("https://example.com/api/ops/admin/clients/trips/10", {
        method: "DELETE",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          clientId: 20,
        }),
      }),
      {
        params: Promise.resolve({ agendaId: "10" }),
      },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(unlinkOpsClientTrip).toHaveBeenCalledWith(
      expect.objectContaining({
        agendaId: "10",
        clientId: 20,
      }),
    );
    expect(body.data.message).toBe("Passeio desvinculado com sucesso.");
  });
});
