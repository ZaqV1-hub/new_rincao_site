import { beforeEach, describe, expect, it, vi } from "vitest";

const getPainelConvenioDetail = vi.fn();
const updatePainelConvenio = vi.fn();

vi.mock("@/lib/painel-convenios", () => ({
  asPainelConveniosError: (error: unknown) => error,
  getPainelConvenioDetail,
  updatePainelConvenio,
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

describe("api/painel/convenios/[agreementId]", () => {
  beforeEach(() => {
    getPainelConvenioDetail.mockReset();
    updatePainelConvenio.mockReset();
  });

  it("encaminha o GET para o detalhe do convenio", async () => {
    getPainelConvenioDetail.mockResolvedValue({ id: 7, name: "Convenio Alfa" });
    const { GET } = await import("@/app/api/painel/convenios/[agreementId]/route");
    const response = await GET(
      new Request("https://example.test/api/painel/convenios/7"),
      { params: Promise.resolve({ agreementId: "7" }) },
    );

    expect(response.status).toBe(200);
    expect(getPainelConvenioDetail).toHaveBeenCalledWith("7");
  });

  it("encaminha o PUT para a edicao do convenio", async () => {
    updatePainelConvenio.mockResolvedValue({ agreementId: 7, message: "ok" });
    const { PUT } = await import("@/app/api/painel/convenios/[agreementId]/route");
    const response = await PUT(
      new Request("https://example.test/api/painel/convenios/7", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ values: { nmconvenio: "Convenio Alfa" } }),
      }),
      { params: Promise.resolve({ agreementId: "7" }) },
    );

    expect(response.status).toBe(200);
    expect(updatePainelConvenio).toHaveBeenCalledWith({
      agreementId: "7",
      values: { nmconvenio: "Convenio Alfa" },
    });
  });
});
