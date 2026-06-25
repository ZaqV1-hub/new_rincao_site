import { beforeEach, describe, expect, it, vi } from "vitest";

const cancelPainelConvenioImport = vi.fn();

vi.mock("@/lib/painel-convenio-import", () => ({
  asPainelConvenioImportError: (error: unknown) => error,
  cancelPainelConvenioImport,
}));

vi.mock("@/lib/painel-api-auth", () => ({
  requirePainelApiAccess: vi.fn(async () => ({
    ok: true,
    legacyResources: ["vis_conve"],
    session: {
      authSource: "panel",
      actorName: "Teste",
      actorCpf: "00000000000",
    },
  })),
}));

describe("api/painel/convenios/[agreementId]/importacao/cancelar", () => {
  beforeEach(() => {
    cancelPainelConvenioImport.mockReset();
  });

  it("cancela a importacao staged", async () => {
    cancelPainelConvenioImport.mockResolvedValue({
      importId: "abc",
      message: "Importacao cancelada com sucesso.",
    });
    const { POST } = await import(
      "@/app/api/painel/convenios/[agreementId]/importacao/cancelar/route"
    );
    const response = await POST(
      new Request("https://example.test/api/painel/convenios/7/importacao/cancelar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ importId: "abc" }),
      }),
      { params: Promise.resolve({ agreementId: "7" }) },
    );

    expect(response.status).toBe(200);
    expect(cancelPainelConvenioImport).toHaveBeenCalledWith({
      agreementId: "7",
      importId: "abc",
    });
  });
});
