import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticateOperationsRequest = vi.fn();
const runOperationalDailyJobs = vi.fn();
const asOperationalDailyJobsError = vi.fn();
const recordOperationalJobRun = vi.fn();

vi.mock("@/lib/ops-auth", () => ({
  authenticateOperationsRequest,
}));

vi.mock("@/lib/ops-daily-jobs", () => ({
  runOperationalDailyJobs,
  asOperationalDailyJobsError,
}));

vi.mock("@/lib/ops-job-runs", () => ({
  recordOperationalJobRun,
}));

describe("ops/jobs/daily-run BFF route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateOperationsRequest.mockReturnValue({ ok: true });
    asOperationalDailyJobsError.mockImplementation((error: Error) => error);
  });

  it("runs the daily operational job bundle", async () => {
    runOperationalDailyJobs.mockResolvedValue({
      action: "daily_jobs",
      overallStatus: "success",
      startedAt: "2026-04-23T23:00:00.000Z",
      finishedAt: "2026-04-23T23:00:02.000Z",
      steps: {
        paymentSync: {
          action: "payment_sync",
          status: "success",
          data: {
            action: "payment_sync",
            configured: true,
            candidates: 1,
            processed: 1,
            reconciled: 1,
            cancelled: 0,
            missing: 0,
            skipped: 0,
            failed: 0,
            items: [],
            message: "ok",
          },
        },
        cashAutoClose: {
          action: "cash_auto_close",
          status: "success",
          data: {
            action: "auto_close",
            closedCount: 0,
            closedPeriodIds: [],
            closureIds: [],
            currentSummary: null,
            auditLogIds: [],
            message: "ok",
          },
        },
        membershipMaintenance: {
          action: "membership_maintenance",
          status: "success",
          data: {
            action: "membership_maintenance",
            processed: 0,
            items: [],
            message: "ok",
          },
        },
      },
      message: "Rotina diaria operacional executada com sucesso.",
    });

    const { POST } = await import("@/app/api/ops/jobs/daily-run/route");
    const response = await POST(
      new Request("https://example.com/api/ops/jobs/daily-run", {
        method: "POST",
        headers: {
          authorization: "Bearer ops-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          includePaymentSync: true,
          includeCashAutoClose: true,
          includeMembershipMaintenance: true,
          cashAutoCloseReason: "Virada diaria",
          paymentSync: {
            recentDays: 7,
            cancelAfterDays: 5,
            limit: 50,
          },
          actor: {
            name: "Gestor Operacional",
          },
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(authenticateOperationsRequest).toHaveBeenCalledWith(
      expect.any(Request),
      { requiredPermission: "ops.jobs" },
    );
    expect(runOperationalDailyJobs).toHaveBeenCalledWith({
      includePaymentSync: true,
      includeCashAutoClose: true,
      includeMembershipMaintenance: true,
      cashAutoCloseReason: "Virada diaria",
      paymentSync: {
        recentDays: 7,
        cancelAfterDays: 5,
        limit: 50,
      },
      actor: {
        name: "Gestor Operacional",
        cpf: null,
      },
    });
    expect(recordOperationalJobRun).toHaveBeenCalledWith(
      expect.objectContaining({
        jobName: "daily-run",
        triggerSource: "manual",
      }),
    );
    expect(body.ok).toBe(true);
    expect(body.data.action).toBe("daily_jobs");
  });
});
