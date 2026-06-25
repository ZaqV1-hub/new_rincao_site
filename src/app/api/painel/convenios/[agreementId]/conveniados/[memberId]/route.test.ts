import { beforeEach, describe, expect, it, vi } from "vitest";

const getPainelConvenioMemberDetail = vi.fn();
const updatePainelConvenioMember = vi.fn();

vi.mock("@/lib/painel-convenio-members", () => ({
  asPainelConvenioMembersError: (error: unknown) => error,
  getPainelConvenioMemberDetail,
  updatePainelConvenioMember,
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

describe("api/painel/convenios/[agreementId]/conveniados/[memberId]", () => {
  beforeEach(() => {
    getPainelConvenioMemberDetail.mockReset();
    updatePainelConvenioMember.mockReset();
  });

  it("encaminha o GET para o detalhe do conveniado", async () => {
    getPainelConvenioMemberDetail.mockResolvedValue({ cpf: "12345678901" });
    const { GET } = await import(
      "@/app/api/painel/convenios/[agreementId]/conveniados/[memberId]/route"
    );
    const response = await GET(
      new Request("https://example.test/api/painel/convenios/7/conveniados/123"),
      { params: Promise.resolve({ agreementId: "7", memberId: "12345678901" }) },
    );

    expect(response.status).toBe(200);
    expect(getPainelConvenioMemberDetail).toHaveBeenCalledWith({
      agreementId: "7",
      memberId: "12345678901",
    });
  });

  it("encaminha o PUT para a edicao do conveniado", async () => {
    updatePainelConvenioMember.mockResolvedValue({ id: "12345678901" });
    const { PUT } = await import(
      "@/app/api/painel/convenios/[agreementId]/conveniados/[memberId]/route"
    );
    const response = await PUT(
      new Request("https://example.test/api/painel/convenios/7/conveniados/123", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ values: { cpf: "12345678901" } }),
      }),
      { params: Promise.resolve({ agreementId: "7", memberId: "12345678901" }) },
    );

    expect(response.status).toBe(200);
    expect(updatePainelConvenioMember).toHaveBeenCalledWith({
      agreementId: "7",
      memberId: "12345678901",
      values: { cpf: "12345678901" },
    });
  });
});
