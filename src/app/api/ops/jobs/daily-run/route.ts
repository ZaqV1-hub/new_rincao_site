import { authenticateOperationsRequest } from "@/lib/ops-auth";
import {
  handleOperationalDailyRun,
  readDailyRunActor,
  readDailyRunBoolean,
  readDailyRunPaymentSync,
} from "@/lib/ops-daily-run-route";

export const runtime = "nodejs";

type DailyRunPayload = {
  includePaymentSync?: unknown;
  includeCashAutoClose?: unknown;
  includeMembershipMaintenance?: unknown;
  cashAutoCloseReason?: unknown;
  paymentSync?: {
    recentDays?: unknown;
    cancelAfterDays?: unknown;
    limit?: unknown;
  } | null;
  actor?: {
    name?: unknown;
    cpf?: unknown;
  } | null;
};

export async function POST(request: Request) {
  const auth = authenticateOperationsRequest(request, {
    requiredPermission: "ops.jobs",
  });

  if (!auth.ok) {
    return auth.response;
  }

  return handleOperationalDailyRun<DailyRunPayload>({
    request,
    errorLogKey: "ops-daily-run-bff-failed",
    buildRunInput: (payload) => ({
      includePaymentSync: readDailyRunBoolean(payload?.includePaymentSync, true),
      includeCashAutoClose: readDailyRunBoolean(
        payload?.includeCashAutoClose,
        true,
      ),
      includeMembershipMaintenance: readDailyRunBoolean(
        payload?.includeMembershipMaintenance,
        true,
      ),
      cashAutoCloseReason:
        typeof payload?.cashAutoCloseReason === "string" ?
          payload.cashAutoCloseReason :
          undefined,
      paymentSync: readDailyRunPaymentSync(payload?.paymentSync),
      actor: readDailyRunActor(payload?.actor),
    }),
    buildJobRunInput: (payload, data) => ({
      jobName: "daily-run",
      triggerSource: "manual",
      initiatedBy: readDailyRunActor(payload?.actor).name,
      status: data.overallStatus,
      message: data.message,
      summary: data,
      startedAt: data.startedAt,
      finishedAt: data.finishedAt,
    }),
  });
}
