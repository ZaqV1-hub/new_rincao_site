import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticateOperationsRequest = vi.fn();
const listClientTypes = vi.fn();
const asOpsClientEducationError = vi.fn();

vi.mock("@/lib/ops-auth", () => ({
  authenticateOperationsRequest,
}));

vi.mock("@/lib/ops-client-education", () => ({
  listClientTypes,
  asOpsClientEducationError,
}));

describe("ops/admin/client-types route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateOperationsRequest.mockReturnValue({ ok: true });
    asOpsClientEducationError.mockImplementation((error: Error) => error);
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

    const { GET } = await import("@/app/api/ops/admin/client-types/route");
    const response = await GET(
      new Request("https://example.com/api/ops/admin/client-types"),
    );

    expect(response.status).toBe(403);
  });

  it("lists client types", async () => {
    listClientTypes.mockResolvedValue([{ id: 4, name: "Escola" }]);

    const { GET } = await import("@/app/api/ops/admin/client-types/route");
    const response = await GET(
      new Request("https://example.com/api/ops/admin/client-types"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      data: [{ id: 4, name: "Escola" }],
    });
  });
});
