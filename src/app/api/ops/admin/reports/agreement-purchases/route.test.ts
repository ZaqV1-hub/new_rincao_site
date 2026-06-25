import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticateOperationsRequest = vi.fn();
const getAgreementPurchaseReport = vi.fn();
const asOpsAgreementPurchaseReportError = vi.fn();

vi.mock("@/lib/ops-auth", () => ({
  authenticateOperationsRequest,
}));

vi.mock("@/lib/ops-agreement-purchases", () => ({
  getAgreementPurchaseReport,
  asOpsAgreementPurchaseReportError,
}));

describe("ops/admin/reports/agreement-purchases route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateOperationsRequest.mockReturnValue({ ok: true });
    asOpsAgreementPurchaseReportError.mockImplementation((error: Error) => error);
  });

  it("reads report filters from the query string", async () => {
    getAgreementPurchaseReport.mockResolvedValue({
      generatedAt: "2026-04-25T00:00:00.000Z",
      filters: {},
      indicators: {},
      rows: [],
    });

    const { GET } = await import(
      "@/app/api/ops/admin/reports/agreement-purchases/route"
    );
    const response = await GET(
      new Request(
        "https://example.com/api/ops/admin/reports/agreement-purchases?agreementName=SITE&visitDateFrom=2026-04-01",
      ),
    );

    expect(response.status).toBe(200);
    expect(getAgreementPurchaseReport).toHaveBeenCalledWith(
      expect.objectContaining({
        agreementName: "SITE",
        visitDateFrom: "2026-04-01",
      }),
    );
  });
});
