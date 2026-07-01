import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePainelApiAccess = vi.fn();
const sendPurchaseTicketsWhatsApp = vi.fn();

vi.mock("@/lib/painel-api-auth", () => ({
  requirePainelApiAccess,
}));

vi.mock("@/lib/ticket-service", () => ({
  sendPurchaseTicketsWhatsApp,
}));

describe("painel/bilheteria/purchases/[purchaseId]/whatsapp BFF route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requirePainelApiAccess.mockResolvedValue({
      ok: true,
      legacyResources: ["vis_bilhet"],
      session: {
        actorName: "Operador Sessao",
        actorCpf: "52998224725",
      },
    });
  });

  it("reports queued whatsapp delivery when the ticket api accepts asynchronously", async () => {
    sendPurchaseTicketsWhatsApp.mockResolvedValue({
      status: "sent",
      purchaseId: 171794,
      sentVoucherIds: [563797],
      deliveryStatus: "queued",
      upstreamStatus: 202,
    });

    const { POST } = await import(
      "@/app/api/painel/bilheteria/purchases/[purchaseId]/whatsapp/route"
    );
    const response = await POST(
      new Request(
        "https://example.com/api/painel/bilheteria/purchases/171794/whatsapp",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            phoneNumber: "11980461548",
            voucherIds: [563797],
          }),
        },
      ),
      {
        params: Promise.resolve({ purchaseId: "171794" }),
      },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data).toMatchObject({
      purchaseId: 171794,
      sentVoucherIds: [563797],
      deliveryStatus: "queued",
      upstreamStatus: 202,
      message: "Solicitacao de envio por WhatsApp enfileirada.",
    });
  });
});
