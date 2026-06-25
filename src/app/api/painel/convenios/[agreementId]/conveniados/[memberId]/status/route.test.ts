import { beforeEach, describe, expect, it, vi } from "vitest";

const togglePainelConvenioMemberStatus = vi.fn();

vi.mock("@/lib/painel-convenio-members", () => ({
  asPainelConvenioMembersError: (error: unknown) => error,
  togglePainelConvenioMemberStatus,
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

describe("api/painel/convenios/[agreementId]/conveniados/[memberId]/status", () => {
  beforeEach(() => {
    togglePainelConvenioMemberStatus.mockReset();
  });

  it("encaminha o PATCH para a alternancia de status do conveniado", async () => {
    togglePainelConvenioMemberStatus.mockResolvedValue({ message: "ok" });
    const { PATCH } = await import(
      "@/app/api/painel/convenios/[agreementId]/conveniados/[memberId]/status/route"
    );
    const response = await PATCH(
      new Request("https://example.test/api/painel/convenios/7/conveniados/123/status", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "ina" }),
      }),
      { params: Promise.resolve({ agreementId: "7", memberId: "12345678901" }) },
    );

    expect(response.status).toBe(200);
    expect(togglePainelConvenioMemberStatus).toHaveBeenCalledWith({
      agreementId: "7",
      memberId: "12345678901",
      status: "ina",
    });
  });
});
