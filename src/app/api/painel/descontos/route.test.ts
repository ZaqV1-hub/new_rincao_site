import { beforeEach, describe, expect, it, vi } from "vitest";

const listPainelDiscounts = vi.fn();
const createPainelDiscount = vi.fn();

vi.mock("@/lib/painel-descontos", () => ({
  asPainelDescontosError: (error: unknown) => error,
  listPainelDiscounts,
  createPainelDiscount,
}));

vi.mock("@/lib/painel-api-auth", () => ({
  requirePainelApiAccess: vi.fn(async () => ({
    ok: true,
    legacyResources: ["vis_desc"],
    session: { authSource: "panel", actorName: "Teste", actorCpf: "000" },
  })),
}));

describe("api/painel/descontos", () => {
  beforeEach(() => {
    listPainelDiscounts.mockReset();
    createPainelDiscount.mockReset();
  });

  it("encaminha o GET para a lista", async () => {
    listPainelDiscounts.mockResolvedValue({ items: [] });
    const { GET } = await import("@/app/api/painel/descontos/route");
    const response = await GET(
      new Request("https://example.test/api/painel/descontos?page=2"),
    );
    expect(response.status).toBe(200);
    expect(listPainelDiscounts).toHaveBeenCalledWith({ page: "2" });
  });

  it("encaminha o POST para o cadastro", async () => {
    createPainelDiscount.mockResolvedValue({ id: 1 });
    const { POST } = await import("@/app/api/painel/descontos/route");
    const response = await POST(
      new Request("https://example.test/api/painel/descontos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          values: { tipo_id: "1", nome: "Desc", tipo_aplicacao: "percentual", valor: "10" },
        }),
      }),
    );
    expect(response.status).toBe(200);
  });
});
