import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePainelApiAccess = vi.fn();
const listPainelPurchases = vi.fn();
const mapPainelPurchaseListExportRows = vi.fn();
const renderPainelPurchaseListExportTable = vi.fn();

vi.mock("@/lib/painel-api-auth", () => ({
  requirePainelApiAccess,
}));

vi.mock("@/lib/painel-compras", () => ({
  listPainelPurchases,
  mapPainelPurchaseListExportRows,
  renderPainelPurchaseListExportTable,
}));

describe("GET /api/painel/compras/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("gera exportacao xls da lista principal", async () => {
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
      perPage: 1,
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
      items: [],
    });
    mapPainelPurchaseListExportRows.mockReturnValue([
      ["ID", "Data compra"],
      ["551", "06/05/2026"],
    ]);
    renderPainelPurchaseListExportTable.mockReturnValue(
      "<table><tr><td>551</td></tr></table>",
    );

    const { GET } = await import("@/app/api/painel/compras/export/route");
    const response = await GET(
      new Request("https://example.com/api/painel/compras/export"),
    );
    const body = await response.text();

    expect(listPainelPurchases).toHaveBeenCalledWith({
      page: "1",
      filters: {},
      allRows: true,
    });
    expect(mapPainelPurchaseListExportRows).toHaveBeenCalled();
    expect(renderPainelPurchaseListExportTable).toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/vnd.ms-excel");
    expect(response.headers.get("content-disposition")).toContain(
      'attachment; filename="compras.xls"',
    );
    expect(body).toContain("<table");
    expect(body).toContain("<td>551</td>");
  });
});
