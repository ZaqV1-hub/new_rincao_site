import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticateOperationsRequest = vi.fn();
const authorizePainelApiAccess = vi.fn();
const deletePainelAgenda = vi.fn();
const asPainelAgendaError = vi.fn();

vi.mock("@/lib/ops-auth", () => ({
  authenticateOperationsRequest,
}));

vi.mock("@/lib/painel-api-auth", () => ({
  authorizePainelApiAccess,
}));

vi.mock("@/lib/painel-agenda", () => ({
  deletePainelAgenda,
  asPainelAgendaError,
}));

describe("painel/agenda/[agendaId] BFF route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateOperationsRequest.mockReturnValue({ ok: true });
    authorizePainelApiAccess.mockResolvedValue({ ok: true, legacyResources: ["vis_agenda"] });
    asPainelAgendaError.mockImplementation((error: unknown) => error);
  });

  it("deletes an agenda day with motivo", async () => {
    deletePainelAgenda.mockResolvedValue({
      ok: true,
      deletedId: 10,
      deletedDate: "2026-04-27",
    });

    const { DELETE } = await import("@/app/api/painel/agenda/[agendaId]/route");
    const response = await DELETE(
      new Request("https://example.com/api/painel/agenda/10", {
        method: "DELETE",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          reason: "Data removida",
          actor: {
            name: "Gestor",
            cpf: "52998224725",
          },
        }),
      }),
      {
        params: Promise.resolve({ agendaId: "10" }),
      },
    );
    const body = await response.json();

    expect(authenticateOperationsRequest).toHaveBeenCalledWith(
      expect.any(Request),
      { requiredPermission: "ops.read" },
    );
    expect(deletePainelAgenda).toHaveBeenCalledWith(10, {
      reason: "Data removida",
      actor: {
        name: "Gestor",
        cpf: "52998224725",
      },
    });
    expect(response.status).toBe(200);
    expect(body.data.deletedId).toBe(10);
  });
});
