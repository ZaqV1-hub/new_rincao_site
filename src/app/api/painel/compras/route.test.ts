import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePainelApiAccess = vi.fn();
const listPainelPurchases = vi.fn();

vi.mock("@/lib/painel-api-auth", () => ({
  requirePainelApiAccess,
}));

vi.mock("@/lib/painel-compras", () => ({
  listPainelPurchases,
}));

describe("GET /api/painel/compras", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna a lista paginada de compras", async () => {
    requirePainelApiAccess.mockResolvedValue({
      ok: true,
      session: {
        actorName: "Operador",
        actorCpf: "12345678900",
      },
    });
    listPainelPurchases.mockResolvedValue({
      total: 1,
      page: 1,
      perPage: 30,
      totalPages: 1,
      filters: {
        purchaseId: null,
        type: null,
        purchaseStatus: null,
        ticketPaymentMethod: null,
        gatewayPaymentMethod: null,
        gatewayStatus: null,
        cpf: null,
        userName: null,
        dateFrom: null,
        dateTo: null,
      },
      items: [
        {
          purchaseId: 551,
          purchaseDate: "06/05/2026",
          type: "bilhe",
          typeLabel: "Bilheteria",
          status: "conc",
          statusLabel: "Concluida",
          paymentMethodLabel: "PIX",
          paymentLabel: "Bilheteria",
          cpf: "12345678901",
          userName: "DEV",
          totalValue: "80,00",
        },
      ],
    });

    const { GET } = await import("@/app/api/painel/compras/route");
    const response = await GET(
      new Request("https://example.com/api/painel/compras?page=1"),
    );
    const body = await response.json();

    expect(requirePainelApiAccess).toHaveBeenCalledWith(
      expect.any(Request),
      ["vis_compra", "vis_bilhet"],
    );
    expect(listPainelPurchases).toHaveBeenCalledWith({
      page: "1",
      filters: {
        page: "1",
      },
    });
    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      data: {
        total: 1,
        page: 1,
        perPage: 30,
        totalPages: 1,
        filters: {
          purchaseId: null,
          type: null,
          purchaseStatus: null,
          ticketPaymentMethod: null,
          gatewayPaymentMethod: null,
          gatewayStatus: null,
          cpf: null,
          userName: null,
          dateFrom: null,
          dateTo: null,
        },
        items: [
          {
            purchaseId: 551,
            purchaseDate: "06/05/2026",
            type: "bilhe",
            typeLabel: "Bilheteria",
            status: "conc",
            statusLabel: "Concluida",
            paymentMethodLabel: "PIX",
            paymentLabel: "Bilheteria",
            cpf: "12345678901",
            userName: "DEV",
            totalValue: "80,00",
          },
        ],
      },
    });
  });
});
