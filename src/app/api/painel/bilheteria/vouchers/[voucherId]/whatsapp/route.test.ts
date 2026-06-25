import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePainelApiAccess = vi.fn();
const sendPainelBilheteriaVoucherWhatsapp = vi.fn();
const asPainelBilheteriaError = vi.fn();

vi.mock("@/lib/painel-api-auth", () => ({
  requirePainelApiAccess,
}));

vi.mock("@/lib/painel-bilheteria", () => ({
  sendPainelBilheteriaVoucherWhatsapp,
  asPainelBilheteriaError,
}));

describe("painel/bilheteria/vouchers/[voucherId]/whatsapp BFF route", () => {
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

    const { POST } = await import(
      "@/app/api/painel/bilheteria/vouchers/[voucherId]/whatsapp/route"
    );
    const response = await POST(
      new Request("https://example.com/api/painel/bilheteria/vouchers/90/whatsapp", {
        method: "POST",
        body: JSON.stringify({}),
      }),
      {
        params: Promise.resolve({ voucherId: "90" }),
      },
    );

    expect(response.status).toBe(403);
    expect(requirePainelApiAccess).toHaveBeenCalledWith(
      expect.any(Request),
      ["vis_compra", "vis_bilhet"],
    );
  });

  it("sends one voucher by whatsapp using painel ACL and actor data", async () => {
    sendPainelBilheteriaVoucherWhatsapp.mockResolvedValue({
      purchaseId: 10,
      voucherId: 90,
      phoneNumber: "11999999999",
      validUntil: "2026-04-29",
      message: "Solicitacao enviada para o WhatsApp.",
      auditLogId: 7,
    });

    const { POST } = await import(
      "@/app/api/painel/bilheteria/vouchers/[voucherId]/whatsapp/route"
    );
    const response = await POST(
      new Request("https://example.com/api/painel/bilheteria/vouchers/90/whatsapp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          purchaseId: 10,
          phoneNumber: "(11) 99999-9999",
        }),
      }),
      {
        params: Promise.resolve({ voucherId: "90" }),
      },
    );
    const body = await response.json();

    expect(requirePainelApiAccess).toHaveBeenCalledWith(
      expect.any(Request),
      ["vis_compra", "vis_bilhet"],
    );
    expect(sendPainelBilheteriaVoucherWhatsapp).toHaveBeenCalledWith({
      purchaseId: 10,
      voucherId: 90,
      phoneNumber: "(11) 99999-9999",
      actor: {
        name: "Operador Sessao",
        cpf: "52998224725",
      },
    });
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.voucherId).toBe(90);
  });
});
