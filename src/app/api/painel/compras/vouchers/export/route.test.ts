import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePainelApiAccess = vi.fn();
const listPainelPurchaseVouchers = vi.fn();
const mapPainelPurchaseVoucherListExportRows = vi.fn();
const renderPainelPurchaseListExportTable = vi.fn();

vi.mock("@/lib/painel-api-auth", () => ({
  requirePainelApiAccess,
}));

vi.mock("@/lib/painel-compras", () => ({
  listPainelPurchaseVouchers,
  mapPainelPurchaseVoucherListExportRows,
  renderPainelPurchaseListExportTable,
}));

describe("GET /api/painel/compras/vouchers/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("gera exportacao xls da lista de vouchers", async () => {
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
      perPage: 1,
      totalPages: 1,
      filters: {},
      indicators: {},
    });
    mapPainelPurchaseVoucherListExportRows.mockReturnValue([
      ["ID", "Voucher"],
      ["9001", "ABC-123"],
    ]);
    renderPainelPurchaseListExportTable.mockReturnValue(
      "<table><tr><td>9001</td></tr></table>",
    );

    const { GET } = await import(
      "@/app/api/painel/compras/vouchers/export/route"
    );
    const response = await GET(
      new Request("https://example.com/api/painel/compras/vouchers/export"),
    );
    const body = await response.text();

    expect(listPainelPurchaseVouchers).toHaveBeenCalledWith({
      page: "1",
      filters: {},
      allRows: true,
    });
    expect(mapPainelPurchaseVoucherListExportRows).toHaveBeenCalled();
    expect(renderPainelPurchaseListExportTable).toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toContain(
      'attachment; filename="compras-vouchers.xls"',
    );
    expect(body).toContain("<td>9001</td>");
  });
});
