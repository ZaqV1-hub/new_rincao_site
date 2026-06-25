import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePainelApiAccess = vi.fn();
const getPainelPurchaseDetail = vi.fn();

vi.mock("@/lib/painel-api-auth", () => ({
  requirePainelApiAccess,
}));

vi.mock("@/lib/painel-compras", () => ({
  getPainelPurchaseDetail,
  asPainelComprasError: (error: unknown) => error,
}));

describe("GET /api/painel/compras/[purchaseId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna o detalhe da compra", async () => {
    requirePainelApiAccess.mockResolvedValue({
      ok: true,
      session: {
        actorName: "Operador",
        actorCpf: "12345678900",
      },
    });
    getPainelPurchaseDetail.mockResolvedValue({
      purchaseId: 551,
      typeLabel: "Compra",
      vouchers: [],
    });

    const { GET } = await import("@/app/api/painel/compras/[purchaseId]/route");
    const response = await GET(
      new Request("https://example.com/api/painel/compras/551"),
      {
        params: Promise.resolve({ purchaseId: "551" }),
      },
    );
    const body = await response.json();

    expect(requirePainelApiAccess).toHaveBeenCalledWith(
      expect.any(Request),
      ["vis_compra", "vis_bilhet"],
    );
    expect(getPainelPurchaseDetail).toHaveBeenCalledWith(551);
    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      data: {
        purchaseId: 551,
        typeLabel: "Compra",
        vouchers: [],
      },
    });
  });
});
