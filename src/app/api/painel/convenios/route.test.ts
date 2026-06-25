import { beforeEach, describe, expect, it, vi } from "vitest";

const listPainelConvenios = vi.fn();

vi.mock("@/lib/painel-convenios", () => ({
  listPainelConvenios,
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

describe("api/painel/convenios", () => {
  beforeEach(() => {
    listPainelConvenios.mockReset();
  });

  it("retorna a lista serializada em formato ok/data", async () => {
    listPainelConvenios.mockResolvedValue({
      items: [],
      filters: {
        name: null,
        status: null,
        priceTableId: null,
        periodFrom: null,
        periodTo: null,
        page: 1,
        perPage: 30,
      },
      page: 1,
      perPage: 30,
      total: 0,
      pageCount: 1,
      start: 0,
      end: 0,
      priceTableOptions: [],
    });

    const { GET } = await import("@/app/api/painel/convenios/route");
    const response = await GET(
      new Request("https://example.test/api/painel/convenios?page=1"),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(listPainelConvenios).toHaveBeenCalled();
  });
});
