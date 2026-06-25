import { authenticateOperationsJobRequest } from "@/lib/ops-auth";
import {
  handleOperationalDailyRun,
  readDailyRunPaymentSync,
} from "@/lib/ops-daily-run-route";

export const runtime = "nodejs";

type ScheduledDailyRunPayload = {
  paymentSync?: {
    recentDays?: unknown;
    cancelAfterDays?: unknown;
    limit?: unknown;
  } | null;
  cashAutoCloseReason?: unknown;
  retriesPerStep?: unknown;
};

export async function POST(request: Request) {
  const auth = authenticateOperationsJobRequest(request);

  if (!auth.ok) {
    return auth.response;
  }

  return handleOperationalDailyRun<ScheduledDailyRunPayload>({
    request,
    errorLogKey: "ops-daily-run-scheduled-bff-failed",
    buildRunInput: (payload) => ({
      includePaymentSync: true,
      includeCashAutoClose: true,
      includeMembershipMaintenance: true,
      retriesPerStep:
        typeof payload?.retriesPerStep === "number" ?
          payload.retriesPerStep :
          1,
      cashAutoCloseReason:
        typeof payload?.cashAutoCloseReason === "string" ?
          payload.cashAutoCloseReason :
          "Rotina diaria agendada no BFF",
      paymentSync: readDailyRunPaymentSync(payload?.paymentSync),
      actor: {
        name: "scheduler",
        cpf: null,
      },
    }),
    buildJobRunInput: (_payload, data) => ({
      jobName: "daily-run",
      triggerSource: "scheduled",
      initiatedBy: "scheduler",
      status: data.overallStatus,
      message: data.message,
      summary: data,
      startedAt: data.startedAt,
      finishedAt: data.finishedAt,
    }),
  });
}
