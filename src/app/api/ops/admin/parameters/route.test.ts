import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticateOperationsRequest = vi.fn();
const listOpsAdminParameters = vi.fn();
const updateOpsAdminParameters = vi.fn();
const asOpsAdminParametersError = vi.fn();

vi.mock("@/lib/ops-auth", () => ({
  authenticateOperationsRequest,
}));

vi.mock("@/lib/ops-admin-parameters", () => ({
  listOpsAdminParameters,
  updateOpsAdminParameters,
  asOpsAdminParametersError,
}));

describe("ops/admin/parameters BFF route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateOperationsRequest.mockReturnValue({ ok: true });
    asOpsAdminParametersError.mockImplementation((error: Error) => error);
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

    const { GET } = await import("@/app/api/ops/admin/parameters/route");
    const response = await GET(
      new Request("https://example.com/api/ops/admin/parameters"),
    );

    expect(authenticateOperationsRequest).toHaveBeenCalledWith(
      expect.any(Request),
      { requiredPermission: "ops.admin" },
    );
    expect(response.status).toBe(403);
  });

  it("lists administrative parameters", async () => {
    listOpsAdminParameters.mockResolvedValue([
      {
        group: "msgper",
        id: "codval",
        value: "Codigo aplicado",
        persisted: true,
      },
    ]);

    const { GET } = await import("@/app/api/ops/admin/parameters/route");
    const response = await GET(
      new Request("https://example.com/api/ops/admin/parameters"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      data: [
        {
          group: "msgper",
          id: "codval",
          value: "Codigo aplicado",
          persisted: true,
        },
      ],
    });
  });

  it("updates administrative parameters with actor and reason", async () => {
    updateOpsAdminParameters.mockResolvedValue({
      action: "update",
      parameters: [],
      auditLogId: 22,
      message: "Parametros atualizados com sucesso.",
    });

    const { PATCH } = await import("@/app/api/ops/admin/parameters/route");
    const response = await PATCH(
      new Request("https://example.com/api/ops/admin/parameters", {
        method: "PATCH",
        body: JSON.stringify({
          reason: "Ajuste de mensagem",
          parameters: [
            {
              group: "msgper",
              id: "codval",
              value: "Codigo ##cod## aplicado",
            },
          ],
          actor: {
            name: "Gestor",
            cpf: "52998224725",
          },
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(updateOpsAdminParameters).toHaveBeenCalledWith({
      reason: "Ajuste de mensagem",
      parameters: [
        {
          group: "msgper",
          id: "codval",
          value: "Codigo ##cod## aplicado",
        },
      ],
      actor: {
        name: "Gestor",
        cpf: "52998224725",
      },
    });
    expect(body.data.auditLogId).toBe(22);
  });
});
