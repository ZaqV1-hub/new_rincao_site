import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticateOperationsRequest = vi.fn();
const listOperationalJobRuns = vi.fn();

vi.mock("@/lib/ops-auth", () => ({
  authenticateOperationsRequest,
}));

vi.mock("@/lib/ops-job-runs", () => ({
  listOperationalJobRuns,
}));

describe("ops/jobs/runs BFF route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateOperationsRequest.mockReturnValue({ ok: true });
  });

  it("returns the recent job run history", async () => {
    listOperationalJobRuns.mockResolvedValue({
      items: [
        {
          id: 77,
          jobName: "daily-run",
          triggerSource: "scheduled",
          initiatedBy: "scheduler",
          status: "success",
          message: "ok",
          summary: { action: "daily_jobs" },
          startedAt: "2026-04-23T23:00:00.000Z",
          finishedAt: "2026-04-23T23:00:02.000Z",
          createdAt: "2026-04-23T23:00:02.000Z",
        },
      ],
      meta: {
        limit: 10,
        offset: 0,
        total: 1,
        jobName: "daily-run",
      },
    });

    const { GET } = await import("@/app/api/ops/jobs/runs/route");
    const response = await GET(
      new Request(
        "https://example.com/api/ops/jobs/runs?limit=10&offset=0&jobName=daily-run",
        {
          headers: {
            authorization: "Bearer ops-token",
          },
        },
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(listOperationalJobRuns).toHaveBeenCalledWith({
      limit: 10,
      offset: 0,
      jobName: "daily-run",
    });
    expect(body.ok).toBe(true);
  });
});
