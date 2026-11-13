import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePainelApiAccess = vi.fn();
const getPainelPurchaseDetail = vi.fn();

vi.mock("@/lib/painel-api-auth", () => ({
  requirePainelApiAccess,
}));

vi.mock("@/lib/painel-compras", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/painel-compras")>(),
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
      "vis_compra",
    );
    expect(getPainelPurchaseDetail).toHaveBeenCalledWith(551);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(body).toEqual({
      ok: true,
      data: {
        purchaseId: 551,
        typeLabel: "Compra",
        vouchers: [],
      },
    });
  });
  it.each(["0", "-1", "1.2", "1e3", " 1", "01", "9007199254740992"])("rejects non-canonical ID %s", async (purchaseId) => {
    requirePainelApiAccess.mockResolvedValue({ ok: true });
    const { GET } = await import("./route");
    const response = await GET(new Request("https://example.com/api/painel/compras/x"), { params: Promise.resolve({ purchaseId }) });
    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(getPainelPurchaseDetail).not.toHaveBeenCalled();
  });
  it.each([401,403])("preserves strict authentication rejection %s privately", async (status) => {
    requirePainelApiAccess.mockResolvedValue({ ok: false, response: Response.json({ ok: false }, { status }) });
    const { GET } = await import("./route");
    const response = await GET(new Request("https://example.com/api/painel/compras/1"), { params: Promise.resolve({ purchaseId: "1" }) });
    expect(response.status).toBe(status);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(getPainelPurchaseDetail).not.toHaveBeenCalled();
  });
  it("returns private errors without logging purchase contents", async () => {
    requirePainelApiAccess.mockResolvedValue({ ok: true });
    getPainelPurchaseDetail.mockRejectedValue({ code: "purchase_not_found", message: "Compra nao encontrada.", status: 404, phone: "11999999999" });
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { GET } = await import("./route");
    const response = await GET(new Request("https://example.com/api/painel/compras/1"), { params: Promise.resolve({ purchaseId: "1" }) });
    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(JSON.stringify(log.mock.calls)).not.toContain("11999999999");
    log.mockRestore();
  });
});
