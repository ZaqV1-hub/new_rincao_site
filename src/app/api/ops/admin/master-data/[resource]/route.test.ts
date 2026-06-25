import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticateOperationsRequest = vi.fn();
const listOpsAdminMasterData = vi.fn();
const createOpsAdminMasterData = vi.fn();
const updateOpsAdminMasterData = vi.fn();
const deleteOpsAdminMasterData = vi.fn();
const asOpsAdminMasterDataError = vi.fn();

vi.mock("@/lib/ops-auth", () => ({
  authenticateOperationsRequest,
}));

vi.mock("@/lib/ops-admin-master-data", () => ({
  listOpsAdminMasterData,
  createOpsAdminMasterData,
  updateOpsAdminMasterData,
  deleteOpsAdminMasterData,
  asOpsAdminMasterDataError,
}));

describe("ops/admin/master-data/[resource] BFF route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateOperationsRequest.mockReturnValue({ ok: true });
    asOpsAdminMasterDataError.mockImplementation((error: Error) => error);
  });

  it("requires ops.admin permission", async () => {
    authenticateOperationsRequest.mockReturnValueOnce({
      ok: false,
      response: Response.json(
        {
          ok: false,
          error: {
            code: "operations_forbidden",
            message: "Sessao operacional sem permissao para esta acao.",
          },
        },
        { status: 403 },
      ),
    });

    const { GET } = await import(
      "@/app/api/ops/admin/master-data/[resource]/route"
    );
    const response = await GET(
      new Request("https://example.com/api/ops/admin/master-data/price-tables"),
      {
        params: Promise.resolve({ resource: "price-tables" }),
      },
    );

    expect(authenticateOperationsRequest).toHaveBeenCalledWith(
      expect.any(Request),
      { requiredPermission: "ops.admin" },
    );
    expect(response.status).toBe(403);
  });

  it("lists a configured administrative resource", async () => {
    listOpsAdminMasterData.mockResolvedValue({
      resource: "price-tables",
      items: [{ idtabpreco: 1, nmtabpreco: "Padrao" }],
    });

    const { GET } = await import(
      "@/app/api/ops/admin/master-data/[resource]/route"
    );
    const response = await GET(
      new Request("https://example.com/api/ops/admin/master-data/price-tables"),
      {
        params: Promise.resolve({ resource: "price-tables" }),
      },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(listOpsAdminMasterData).toHaveBeenCalledWith("price-tables");
    expect(body).toEqual({
      ok: true,
      data: {
        resource: "price-tables",
        items: [{ idtabpreco: 1, nmtabpreco: "Padrao" }],
      },
    });
  });

  it("creates with actor and values payload", async () => {
    createOpsAdminMasterData.mockResolvedValue({
      resource: "information",
      id: 9,
      action: "create",
      item: { idinformacao: 9, nome: "Aviso" },
      auditLogId: 15,
      message: "Cadastro criado com sucesso.",
    });

    const { POST } = await import(
      "@/app/api/ops/admin/master-data/[resource]/route"
    );
    const response = await POST(
      new Request("https://example.com/api/ops/admin/master-data/information", {
        method: "POST",
        body: JSON.stringify({
          reason: "Migracao do painel",
          values: {
            name: "Aviso",
            text: "Texto",
          },
          actor: {
            name: "Gestor",
            cpf: "52998224725",
          },
        }),
      }),
      {
        params: Promise.resolve({ resource: "information" }),
      },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(createOpsAdminMasterData).toHaveBeenCalledWith("information", {
      id: null,
      reason: "Migracao do painel",
      values: {
        name: "Aviso",
        text: "Texto",
      },
      actor: {
        name: "Gestor",
        cpf: "52998224725",
      },
    });
    expect(body.data.id).toBe(9);
  });

  it("updates and deletes by id", async () => {
    updateOpsAdminMasterData.mockResolvedValue({
      resource: "agreements",
      id: 4,
      action: "update",
      item: { idconvenio: 4 },
      auditLogId: 16,
      message: "Cadastro alterado com sucesso.",
    });
    deleteOpsAdminMasterData.mockResolvedValue({
      resource: "agreements",
      id: 4,
      action: "delete",
      item: null,
      auditLogId: 17,
      message: "Cadastro excluido com sucesso.",
    });

    const { PATCH, DELETE } = await import(
      "@/app/api/ops/admin/master-data/[resource]/route"
    );
    const context = {
      params: Promise.resolve({ resource: "agreements" }),
    };
    const patchResponse = await PATCH(
      new Request("https://example.com/api/ops/admin/master-data/agreements", {
        method: "PATCH",
        body: JSON.stringify({
          id: 4,
          reason: "Ajuste",
          values: { status: "ina" },
        }),
      }),
      context,
    );
    const deleteResponse = await DELETE(
      new Request("https://example.com/api/ops/admin/master-data/agreements", {
        method: "DELETE",
        body: JSON.stringify({
          id: 4,
          reason: "Remocao",
        }),
      }),
      context,
    );

    expect(patchResponse.status).toBe(200);
    expect(deleteResponse.status).toBe(200);
    expect(updateOpsAdminMasterData).toHaveBeenCalledWith("agreements", {
      id: 4,
      reason: "Ajuste",
      values: { status: "ina" },
      actor: {
        name: null,
        cpf: null,
      },
    });
    expect(deleteOpsAdminMasterData).toHaveBeenCalledWith("agreements", {
      id: 4,
      reason: "Remocao",
      values: {},
      actor: {
        name: null,
        cpf: null,
      },
    });
  });

  it("preserves textual identifiers for cpf-based resources", async () => {
    updateOpsAdminMasterData.mockResolvedValue({
      resource: "site-users",
      id: "52998224725",
      action: "update",
      item: { cpf: "52998224725" },
      auditLogId: 18,
      message: "Cadastro alterado com sucesso.",
    });

    const { PATCH } = await import(
      "@/app/api/ops/admin/master-data/[resource]/route"
    );
    const response = await PATCH(
      new Request("https://example.com/api/ops/admin/master-data/site-users", {
        method: "PATCH",
        body: JSON.stringify({
          id: "52998224725",
          reason: "Ajuste de e-mail",
          values: { email: "ajuste@site.test" },
        }),
      }),
      {
        params: Promise.resolve({ resource: "site-users" }),
      },
    );

    expect(response.status).toBe(200);
    expect(updateOpsAdminMasterData).toHaveBeenCalledWith("site-users", {
      id: "52998224725",
      reason: "Ajuste de e-mail",
      values: { email: "ajuste@site.test" },
      actor: {
        name: null,
        cpf: null,
      },
    });
  });
});
