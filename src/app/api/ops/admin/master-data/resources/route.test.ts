import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticateOperationsRequest = vi.fn();

vi.mock("@/lib/ops-auth", () => ({
  authenticateOperationsRequest,
}));

describe("ops/admin/master-data/resources BFF route", () => {
  beforeEach(() => {
    authenticateOperationsRequest.mockReset();
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
      "@/app/api/ops/admin/master-data/resources/route"
    );
    const response = await GET(
      new Request("https://example.com/api/ops/admin/master-data/resources"),
    );

    expect(response.status).toBe(403);
    expect(authenticateOperationsRequest).toHaveBeenCalledWith(
      expect.any(Request),
      { requiredPermission: "ops.admin" },
    );
  });

  it("returns the administrative resource catalog", async () => {
    authenticateOperationsRequest.mockReturnValueOnce({
      ok: true,
      role: "admin",
      permissions: ["ops.admin"],
      actorName: "Gestor",
      actorCpf: "52998224725",
    });

    const { GET } = await import(
      "@/app/api/ops/admin/master-data/resources/route"
    );
    const response = await GET(
      new Request("https://example.com/api/ops/admin/master-data/resources"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          resource: "agenda",
          fields: expect.arrayContaining([
            expect.objectContaining({
              name: "type",
              column: "tpagenda",
            }),
          ]),
        }),
      ]),
    );
  });
});
