import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticateOperationsRequest = vi.fn();
const autocompleteClients = vi.fn();
const asOpsClientEducationError = vi.fn();

vi.mock("@/lib/ops-auth", () => ({
  authenticateOperationsRequest,
}));

vi.mock("@/lib/ops-client-education", () => ({
  autocompleteClients,
  asOpsClientEducationError,
}));

describe("ops/admin/clients/autocomplete route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateOperationsRequest.mockReturnValue({ ok: true });
    asOpsClientEducationError.mockImplementation((error: Error) => error);
  });

  it("passes query parameters to autocomplete service", async () => {
    autocompleteClients.mockResolvedValue([{ id: 10, text: "Colegio Alfa (Escola)" }]);

    const { GET } = await import(
      "@/app/api/ops/admin/clients/autocomplete/route"
    );
    const response = await GET(
      new Request(
        "https://example.com/api/ops/admin/clients/autocomplete?q=alfa&limit=8",
      ),
    );

    expect(response.status).toBe(200);
    expect(autocompleteClients).toHaveBeenCalledWith("alfa", "8");
  });
});
