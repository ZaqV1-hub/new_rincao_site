import { beforeEach, describe, expect, it, vi } from "vitest";

const getPainelConvenioImportLog = vi.fn();

vi.mock("@/lib/painel-convenio-import", () => ({
  asPainelConvenioImportError: (error: unknown) => error,
  getPainelConvenioImportLog,
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

describe("api/painel/convenios/[agreementId]/importacao/log", () => {
  beforeEach(() => {
    getPainelConvenioImportLog.mockReset();
  });

  it("retorna o log da importacao staged", async () => {
    getPainelConvenioImportLog.mockResolvedValue("Linha 2: erro");
    const { GET } = await import(
      "@/app/api/painel/convenios/[agreementId]/importacao/log/route"
    );
    const response = await GET(
      new Request("https://example.test/api/painel/convenios/7/importacao/log?importId=abc"),
      { params: Promise.resolve({ agreementId: "7" }) },
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("Linha 2: erro");
    expect(getPainelConvenioImportLog).toHaveBeenCalledWith({
      agreementId: "7",
      importId: "abc",
    });
  });
});
