import { beforeEach, describe, expect, it, vi } from "vitest";

const createPainelConvenioMember = vi.fn();
const listPainelConvenioMembers = vi.fn();

vi.mock("@/lib/painel-convenio-members", () => ({
  asPainelConvenioMembersError: (error: unknown) => error,
  createPainelConvenioMember,
  listPainelConvenioMembers,
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

describe("api/painel/convenios/[agreementId]/conveniados", () => {
  beforeEach(() => {
    createPainelConvenioMember.mockReset();
    listPainelConvenioMembers.mockReset();
  });

  it("encaminha o GET para a listagem", async () => {
    listPainelConvenioMembers.mockResolvedValue({ items: [] });
    const { GET } = await import(
      "@/app/api/painel/convenios/[agreementId]/conveniados/route"
    );
    const response = await GET(
      new Request("https://example.test/api/painel/convenios/7/conveniados"),
      { params: Promise.resolve({ agreementId: "7" }) },
    );

    expect(response.status).toBe(200);
    expect(listPainelConvenioMembers).toHaveBeenCalled();
  });

  it("encaminha o POST para o cadastro do conveniado", async () => {
    createPainelConvenioMember.mockResolvedValue({ id: "12345678901" });
    const { POST } = await import(
      "@/app/api/painel/convenios/[agreementId]/conveniados/route"
    );
    const response = await POST(
      new Request("https://example.test/api/painel/convenios/7/conveniados", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ values: { cpf: "12345678901" } }),
      }),
      { params: Promise.resolve({ agreementId: "7" }) },
    );

    expect(response.status).toBe(200);
    expect(createPainelConvenioMember).toHaveBeenCalledWith({
      agreementId: "7",
      values: { cpf: "12345678901" },
    });
  });
});
