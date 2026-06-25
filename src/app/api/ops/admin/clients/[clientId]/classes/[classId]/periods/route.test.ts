import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticateOperationsRequest = vi.fn();
const authorizePainelApiAccess = vi.fn();
const createClientPeriod = vi.fn();
const updateClientPeriod = vi.fn();
const deleteClientPeriod = vi.fn();
const asOpsClientEducationError = vi.fn();

vi.mock("@/lib/ops-auth", () => ({
  authenticateOperationsRequest,
}));

vi.mock("@/lib/painel-api-auth", () => ({
  authorizePainelApiAccess,
}));

vi.mock("@/lib/ops-client-education", () => ({
  createClientPeriod,
  updateClientPeriod,
  deleteClientPeriod,
  asOpsClientEducationError,
}));

describe("ops/admin/clients/[clientId]/classes/[classId]/periods route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateOperationsRequest.mockReturnValue({ ok: true });
    authorizePainelApiAccess.mockResolvedValue({ ok: true, legacyResources: [] });
    asOpsClientEducationError.mockImplementation((error: Error) => error);
  });

  it("creates, updates and deletes periods", async () => {
    createClientPeriod.mockResolvedValue({ id: 1, action: "create" });
    updateClientPeriod.mockResolvedValue({ id: 1, action: "update" });
    deleteClientPeriod.mockResolvedValue({ id: 1, action: "delete" });

    const { POST, PATCH, DELETE } = await import(
      "@/app/api/ops/admin/clients/[clientId]/classes/[classId]/periods/route"
    );
    const context = {
      params: Promise.resolve({ clientId: "10", classId: "4" }),
    };

    await POST(
      new Request("https://example.com", {
        method: "POST",
        body: JSON.stringify({
          reason: "Cadastro",
          values: { name: "Manha", order: 1 },
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

    expect(createClientPeriod).toHaveBeenCalledWith({
      clientId: "10",
      classId: "4",
      id: null,
      reason: "Cadastro",
      values: { name: "Manha", order: 1 },
      actor: { name: null, cpf: null },
    });
    expect(updateClientPeriod).toHaveBeenCalledWith({
      clientId: "10",
      classId: "4",
      id: 1,
      reason: "Ajuste",
      values: { status: "ina" },
      actor: { name: null, cpf: null },
    });
    expect(deleteClientPeriod).toHaveBeenCalledWith({
      clientId: "10",
      classId: "4",
      id: 1,
      reason: "Remocao",
      values: {},
      actor: { name: null, cpf: null },
    });
  });
});
