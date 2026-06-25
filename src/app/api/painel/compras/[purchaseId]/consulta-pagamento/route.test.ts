import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePainelApiAccess = vi.fn();
const getPainelPurchaseGatewayConsult = vi.fn();

vi.mock("@/lib/painel-api-auth", () => ({
  requirePainelApiAccess,
}));

vi.mock("@/lib/painel-compras", () => ({
  getPainelPurchaseGatewayConsult,
  asPainelComprasError: (error: unknown) => error,
}));

describe("GET /api/painel/compras/[purchaseId]/consulta-pagamento", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna a consulta de pagamento da compra", async () => {
    requirePainelApiAccess.mockResolvedValue({
      ok: true,
      session: {
        actorName: "Operador",
        actorCpf: "12345678900",
      },
    });
    getPainelPurchaseGatewayConsult.mockResolvedValue({
      purchaseId: 551,
      found: true,
      statusCode: 3,
      statusLabel: "Paga",
    });

    const { GET } = await import(
      "@/app/api/painel/compras/[purchaseId]/consulta-pagamento/route"
    );
    const response = await GET(
      new Request("https://example.com/api/painel/compras/551/consulta-pagamento"),
      {
        params: Promise.resolve({ purchaseId: "551" }),
      },
    );
    const body = await response.json();

    expect(requirePainelApiAccess).toHaveBeenCalledWith(
      expect.any(Request),
      ["vis_compra", "vis_bilhet"],
    );
    expect(getPainelPurchaseGatewayConsult).toHaveBeenCalledWith(551);
    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      data: {
        purchaseId: 551,
        found: true,
        statusCode: 3,
        statusLabel: "Paga",
      },
    });
  });
});
