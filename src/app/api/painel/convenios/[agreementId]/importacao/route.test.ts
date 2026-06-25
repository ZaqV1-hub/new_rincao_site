import { beforeEach, describe, expect, it, vi } from "vitest";

const getPainelConvenioImportState = vi.fn();

vi.mock("@/lib/painel-convenio-import", () => ({
  asPainelConvenioImportError: (error: unknown) => error,
  getPainelConvenioImportState,
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

describe("api/painel/convenios/[agreementId]/importacao", () => {
  beforeEach(() => {
    getPainelConvenioImportState.mockReset();
  });

  it("retorna o estado staged da importacao", async () => {
    getPainelConvenioImportState.mockResolvedValue({ importId: "abc" });
    const { GET } = await import(
      "@/app/api/painel/convenios/[agreementId]/importacao/route"
    );
    const response = await GET(
      new Request(
        "https://example.test/api/painel/convenios/7/importacao?importId=abc",
      ),
      { params: Promise.resolve({ agreementId: "7" }) },
    );

    expect(response.status).toBe(200);
    expect(getPainelConvenioImportState).toHaveBeenCalledWith({
      agreementId: "7",
      importId: "abc",
    });
  });
});
