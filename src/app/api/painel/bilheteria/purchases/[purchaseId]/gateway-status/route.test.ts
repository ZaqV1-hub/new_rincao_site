import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePainelApiAccess = vi.fn();
const getPainelBilheteriaGatewayStatus = vi.fn();
const asPainelBilheteriaError = vi.fn();

vi.mock("@/lib/painel-api-auth", () => ({
  requirePainelApiAccess,
}));

vi.mock("@/lib/painel-bilheteria", () => ({
  getPainelBilheteriaGatewayStatus,
  asPainelBilheteriaError,
}));

describe("painel/bilheteria/purchases/[purchaseId]/gateway-status BFF route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requirePainelApiAccess.mockResolvedValue({
      ok: true,
      legacyResources: ["vis_bilhet", "vis_compra"],
      session: {
        actorName: "Operador Sessao",
        actorCpf: "52998224725",
      },
    });
    asPainelBilheteriaError.mockImplementation((error: unknown) => error);
  });

  it("requires ops.purchases permission", async () => {
    requirePainelApiAccess.mockResolvedValueOnce({
      ok: false,
      response: Response.json(
        {
          ok: false,
          error: {
            code: "operations_forbidden",
            message: "Sessao operacional sem permissao para esta acao.",
          },
        },
        { status: 403 },
      ),
    });

    const { GET } = await import(
      "@/app/api/painel/bilheteria/purchases/[purchaseId]/gateway-status/route"
    );
    const response = await GET(
      new Request("https://example.com/api/painel/bilheteria/purchases/10/gateway-status"),
      {
        params: Promise.resolve({ purchaseId: "10" }),
      },
    );

    expect(response.status).toBe(403);
    expect(requirePainelApiAccess).toHaveBeenCalledWith(
      expect.any(Request),
      ["vis_compra", "vis_bilhet"],
    );
  });

  it("returns manual gateway status for the purchase", async () => {
    getPainelBilheteriaGatewayStatus.mockResolvedValue({
      purchaseId: 10,
      configured: true,
      paymentId: "pay-10",
      reference: "10",
      ledgerStatus: 1,
      ledgerStatusLabel: "Aguardando pagamento",
      ledgerUpdatedAt: "2026-04-28T12:00:00.000Z",
      consultResult: "ok",
      gatewayStatus: 2,
      gatewayStatusLabel: "Em analise",
      purchaseStatus: "pend",
      message: "Consulta manual do gateway executada com sucesso.",
    });

    const { GET } = await import(
      "@/app/api/painel/bilheteria/purchases/[purchaseId]/gateway-status/route"
    );
    const response = await GET(
      new Request("https://example.com/api/painel/bilheteria/purchases/10/gateway-status"),
      {
        params: Promise.resolve({ purchaseId: "10" }),
      },
    );
    const body = await response.json();

    expect(requirePainelApiAccess).toHaveBeenCalledWith(
      expect.any(Request),
      ["vis_compra", "vis_bilhet"],
    );
    expect(getPainelBilheteriaGatewayStatus).toHaveBeenCalledWith(10);
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.purchaseId).toBe(10);
    expect(body.data.gatewayStatusLabel).toBe("Em analise");
  });
});
