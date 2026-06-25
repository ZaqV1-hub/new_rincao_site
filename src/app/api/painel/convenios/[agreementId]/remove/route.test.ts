import { beforeEach, describe, expect, it, vi } from "vitest";

const removePainelConvenio = vi.fn();

vi.mock("@/lib/painel-convenios", () => ({
  asPainelConveniosError: (error: unknown) => error,
  removePainelConvenio,
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

describe("api/painel/convenios/[agreementId]/remove", () => {
  beforeEach(() => {
    removePainelConvenio.mockReset();
  });

  it("encaminha o DELETE para a remocao do convenio", async () => {
    removePainelConvenio.mockResolvedValue({
      agreementId: 7,
      message: "Convenio removido com sucesso.",
    });

    const { DELETE } = await import(
      "@/app/api/painel/convenios/[agreementId]/remove/route"
    );
    const response = await DELETE(
      new Request("https://example.test/api/painel/convenios/7/remove", {
        method: "DELETE",
      }),
      {
        params: Promise.resolve({ agreementId: "7" }),
      },
    );

    expect(response.status).toBe(200);
    expect(removePainelConvenio).toHaveBeenCalledWith({
      agreementId: "7",
    });
  });
});
