import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticateOperationsRequest = vi.fn();
const authorizePainelApiAccess = vi.fn();
const listAgreementMembers = vi.fn();
const createAgreementMember = vi.fn();
const updateAgreementMember = vi.fn();
const deleteAgreementMember = vi.fn();
const asOpsAgreementMemberError = vi.fn();

vi.mock("@/lib/ops-auth", () => ({
  authenticateOperationsRequest,
}));

vi.mock("@/lib/painel-api-auth", () => ({
  authorizePainelApiAccess,
}));

vi.mock("@/lib/ops-agreement-members", () => ({
  listAgreementMembers,
  createAgreementMember,
  updateAgreementMember,
  deleteAgreementMember,
  asOpsAgreementMemberError,
}));

describe("ops/admin/agreements/[agreementId]/members route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateOperationsRequest.mockReturnValue({ ok: true });
    authorizePainelApiAccess.mockResolvedValue({ ok: true, legacyResources: [] });
    asOpsAgreementMemberError.mockImplementation((error: Error) => error);
  });

  it("lists agreement members with query filters", async () => {
    listAgreementMembers.mockResolvedValue({
      agreementId: 7,
      agreementName: "Convenio Alfa",
      items: [],
      meta: { total: 0, filters: {} },
    });

    const { GET } = await import(
      "@/app/api/ops/admin/agreements/[agreementId]/members/route"
    );
    const response = await GET(
      new Request(
        "https://example.com/api/ops/admin/agreements/7/members?status=ati",
      ),
      {
        params: Promise.resolve({ agreementId: "7" }),
      },
    );

    expect(response.status).toBe(200);
    expect(listAgreementMembers).toHaveBeenCalledWith(
      expect.objectContaining({
        agreementId: "7",
        status: "ati",
      }),
    );
  });

  it("creates, updates and deletes members with actor payload", async () => {
    createAgreementMember.mockResolvedValue({
      agreementId: 7,
      id: "52998224725",
      action: "create",
      item: null,
      auditLogId: 1,
      message: "ok",
    });
    updateAgreementMember.mockResolvedValue({
      agreementId: 7,
      id: "52998224725",
      action: "update",
      item: null,
      auditLogId: 2,
      message: "ok",
    });
    deleteAgreementMember.mockResolvedValue({
      agreementId: 7,
      id: "52998224725",
      action: "delete",
      item: null,
      auditLogId: 3,
      message: "ok",
    });

    const { POST, PATCH, DELETE } = await import(
      "@/app/api/ops/admin/agreements/[agreementId]/members/route"
    );
    const context = {
      params: Promise.resolve({ agreementId: "7" }),
    };

    await POST(
      new Request("https://example.com", {
        method: "POST",
        body: JSON.stringify({
          reason: "Cadastro",
          values: { cpf: "52998224725" },
          actor: { name: "Gestor" },
        }),
      }),
      context,
    );
    await PATCH(
      new Request("https://example.com", {
        method: "PATCH",
        body: JSON.stringify({
          id: "52998224725",
          reason: "Ajuste",
          values: { cpf: "52998224725" },
        }),
      }),
      context,
    );
    await DELETE(
      new Request("https://example.com", {
        method: "DELETE",
        body: JSON.stringify({
          id: "52998224725",
          reason: "Remocao",
        }),
      }),
      context,
    );

    expect(createAgreementMember).toHaveBeenCalledWith(
      expect.objectContaining({
        agreementId: "7",
        actor: expect.objectContaining({ name: "Gestor" }),
      }),
    );
    expect(updateAgreementMember).toHaveBeenCalledWith(
      expect.objectContaining({
        agreementId: "7",
        id: "52998224725",
      }),
    );
    expect(deleteAgreementMember).toHaveBeenCalledWith(
      expect.objectContaining({
        agreementId: "7",
        id: "52998224725",
      }),
    );
  });
});
