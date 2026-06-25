import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticateOperationsRequest = vi.fn();
const authorizePainelApiAccess = vi.fn();
const getClientEducationSummary = vi.fn();
const createClientClass = vi.fn();
const updateClientClass = vi.fn();
const deleteClientClass = vi.fn();
const asOpsClientEducationError = vi.fn();

vi.mock("@/lib/ops-auth", () => ({
  authenticateOperationsRequest,
}));

vi.mock("@/lib/painel-api-auth", () => ({
  authorizePainelApiAccess,
}));

vi.mock("@/lib/ops-client-education", () => ({
  getClientEducationSummary,
  createClientClass,
  updateClientClass,
  deleteClientClass,
  asOpsClientEducationError,
}));

describe("ops/admin/clients/[clientId]/classes route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateOperationsRequest.mockReturnValue({ ok: true });
    authorizePainelApiAccess.mockResolvedValue({ ok: true, legacyResources: [] });
    asOpsClientEducationError.mockImplementation((error: Error) => error);
  });

  it("loads the client education summary", async () => {
    getClientEducationSummary.mockResolvedValue({
      client: { id: 10, name: "Colegio Alfa" },
      classes: [],
      standardPeriodOptions: [],
    });

    const { GET } = await import(
      "@/app/api/ops/admin/clients/[clientId]/classes/route"
    );
    const response = await GET(
      new Request("https://example.com/api/ops/admin/clients/10/classes"),
      {
        params: Promise.resolve({ clientId: "10" }),
      },
    );

    expect(response.status).toBe(200);
    expect(getClientEducationSummary).toHaveBeenCalledWith("10");
  });

  it("creates, updates and deletes client classes", async () => {
    createClientClass.mockResolvedValue({ id: 1, action: "create" });
    updateClientClass.mockResolvedValue({ id: 1, action: "update" });
    deleteClientClass.mockResolvedValue({ id: 1, action: "delete" });

    const { POST, PATCH, DELETE } = await import(
      "@/app/api/ops/admin/clients/[clientId]/classes/route"
    );
    const context = {
      params: Promise.resolve({ clientId: "10" }),
    };

    await POST(
      new Request("https://example.com", {
        method: "POST",
        body: JSON.stringify({
          reason: "Cadastro",
          values: { name: "Turma A", defaultPeriods: ["manha"] },
        }),
      }),
      context,
    );
    await PATCH(
      new Request("https://example.com", {
        method: "PATCH",
        body: JSON.stringify({
          id: 1,
          reason: "Ajuste",
          values: { status: "ina" },
        }),
      }),
      context,
    );
    await DELETE(
      new Request("https://example.com", {
        method: "DELETE",
        body: JSON.stringify({
          id: 1,
          reason: "Remocao",
        }),
      }),
      context,
    );

    expect(createClientClass).toHaveBeenCalledWith({
      clientId: "10",
      id: null,
      reason: "Cadastro",
      values: { name: "Turma A", defaultPeriods: ["manha"] },
      actor: { name: null, cpf: null },
    });
    expect(updateClientClass).toHaveBeenCalledWith({
      clientId: "10",
      id: 1,
      reason: "Ajuste",
      values: { status: "ina" },
      actor: { name: null, cpf: null },
    });
    expect(deleteClientClass).toHaveBeenCalledWith({
      clientId: "10",
      id: 1,
      reason: "Remocao",
      values: {},
      actor: { name: null, cpf: null },
    });
  });
});
