import { beforeEach, describe, expect, it, vi } from "vitest";

const togglePainelConvenioStatus = vi.fn();

vi.mock("@/lib/painel-convenios", () => ({
  asPainelConveniosError: (error: unknown) => error,
  togglePainelConvenioStatus,
}));

vi.mock("@/lib/painel-api-auth", () => ({
  requirePainelApiAccess: vi.fn(async () => ({
    ok: true,
    legacyResources: ["vis_conve"],
    session: {
      authSource: "panel",
      actorName: "Teste",
      actorCpf: "00000000000",
    },
  })),
}));

describe("api/painel/convenios/[agreementId]/status", () => {
  beforeEach(() => {
    togglePainelConvenioStatus.mockReset();
  });

  it("encaminha o PATCH para a mutacao de status do convenio", async () => {
    togglePainelConvenioStatus.mockResolvedValue({
      agreementId: 7,
      message: "Convenio inativado com sucesso.",
    });

    const { PATCH } = await import(
      "@/app/api/painel/convenios/[agreementId]/status/route"
    );
    const request = new Request(
      "https://example.test/api/painel/convenios/7/status",
      {
        method: "PATCH",
        body: JSON.stringify({ status: "ina" }),
        headers: { "content-type": "application/json" },
      },
    );

    const response = await PATCH(request, {
      params: Promise.resolve({ agreementId: "7" }),
    });

    expect(response.status).toBe(200);
    expect(togglePainelConvenioStatus).toHaveBeenCalledWith({
      agreementId: "7",
      status: "ina",
    });
  });
});
