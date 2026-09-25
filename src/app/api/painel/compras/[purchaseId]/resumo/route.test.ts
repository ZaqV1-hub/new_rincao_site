import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  requirePainelApiAccess: vi.fn(),
  getPainelPurchaseDetail: vi.fn(),
  renderPainelPurchaseSummaryPdf: vi.fn(),
}));

vi.mock("@/lib/painel-api-auth", () => ({
  requirePainelApiAccess: mocks.requirePainelApiAccess,
}));

vi.mock("@/lib/painel-compras", () => ({
  asPainelComprasError: (error: { code?: string; message?: string; status?: number }) => ({
    code: error.code ?? "failed",
    message: error.message ?? "Falha",
    status: error.status ?? 500,
  }),
  getPainelPurchaseDetail: mocks.getPainelPurchaseDetail,
}));

vi.mock("@/lib/painel-purchase-summary-pdf", () => ({
  renderPainelPurchaseSummaryPdf: mocks.renderPainelPurchaseSummaryPdf,
}));

describe("GET /api/painel/compras/[purchaseId]/resumo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePainelApiAccess.mockResolvedValue({ ok: true });
    mocks.getPainelPurchaseDetail.mockResolvedValue({ purchaseId: 551 });
    mocks.renderPainelPurchaseSummaryPdf.mockResolvedValue(Buffer.from("%PDF-1.7"));
  });

  it("requires the purchase-detail permission", async () => {
    const request = new Request("https://example.com/api/painel/compras/551/resumo");
    mocks.requirePainelApiAccess.mockResolvedValueOnce({
      ok: false,
      response: Response.json({ ok: false }, { status: 403 }),
    });

    const response = await GET(request, { params: Promise.resolve({ purchaseId: "551" }) });

    expect(response.status).toBe(403);
    expect(mocks.requirePainelApiAccess).toHaveBeenCalledWith(request, "vis_compra");
    expect(mocks.getPainelPurchaseDetail).not.toHaveBeenCalled();
  });

  it("returns the one-page summary as an inline PDF", async () => {
    const request = new Request("https://example.com/api/painel/compras/551/resumo");
    const response = await GET(request, { params: Promise.resolve({ purchaseId: "551" }) });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toContain("resumo-compra-551.pdf");
    expect(new TextDecoder().decode(await response.arrayBuffer())).toBe("%PDF-1.7");
    expect(mocks.renderPainelPurchaseSummaryPdf).toHaveBeenCalledWith({ purchaseId: 551 });
  });
});
