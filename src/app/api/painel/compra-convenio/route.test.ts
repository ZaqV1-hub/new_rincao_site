import { beforeEach, describe, expect, it, vi } from "vitest";

const listPainelCompraConvenio = vi.fn();

vi.mock("@/lib/painel-compra-convenio", () => ({
  asPainelCompraConvenioError: (error: unknown) => error,
  listPainelCompraConvenio,
}));

vi.mock("@/lib/painel-api-auth", () => ({
  requirePainelApiAccess: vi.fn(async () => ({
    ok: true,
    legacyResources: ["vis_compra", "vis_conve"],
    session: {
      authSource: "panel",
      actorName: "Teste",
      actorCpf: "00000000000",
    },
  })),
}));

describe("GET /api/painel/compra-convenio", () => {
  beforeEach(() => {
    listPainelCompraConvenio.mockReset();
  });

  it("encaminha os filtros para o relatorio de compra convenio", async () => {
    listPainelCompraConvenio.mockResolvedValue({ rows: [] });
    const { GET } = await import("@/app/api/painel/compra-convenio/route");
    const response = await GET(
      new Request(
        "https://example.test/api/painel/compra-convenio?convenio=Convenio%20Alfa",
      ),
    );

    expect(response.status).toBe(200);
    expect(listPainelCompraConvenio).toHaveBeenCalledWith({
      convenio: "Convenio Alfa",
    });
  });
});
