import { beforeEach, describe, expect, it, vi } from "vitest";

const getPainelCodIndicaMessage = vi.fn();
const savePainelCodIndicaMessage = vi.fn();

vi.mock("@/lib/painel-cod-indica", () => ({
  asPainelCodIndicaError: (error: unknown) => error,
  getPainelCodIndicaMessage,
  savePainelCodIndicaMessage,
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

describe("api/painel/cod-indica/mensagem", () => {
  beforeEach(() => {
    getPainelCodIndicaMessage.mockReset();
    savePainelCodIndicaMessage.mockReset();
  });

  it("retorna as mensagens salvas", async () => {
    getPainelCodIndicaMessage.mockResolvedValue({ codval: "A", codven: "B", codine: "C" });
    const { GET } = await import("@/app/api/painel/cod-indica/mensagem/route");
    const response = await GET(new Request("https://example.test/api/painel/cod-indica/mensagem"));

    expect(response.status).toBe(200);
  });

  it("encaminha o PUT para a atualizacao", async () => {
    savePainelCodIndicaMessage.mockResolvedValue({ message: "ok" });
    const { PUT } = await import("@/app/api/painel/cod-indica/mensagem/route");
    const response = await PUT(
      new Request("https://example.test/api/painel/cod-indica/mensagem", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          values: { codval: "A", codven: "B", codine: "C" },
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(savePainelCodIndicaMessage).toHaveBeenCalledWith({
      codval: "A",
      codven: "B",
      codine: "C",
    });
  });
});
