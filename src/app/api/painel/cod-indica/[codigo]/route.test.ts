import { beforeEach, describe, expect, it, vi } from "vitest";

const getPainelCodIndicaDetail = vi.fn();
const updatePainelCodIndica = vi.fn();

vi.mock("@/lib/painel-cod-indica", () => ({
  asPainelCodIndicaError: (error: unknown) => error,
  getPainelCodIndicaDetail,
  updatePainelCodIndica,
}));

vi.mock("@/lib/painel-api-auth", () => ({
  requirePainelApiAccess: vi.fn(async () => ({
    ok: true,
    legacyResources: ["vis_indica"],
    session: {
      actorCpf: "52998224725",
      actorName: "Gestor Teste",
      legacyRoleId: 1,
    },
  })),
}));

describe("api/painel/cod-indica/[codigo]", () => {
  beforeEach(() => {
    getPainelCodIndicaDetail.mockReset();
    updatePainelCodIndica.mockReset();
  });

  it("carrega o detalhe com filtros", async () => {
    getPainelCodIndicaDetail.mockResolvedValue({ codigo: "ABC123" });
    const { GET } = await import("@/app/api/painel/cod-indica/[codigo]/route");
    const response = await GET(
      new Request("https://example.test/api/painel/cod-indica/ABC123?idcompra=10"),
      { params: Promise.resolve({ codigo: "ABC123" }) },
    );

    expect(response.status).toBe(200);
    expect(getPainelCodIndicaDetail).toHaveBeenCalledWith("ABC123", { idcompra: "10" });
  });

  it("encaminha o PUT para a atualizacao", async () => {
    updatePainelCodIndica.mockResolvedValue({ codigo: "ABC123" });
    const { PUT } = await import("@/app/api/painel/cod-indica/[codigo]/route");
    const response = await PUT(
      new Request("https://example.test/api/painel/cod-indica/ABC123", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          values: { nmrepresentante: "Novo Nome" },
        }),
      }),
      { params: Promise.resolve({ codigo: "ABC123" }) },
    );

    expect(response.status).toBe(200);
    expect(updatePainelCodIndica).toHaveBeenCalledWith(
      "ABC123",
      { nmrepresentante: "Novo Nome" },
      "52998224725",
    );
  });
});
