import { beforeEach, describe, expect, it, vi } from "vitest";

const listPainelCompraConvenio = vi.fn();

vi.mock("@/lib/painel-compra-convenio", () => ({
  asPainelCompraConvenioError: (error: unknown) => error,
  listPainelCompraConvenio,
  mapPainelCompraConvenioExportRows: () => [
    {
      Convenios: "Convenio Alfa",
      Passaporte: "5",
      ValorPassaporte: "250,00",
      Infantil: "2",
      ValorInfantil: "60,00",
      Escolar: "3",
      ValorEscolar: "45,00",
      Isento: "1",
      TotalIngressos: "11",
      TotalValores: "355,00",
    },
  ],
  renderPainelCompraConvenioExportTable: () => "<table><tr><td>Convenio Alfa</td></tr></table>",
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

describe("GET /api/painel/compra-convenio/export", () => {
  beforeEach(() => {
    listPainelCompraConvenio.mockReset();
  });

  it("gera a exportacao xls do relatorio consolidado", async () => {
    listPainelCompraConvenio.mockResolvedValue({ rows: [] });
    const { GET } = await import("@/app/api/painel/compra-convenio/export/route");
    const response = await GET(
      new Request("https://example.test/api/painel/compra-convenio/export"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toContain(
      "compras-reservas.xls",
    );
  });
});
