import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticateOperationsJobRequest = vi.fn();
const runOperationalDailyJobs = vi.fn();
const asOperationalDailyJobsError = vi.fn();
const recordOperationalJobRun = vi.fn();

vi.mock("@/lib/ops-auth", () => ({
  authenticateOperationsJobRequest,
}));

vi.mock("@/lib/ops-daily-jobs", () => ({
  runOperationalDailyJobs,
  asOperationalDailyJobsError,
}));

vi.mock("@/lib/ops-job-runs", () => ({
  recordOperationalJobRun,
}));

describe("ops/jobs/daily-run/scheduled BFF route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateOperationsJobRequest.mockReturnValue({ ok: true });
    asOperationalDailyJobsError.mockImplementation((error: Error) => error);
  });

  it("runs the scheduled daily operational bundle", async () => {
    runOperationalDailyJobs.mockResolvedValue({
      action: "daily_jobs",
      overallStatus: "success",
      startedAt: "2026-04-23T23:00:00.000Z",
      finishedAt: "2026-04-23T23:00:02.000Z",
      steps: {
        paymentSync: {
          action: "payment_sync",
          status: "success",
          data: { action: "payment_sync" },
        },
        cashAutoClose: {
          action: "cash_auto_close",
          status: "success",
          data: { action: "auto_close" },
        },
        membershipMaintenance: {
          action: "membership_maintenance",
          status: "success",
          data: { action: "membership_maintenance" },
        },
      },
      message: "Rotina diaria operacional executada com sucesso.",
    });

    const { POST } = await import(
      "@/app/api/ops/jobs/daily-run/scheduled/route"
    );
    const response = await POST(
      new Request("https://example.com/api/ops/jobs/daily-run/scheduled", {
        method: "POST",
        headers: {
          "x-ops-jobs-token": "jobs-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          retriesPerStep: 1,
          cashAutoCloseReason: "Virada agendada",
          paymentSync: {
            recentDays: 7,
            cancelAfterDays: 5,
            limit: 50,
          },
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(runOperationalDailyJobs).toHaveBeenCalledWith({
      includePaymentSync: true,
      includeCashAutoClose: true,
      includeMembershipMaintenance: true,
      retriesPerStep: 1,
      cashAutoCloseReason: "Virada agendada",
      paymentSync: {
        recentDays: 7,
        cancelAfterDays: 5,
        limit: 50,
      },
      actor: {
        name: "scheduler",
        cpf: null,
      },
    });
    expect(recordOperationalJobRun).toHaveBeenCalledWith(
      expect.objectContaining({
        triggerSource: "scheduled",
        initiatedBy: "scheduler",
      }),
    );
    expect(body.ok).toBe(true);
  });
});
