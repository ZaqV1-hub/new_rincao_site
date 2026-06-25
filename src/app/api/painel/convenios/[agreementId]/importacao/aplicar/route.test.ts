import { beforeEach, describe, expect, it, vi } from "vitest";

const applyPainelConvenioImport = vi.fn();

vi.mock("@/lib/painel-convenio-import", () => ({
  applyPainelConvenioImport,
  asPainelConvenioImportError: (error: unknown) => error,
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

describe("api/painel/convenios/[agreementId]/importacao/aplicar", () => {
  beforeEach(() => {
    applyPainelConvenioImport.mockReset();
  });

  it("aplica a importacao staged", async () => {
    applyPainelConvenioImport.mockResolvedValue({
      importId: "abc",
      result: { message: "Importacao finalizada com sucesso." },
    });
    const { POST } = await import(
      "@/app/api/painel/convenios/[agreementId]/importacao/aplicar/route"
    );
    const response = await POST(
      new Request("https://example.test/api/painel/convenios/7/importacao/aplicar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ importId: "abc" }),
      }),
      { params: Promise.resolve({ agreementId: "7" }) },
    );

    expect(response.status).toBe(200);
    expect(applyPainelConvenioImport).toHaveBeenCalledWith({
      agreementId: "7",
      importId: "abc",
      actor: {
        name: "Teste",
        cpf: "00000000000",
      },
    });
  });
});
