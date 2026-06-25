import { beforeEach, describe, expect, it, vi } from "vitest";

const payPainelCodIndicaCashback = vi.fn();

vi.mock("@/lib/painel-cod-indica", () => ({
  asPainelCodIndicaError: (error: unknown) => error,
  payPainelCodIndicaCashback,
}));

vi.mock("@/lib/painel-api-auth", () => ({
  requirePainelApiAccess: vi.fn(async () => ({
    ok: true,
    legacyResources: ["vis_indica"],
    session: {
      actorCpf: "52998224725",
      actorName: "Gestor Teste",
      legacyRoleId: 1,
    },
  })),
}));

describe("api/painel/cod-indica/[codigo]/cashback/pagar", () => {
  beforeEach(() => {
    payPainelCodIndicaCashback.mockReset();
  });

  it("encaminha o pagamento com ator da sessao", async () => {
    payPainelCodIndicaCashback.mockResolvedValue({ message: "ok" });
    const { POST } = await import(
      "@/app/api/painel/cod-indica/[codigo]/cashback/pagar/route"
    );
    const response = await POST(
      new Request("https://example.test/api/painel/cod-indica/ABC123/cashback/pagar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          values: { vlpagamento: "10,00", senha_admin: "12345", dsobservacao: "Teste" },
        }),
      }),
      { params: Promise.resolve({ codigo: "ABC123" }) },
    );

    expect(response.status).toBe(200);
    expect(payPainelCodIndicaCashback).toHaveBeenCalledWith(
      "ABC123",
      { vlpagamento: "10,00", senha_admin: "12345", dsobservacao: "Teste" },
      {
        roleId: 1,
        cpf: "52998224725",
        name: "Gestor Teste",
      },
    );
  });
});
