import { beforeEach, describe, expect, it, vi } from "vitest";

const listPainelCortesias = vi.fn();
const createPainelCortesia = vi.fn();

vi.mock("@/lib/painel-cortesias", () => ({
  asPainelCortesiasError: (error: unknown) => error,
  listPainelCortesias,
  createPainelCortesia,
}));

vi.mock("@/lib/painel-api-auth", () => ({
  requirePainelApiAccess: vi.fn(async () => ({
    ok: true,
    legacyResources: ["vis_cort"],
    session: { authSource: "panel", actorName: "Teste", actorCpf: "000" },
  })),
}));

describe("api/painel/cortesias", () => {
  beforeEach(() => {
    listPainelCortesias.mockReset();
    createPainelCortesia.mockReset();
  });

  it("encaminha o GET para a lista", async () => {
    listPainelCortesias.mockResolvedValue({ items: [] });
    const { GET } = await import("@/app/api/painel/cortesias/route");
    const response = await GET(
      new Request("https://example.test/api/painel/cortesias?page=2"),
    );
    expect(response.status).toBe(200);
    expect(listPainelCortesias).toHaveBeenCalledWith({ page: "2", perPage: null });
  });

  it("encaminha o POST para o cadastro", async () => {
    createPainelCortesia.mockResolvedValue({ id: 1 });
    const { POST } = await import("@/app/api/painel/cortesias/route");
    const response = await POST(
      new Request("https://example.test/api/painel/cortesias", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          values: { nome: "Diretoria" },
        }),
      }),
    );
    expect(response.status).toBe(200);
  });
});
