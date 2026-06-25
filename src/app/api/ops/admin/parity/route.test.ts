import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticateOperationsRequest = vi.fn();

vi.mock("@/lib/ops-auth", () => ({
  authenticateOperationsRequest,
}));

describe("ops/admin/parity BFF route", () => {
  beforeEach(() => {
    authenticateOperationsRequest.mockReset();
  });

  it("requires the administrative operations permission", async () => {
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

    const { GET } = await import("@/app/api/ops/admin/parity/route");
    const response = await GET(
      new Request("https://example.com/api/ops/admin/parity"),
    );
    const body = await response.json();

    expect(authenticateOperationsRequest).toHaveBeenCalledWith(
      expect.any(Request),
      { requiredPermission: "ops.admin" },
    );
    expect(response.status).toBe(403);
    expect(body.ok).toBe(false);
  });

  it("returns the phase 7 parity matrix", async () => {
    authenticateOperationsRequest.mockReturnValueOnce({
      ok: true,
      role: "admin",
      permissions: ["ops.admin"],
      actorName: "Gestor",
      actorCpf: "52998224725",
    });

    const { GET } = await import("@/app/api/ops/admin/parity/route");
    const response = await GET(
      new Request("https://example.com/api/ops/admin/parity"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.phase).toBe(7);
    expect(body.data.summary.writeCutoverReady).toBe(true);
    expect(body.data.summary.pending).toBe(0);
    expect(body.data.blockers).toHaveLength(0);
  });
});
