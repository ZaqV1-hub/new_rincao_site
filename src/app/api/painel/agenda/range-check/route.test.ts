import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticateOperationsRequest = vi.fn();
const authorizePainelApiAccess = vi.fn();
const previewPainelAgendaRange = vi.fn();
const asPainelAgendaError = vi.fn();

vi.mock("@/lib/ops-auth", () => ({
  authenticateOperationsRequest,
}));

vi.mock("@/lib/painel-api-auth", () => ({
  authorizePainelApiAccess,
}));

vi.mock("@/lib/painel-agenda", () => ({
  previewPainelAgendaRange,
  asPainelAgendaError,
}));

describe("painel/agenda/range-check BFF route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateOperationsRequest.mockReturnValue({ ok: true });
    authorizePainelApiAccess.mockResolvedValue({ ok: true, legacyResources: ["vis_agenda"] });
    asPainelAgendaError.mockImplementation((error: unknown) => error);
  });

  it("checks a date range using the panel ACL", async () => {
    previewPainelAgendaRange.mockResolvedValue({
      existingDates: ["2026-04-27"],
      hasSchoolDates: false,
    });

    const { POST } = await import("@/app/api/painel/agenda/range-check/route");
    const response = await POST(
      new Request("https://example.com/api/painel/agenda/range-check", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          startDate: "2026-04-27",
          endDate: "2026-04-30",
        }),
      }),
    );
    const body = await response.json();

    expect(authenticateOperationsRequest).toHaveBeenCalledWith(
      expect.any(Request),
      { requiredPermission: "ops.read" },
    );
    expect(previewPainelAgendaRange).toHaveBeenCalledWith({
      excludeAgendaId: null,
      startDate: "2026-04-27",
      endDate: "2026-04-30",
    });
    expect(response.status).toBe(200);
    expect(body.data.existingDates).toEqual(["2026-04-27"]);
  });
});
