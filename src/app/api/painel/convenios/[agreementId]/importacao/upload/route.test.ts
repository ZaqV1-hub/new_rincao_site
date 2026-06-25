import { beforeEach, describe, expect, it, vi } from "vitest";

const stagePainelConvenioImport = vi.fn();

vi.mock("@/lib/painel-convenio-import", () => ({
  asPainelConvenioImportError: (error: unknown) => error,
  stagePainelConvenioImport,
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

describe("api/painel/convenios/[agreementId]/importacao/upload", () => {
  beforeEach(() => {
    stagePainelConvenioImport.mockReset();
  });

  it("faz o stage do csv enviado", async () => {
    stagePainelConvenioImport.mockResolvedValue({ importId: "abc" });
    const { POST } = await import(
      "@/app/api/painel/convenios/[agreementId]/importacao/upload/route"
    );

    const formData = new FormData();
    formData.set(
      "qqfile",
      new File(["CPF;QTD. COMPRA POR DIA;DATA INICIO;DATA FIM;STATUS"], "modelo.csv", {
        type: "text/csv",
      }),
    );

    const response = await POST(
      new Request("https://example.test/api/painel/convenios/7/importacao/upload", {
        method: "POST",
        body: formData,
      }),
      { params: Promise.resolve({ agreementId: "7" }) },
    );

    expect(response.status).toBe(200);
    expect(stagePainelConvenioImport).toHaveBeenCalledWith(
      expect.objectContaining({
        agreementId: "7",
        actor: {
          name: "Teste",
          cpf: "00000000000",
        },
      }),
    );
  });
});
