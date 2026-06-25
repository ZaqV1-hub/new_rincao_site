import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePainelApiAccess = vi.fn();
const payPainelBilheteriaReservation = vi.fn();
const asPainelBilheteriaError = vi.fn();

vi.mock("@/lib/painel-api-auth", () => ({
  requirePainelApiAccess,
}));

vi.mock("@/lib/painel-bilheteria", () => ({
  payPainelBilheteriaReservation,
  asPainelBilheteriaError,
}));

describe("painel/bilheteria/reservations/[purchaseId]/pay BFF route", () => {
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
      "@/app/api/painel/bilheteria/reservations/[purchaseId]/pay/route"
    );
    const response = await POST(
      new Request("https://example.com/api/painel/bilheteria/reservations/10/pay", {
        method: "POST",
        body: JSON.stringify({}),
      }),
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

  it("pays a reservation using painel ACL and actor data", async () => {
    payPainelBilheteriaReservation.mockResolvedValue({
      purchaseId: 10,
      status: "conc",
      totalValue: "99.80",
      paymentMethods: ["dinhe"],
      message: "Pagamento da reserva confirmado com sucesso.",
      alreadyPaid: false,
      auditLogId: 7,
    });

    const { POST } = await import(
      "@/app/api/painel/bilheteria/reservations/[purchaseId]/pay/route"
    );
    const response = await POST(
      new Request("https://example.com/api/painel/bilheteria/reservations/10/pay", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          payments: [
            {
              method: "dinhe",
              value: "99,80",
            },
          ],
        }),
      }),
      {
        params: Promise.resolve({ purchaseId: "10" }),
      },
    );
    const body = await response.json();

    expect(requirePainelApiAccess).toHaveBeenCalledWith(
      expect.any(Request),
      ["vis_compra", "vis_bilhet"],
    );
    expect(payPainelBilheteriaReservation).toHaveBeenCalledWith({
      purchaseId: 10,
      payments: [
        {
          method: "dinhe",
          value: "99,80",
        },
      ],
      actor: {
        name: "Operador Sessao",
        cpf: "52998224725",
      },
    });
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.purchaseId).toBe(10);
  });
});
