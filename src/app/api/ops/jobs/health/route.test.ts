import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticateOperationsRequest = vi.fn();
const getOperationalJobHealth = vi.fn();

vi.mock("@/lib/ops-auth", () => ({
  authenticateOperationsRequest,
}));

vi.mock("@/lib/ops-job-runs", () => ({
  getOperationalJobHealth,
}));

describe("ops/jobs/health BFF route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateOperationsRequest.mockReturnValue({ ok: true });
  });

  it("returns the current job health", async () => {
    getOperationalJobHealth.mockResolvedValue({
      jobName: "daily-run",
      triggerSource: "scheduled",
      maxAgeMinutes: 1560,
      healthy: true,
      status: "healthy",
      message: "Job dentro da janela esperada.",
      recommendedActions: [],
      ageMinutes: 12,
      latestRun: null,
      lastSuccessAt: "2026-04-23T23:10:00.000Z",
    });

    const { GET } = await import("@/app/api/ops/jobs/health/route");
    const response = await GET(
      new Request(
        "https://example.com/api/ops/jobs/health?jobName=daily-run&triggerSource=scheduled&maxAgeMinutes=1560",
        {
          headers: {
            authorization: "Bearer ops-token",
          },
        },
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(authenticateOperationsRequest).toHaveBeenCalledWith(
      expect.any(Request),
      { requiredPermission: "ops.read" },
    );
    expect(getOperationalJobHealth).toHaveBeenCalledWith({
      jobName: "daily-run",
      triggerSource: "scheduled",
      maxAgeMinutes: 1560,
    });
    expect(body.ok).toBe(true);
  });
});
