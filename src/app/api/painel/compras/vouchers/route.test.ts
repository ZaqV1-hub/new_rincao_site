import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePainelApiAccess = vi.fn();
const listPainelPurchaseVouchers = vi.fn();

vi.mock("@/lib/painel-api-auth", () => ({
  requirePainelApiAccess,
}));

vi.mock("@/lib/painel-compras", () => ({
  listPainelPurchaseVouchers,
}));

describe("GET /api/painel/compras/vouchers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna a lista de vouchers da familia compras", async () => {
    requirePainelApiAccess.mockResolvedValue({
      ok: true,
      session: {
        actorName: "Operador",
        actorCpf: "12345678900",
      },
    });
    listPainelPurchaseVouchers.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      perPage: 100,
      totalPages: 1,
      filters: {
        voucherId: null,
        purchaseDateFrom: null,
        purchaseDateTo: null,
        usedDateFrom: null,
        usedDateTo: null,
        visitDateFrom: null,
        visitDateTo: null,
        voucherType: null,
        purchaseLocation: null,
        purchaseStatus: null,
        usedStatus: null,
      },
      indicators: {
        qtdnormal_site: 0,
        vlnormal_site: "0,00",
        qtdinfantil_site: 0,
        vlinfantil_site: "0,00",
        qtdnormal_parque: 0,
        vlnormal_parque: "0,00",
        qtdinfantil_parque: 0,
        vlinfantil_parque: "0,00",
        qtdescola: 0,
        vlescola: "0,00",
        qtdadulto_reserva: 0,
        vladulto_reserva: "0,00",
        qtdinfantil_reserva: 0,
        vlinfantil_reserva: "0,00",
        qtespecial: 0,
        vlespecial: "0,00",
        qtdcortesia: 0,
        qtdisento: 0,
        totalCount: 0,
        totalValue: "0,00",
      },
    });

    const { GET } = await import("@/app/api/painel/compras/vouchers/route");
    const response = await GET(
      new Request("https://example.com/api/painel/compras/vouchers?tpcompra=site"),
    );
    const body = await response.json();

    expect(listPainelPurchaseVouchers).toHaveBeenCalledWith({
      page: null,
      filters: {
        tpcompra: "site",
      },
    });
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.total).toBe(0);
  });
});
