import { beforeEach, describe, expect, it, vi } from "vitest";

const listPainelDiscountTypes = vi.fn();
const createPainelDiscountType = vi.fn();

vi.mock("@/lib/painel-descontos", () => ({
  asPainelDescontosError: (error: unknown) => error,
  listPainelDiscountTypes,
  createPainelDiscountType,
}));

vi.mock("@/lib/painel-api-auth", () => ({
  requirePainelApiAccess: vi.fn(async () => ({
    ok: true,
    legacyResources: ["vis_desc"],
    session: { authSource: "panel", actorName: "Teste", actorCpf: "000" },
  })),
}));

describe("api/painel/categorias", () => {
  beforeEach(() => {
    listPainelDiscountTypes.mockReset();
    createPainelDiscountType.mockReset();
  });

  it("encaminha o GET para a lista", async () => {
    listPainelDiscountTypes.mockResolvedValue({ items: [] });
    const { GET } = await import("@/app/api/painel/categorias/route");
    const response = await GET(
      new Request("https://example.test/api/painel/categorias?page=2"),
    );
    expect(response.status).toBe(200);
    expect(listPainelDiscountTypes).toHaveBeenCalledWith({ page: "2" });
  });

  it("encaminha o POST para o cadastro", async () => {
    createPainelDiscountType.mockResolvedValue({ id: 1 });
    const { POST } = await import("@/app/api/painel/categorias/route");
    const response = await POST(
      new Request("https://example.test/api/painel/categorias", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ values: { descricao: "Professor" } }),
      }),
    );
    expect(response.status).toBe(200);
  });
});
