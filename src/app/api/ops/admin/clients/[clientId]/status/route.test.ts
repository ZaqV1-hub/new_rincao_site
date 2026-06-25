import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticateOperationsRequest = vi.fn();
const toggleClientStatus = vi.fn();
const asOpsClientEducationError = vi.fn();

vi.mock("@/lib/ops-auth", () => ({
  authenticateOperationsRequest,
}));

vi.mock("@/lib/ops-client-education", () => ({
  toggleClientStatus,
  asOpsClientEducationError,
}));

describe("ops/admin/clients/[clientId]/status route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateOperationsRequest.mockReturnValue({ ok: true });
    asOpsClientEducationError.mockImplementation((error: Error) => error);
  });

  it("toggles client status with actor payload", async () => {
    toggleClientStatus.mockResolvedValue({
      clientId: 21,
      active: false,
      auditLogId: 44,
      message: "Cliente inativado com sucesso.",
    });

    const { PATCH } = await import(
      "@/app/api/ops/admin/clients/[clientId]/status/route"
    );
    const response = await PATCH(
      new Request("https://example.com/api/ops/admin/clients/21/status", {
        method: "PATCH",
        body: JSON.stringify({
          reason: "Ajuste operacional",
          actor: { name: "Gestor", cpf: "52998224725" },
        }),
      }),
      {
        params: Promise.resolve({ clientId: "21" }),
      },
    );

    expect(response.status).toBe(200);
    expect(toggleClientStatus).toHaveBeenCalledWith({
      clientId: "21",
      reason: "Ajuste operacional",
      actor: {
        name: "Gestor",
        cpf: "52998224725",
      },
    });
  });
});
