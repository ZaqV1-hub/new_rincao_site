import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticateOperationsRequest = vi.fn();
const authorizePainelApiAccess = vi.fn();
const upsertPainelAgendaRange = vi.fn();
const getPainelAgendaDay = vi.fn();
const asPainelAgendaError = vi.fn();

vi.mock("@/lib/ops-auth", () => ({
  authenticateOperationsRequest,
}));

vi.mock("@/lib/painel-api-auth", () => ({
  authorizePainelApiAccess,
}));

vi.mock("@/lib/painel-agenda", () => ({
  upsertPainelAgendaRange,
  getPainelAgendaDay,
  asPainelAgendaError,
}));

describe("painel/agenda BFF route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateOperationsRequest.mockReturnValue({ ok: true });
    authorizePainelApiAccess.mockResolvedValue({ ok: true, legacyResources: ["vis_agenda"] });
    asPainelAgendaError.mockImplementation((error: unknown) => error);
  });

  it("requires ops.read and painel agenda access", async () => {
    authenticateOperationsRequest.mockReturnValueOnce({
      ok: false,
      response: Response.json(
        {
          ok: false,
          error: {
            code: "operations_forbidden",
            message: "Sessao operacional sem permissao para esta acao.",
          },
        },
        { status: 403 },
      ),
    });

    const { POST } = await import("@/app/api/painel/agenda/route");
    const response = await POST(
      new Request("https://example.com/api/painel/agenda", {
        method: "POST",
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(403);
    expect(authenticateOperationsRequest).toHaveBeenCalledWith(
      expect.any(Request),
      { requiredPermission: "ops.read" },
    );
  });

  it("upserts an agenda range", async () => {
    upsertPainelAgendaRange.mockResolvedValue({
      ok: true,
      message: "Agenda salva.",
      touchedDates: ["2026-04-27"],
    });

    const { POST } = await import("@/app/api/painel/agenda/route");
    const response = await POST(
      new Request("https://example.com/api/painel/agenda", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          startDate: "2026-04-27",
          endDate: "2026-04-27",
          priceTableId: 2,
          informationId: 3,
          type: "padra",
          status: "abe",
          reason: "Ajuste",
          actor: {
            name: "Gestor",
            cpf: "52998224725",
          },
        }),
      }),
    );
    const body = await response.json();

    expect(authorizePainelApiAccess).toHaveBeenCalledWith(
      expect.any(Request),
      "vis_agenda",
    );
    expect(upsertPainelAgendaRange).toHaveBeenCalledWith(
      expect.objectContaining({
        agendaId: null,
        startDate: "2026-04-27",
        endDate: "2026-04-27",
        priceTableId: 2,
        informationId: 3,
        type: "padra",
        status: "abe",
      }),
    );
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
  });

  it("returns selected day details for incremental agenda loading", async () => {
    getPainelAgendaDay.mockResolvedValue({
      selectedDate: "2026-05-09",
      agenda: null,
      vouchers: [],
    });

    const { GET } = await import("@/app/api/painel/agenda/route");
    const response = await GET(
      new Request("https://example.com/api/painel/agenda?date=2026-05-09"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(authorizePainelApiAccess).toHaveBeenCalledWith(
      expect.any(Request),
      "vis_agenda",
    );
    expect(getPainelAgendaDay).toHaveBeenCalledWith("2026-05-09");
    expect(body).toEqual({
      ok: true,
      data: {
        selectedDate: "2026-05-09",
        agenda: null,
        vouchers: [],
      },
    });
  });
});
