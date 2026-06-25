import { beforeEach, describe, expect, it, vi } from "vitest";

const listPainelCodIndica = vi.fn();
const createPainelCodIndica = vi.fn();

vi.mock("@/lib/painel-cod-indica", () => ({
  asPainelCodIndicaError: (error: unknown) => error,
  listPainelCodIndica,
  createPainelCodIndica,
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

describe("api/painel/cod-indica", () => {
  beforeEach(() => {
    listPainelCodIndica.mockReset();
    createPainelCodIndica.mockReset();
  });

  it("encaminha o GET para a lista", async () => {
    listPainelCodIndica.mockResolvedValue({ items: [] });
    const { GET } = await import("@/app/api/painel/cod-indica/route");
    const response = await GET(
      new Request("https://example.test/api/painel/cod-indica?page=2&codindica=ABC123"),
    );

    expect(response.status).toBe(200);
    expect(listPainelCodIndica).toHaveBeenCalledWith({
      page: "2",
      filters: {
        codindica: "ABC123",
        page: "2",
      },
    });
  });

  it("encaminha o POST para o cadastro", async () => {
    createPainelCodIndica.mockResolvedValue({ codigo: "ABC123" });
    const { POST } = await import("@/app/api/painel/cod-indica/route");
    const response = await POST(
      new Request("https://example.test/api/painel/cod-indica", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          values: { codindica: "ABC123", nmrepresentante: "Representante" },
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(createPainelCodIndica).toHaveBeenCalledWith(
      { codindica: "ABC123", nmrepresentante: "Representante" },
      "52998224725",
    );
  });
});
