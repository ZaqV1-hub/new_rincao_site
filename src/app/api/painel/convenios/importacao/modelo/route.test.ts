import { describe, expect, it, vi } from "vitest";

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

describe("api/painel/convenios/importacao/modelo", () => {
  it("retorna o csv modelo legado", async () => {
    const { GET } = await import(
      "@/app/api/painel/convenios/importacao/modelo/route"
    );
    const response = await GET(
      new Request("https://example.test/api/painel/convenios/importacao/modelo"),
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toContain(
      "CPF;QTD. COMPRA POR DIA;DATA INICIO;DATA FIM;STATUS",
    );
  });
});
