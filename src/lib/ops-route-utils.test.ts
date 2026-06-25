import { describe, expect, it, vi } from "vitest";

const authenticateOperationsRequest = vi.fn();
const authorizePainelApiAccess = vi.fn();

vi.mock("@/lib/ops-auth", () => ({
  authenticateOperationsRequest,
}));

vi.mock("@/lib/painel-api-auth", () => ({
  authorizePainelApiAccess,
}));

describe("ops-route-utils", () => {
  it("returns the auth response without running the handler when access is denied", async () => {
    const deniedResponse = new Response("forbidden", { status: 403 });
    const execute = vi.fn();

    authenticateOperationsRequest.mockReturnValue({
      ok: false,
      response: deniedResponse,
    });

    const { runAuthorizedOpsRoute } = await import("@/lib/ops-route-utils");
    const response = await runAuthorizedOpsRoute(
      new Request("https://example.com/api/ops/admin"),
      {
        requiredPermission: "ops.admin",
      },
      execute,
    );

    expect(response).toBe(deniedResponse);
    expect(execute).not.toHaveBeenCalled();
  });

  it("runs the handler when operations and painel access are allowed", async () => {
    const okResponse = new Response("ok", { status: 200 });
    const execute = vi.fn().mockResolvedValue(okResponse);

    authenticateOperationsRequest.mockReturnValue({ ok: true });
    authorizePainelApiAccess.mockResolvedValue({ ok: true, legacyResources: [] });

    const { runAuthorizedOpsRoute } = await import("@/lib/ops-route-utils");
    const response = await runAuthorizedOpsRoute(
      new Request("https://example.com/api/ops/admin"),
      {
        requiredPermission: "ops.admin",
        painelPermissions: ["vis_clientes"],
      },
      execute,
    );

    expect(authorizePainelApiAccess).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(response).toBe(okResponse);
  });
});
