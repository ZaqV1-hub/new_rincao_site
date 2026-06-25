import { beforeEach, describe, expect, it, vi } from "vitest";

const removePainelConvenioMember = vi.fn();

vi.mock("@/lib/painel-convenio-members", () => ({
  asPainelConvenioMembersError: (error: unknown) => error,
  removePainelConvenioMember,
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

describe("api/painel/convenios/[agreementId]/conveniados/[memberId]/remove", () => {
  beforeEach(() => {
    removePainelConvenioMember.mockReset();
  });

  it("encaminha o DELETE para a remocao do conveniado", async () => {
    removePainelConvenioMember.mockResolvedValue({ message: "ok" });
    const { DELETE } = await import(
      "@/app/api/painel/convenios/[agreementId]/conveniados/[memberId]/remove/route"
    );
    const response = await DELETE(
      new Request("https://example.test/api/painel/convenios/7/conveniados/123/remove", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ agreementId: "7", memberId: "12345678901" }) },
    );

    expect(response.status).toBe(200);
    expect(removePainelConvenioMember).toHaveBeenCalledWith({
      agreementId: "7",
      memberId: "12345678901",
    });
  });
});
