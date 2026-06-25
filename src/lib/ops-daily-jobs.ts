import {
  autoCloseOperationalCashClosures,
  type AutoCloseOperationalCashClosuresSuccess,
} from "@/lib/ops-cash-closures";
import {
  runMembershipMaintenance,
  type RunMembershipMaintenanceSuccess,
} from "@/lib/ops-membership-maintenance";
import {
  syncOperationalPaymentStatuses,
  type SyncOperationalPaymentStatusesSuccess,
} from "@/lib/ops-payment-sync";
import {
  recoverPendingTicketDeliveries,
  type PendingTicketDeliveryRecoveryResult,
} from "@/lib/ticket-service";

type DailyJobsActor = {
  name?: string | null;
  cpf?: string | null;
};

type StepStatus = "success" | "failed" | "skipped";

type DailyJobsStepSuccess<TAction extends string, TData> = {
  action: TAction;
  status: "success";
  data: TData;
};

type DailyJobsStepSkipped<TAction extends string> = {
  action: TAction;
  status: "skipped";
  message: string;
};

type DailyJobsStepFailure<TAction extends string> = {
  action: TAction;
  status: "failed";
  error: string;
};

type PaymentSyncStep =
  | DailyJobsStepSuccess<"payment_sync", SyncOperationalPaymentStatusesSuccess>
  | DailyJobsStepSkipped<"payment_sync">
  | DailyJobsStepFailure<"payment_sync">;

type TicketDeliveryRecoveryStep =
  | DailyJobsStepSuccess<
      "ticket_delivery_recovery",
      PendingTicketDeliveryRecoveryResult
    >
  | DailyJobsStepSkipped<"ticket_delivery_recovery">
  | DailyJobsStepFailure<"ticket_delivery_recovery">;

type CashAutoCloseStep =
  | DailyJobsStepSuccess<"cash_auto_close", AutoCloseOperationalCashClosuresSuccess>
  | DailyJobsStepSkipped<"cash_auto_close">
  | DailyJobsStepFailure<"cash_auto_close">;

type MembershipStep =
  | DailyJobsStepSuccess<"membership_maintenance", RunMembershipMaintenanceSuccess>
  | DailyJobsStepSkipped<"membership_maintenance">
  | DailyJobsStepFailure<"membership_maintenance">;

export type RunOperationalDailyJobsInput = {
  actor?: DailyJobsActor | null;
  includePaymentSync?: boolean;
  includeCashAutoClose?: boolean;
  includeMembershipMaintenance?: boolean;
  retriesPerStep?: number;
  paymentSync?: {
    recentDays?: number;
    cancelAfterDays?: number;
    limit?: number;
  };
  cashAutoCloseReason?: string;
};

export type RunOperationalDailyJobsSuccess = {
  action: "daily_jobs";
  overallStatus: "success" | "partial";
  startedAt: string;
  finishedAt: string;
  steps: {
    paymentSync: PaymentSyncStep;
    ticketDeliveryRecovery: TicketDeliveryRecoveryStep;
    cashAutoClose: CashAutoCloseStep;
    membershipMaintenance: MembershipStep;
  };
  message: string;
};

class OperationalDailyJobsError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "OperationalDailyJobsError";
    this.code = code;
    this.status = status;
  }
}

function nowText() {
  return new Date().toISOString();
}

function errorMessage(error: unknown) {
  return error instanceof Error ?
      error.message :
      "Falha inesperada ao executar o job.";
}

async function runWithRetry<T>(
  task: () => Promise<T>,
  retries: number,
) {
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

export function asOperationalDailyJobsError(error: unknown) {
  if (error instanceof OperationalDailyJobsError) {
    return error;
  }

  return new OperationalDailyJobsError(
    "ops_daily_jobs_unavailable",
    "Nao foi possivel executar a rotina diaria operacional.",
    502,
  );
}

export async function runOperationalDailyJobs(
  input?: RunOperationalDailyJobsInput,
): Promise<RunOperationalDailyJobsSuccess> {
  const startedAt = nowText();
  const includePaymentSync = input?.includePaymentSync !== false;
  const includeCashAutoClose = input?.includeCashAutoClose !== false;
  const includeMembershipMaintenance =
    input?.includeMembershipMaintenance !== false;
  const retriesPerStep =
    Number.isInteger(input?.retriesPerStep) && Number(input?.retriesPerStep) > 0 ?
      Number(input?.retriesPerStep) :
      0;

  let paymentSync: PaymentSyncStep = {
    action: "payment_sync",
    status: "skipped",
    message: "Etapa desabilitada.",
  };
  let cashAutoClose: CashAutoCloseStep = {
    action: "cash_auto_close",
    status: "skipped",
    message: "Etapa desabilitada.",
  };
  let ticketDeliveryRecovery: TicketDeliveryRecoveryStep = {
    action: "ticket_delivery_recovery",
    status: "skipped",
    message: "Etapa desabilitada.",
  };
  let membershipMaintenance: MembershipStep = {
    action: "membership_maintenance",
    status: "skipped",
    message: "Etapa desabilitada.",
  };

  if (includePaymentSync) {
    try {
      const data = await runWithRetry(
        () => syncOperationalPaymentStatuses(input?.paymentSync),
        retriesPerStep,
      );
      paymentSync = {
        action: "payment_sync",
        status: "success",
        data,
      };
    } catch (error) {
      paymentSync = {
        action: "payment_sync",
        status: "failed",
        error: errorMessage(error),
      };
    }
  }

  try {
    const data = await runWithRetry(
      () => recoverPendingTicketDeliveries(),
      retriesPerStep,
    );
    ticketDeliveryRecovery = {
      action: "ticket_delivery_recovery",
      status: "success",
      data,
    };
  } catch (error) {
    ticketDeliveryRecovery = {
      action: "ticket_delivery_recovery",
      status: "failed",
      error: errorMessage(error),
    };
  }

  if (includeCashAutoClose) {
    try {
      const data = await runWithRetry(
        () =>
          autoCloseOperationalCashClosures({
            reason:
              String(input?.cashAutoCloseReason ?? "").trim() ||
              "Rotina diaria operacional no BFF",
            actor: input?.actor,
          }),
        retriesPerStep,
      );
      cashAutoClose = {
        action: "cash_auto_close",
        status: "success",
        data,
      };
    } catch (error) {
      cashAutoClose = {
        action: "cash_auto_close",
        status: "failed",
        error: errorMessage(error),
      };
    }
  }

  if (includeMembershipMaintenance) {
    try {
      const data = await runWithRetry(
        () => runMembershipMaintenance(),
        retriesPerStep,
      );
      membershipMaintenance = {
        action: "membership_maintenance",
        status: "success",
        data,
      };
    } catch (error) {
      membershipMaintenance = {
        action: "membership_maintenance",
        status: "failed",
        error: errorMessage(error),
      };
    }
  }

  const stepStatuses: StepStatus[] = [
    paymentSync.status,
    ticketDeliveryRecovery.status,
    cashAutoClose.status,
    membershipMaintenance.status,
  ];
  const overallStatus = stepStatuses.includes("failed") ? "partial" : "success";
  const finishedAt = nowText();

  return {
    action: "daily_jobs",
    overallStatus,
    startedAt,
    finishedAt,
    steps: {
      paymentSync,
      ticketDeliveryRecovery,
      cashAutoClose,
      membershipMaintenance,
    },
    message:
      overallStatus === "success" ?
        "Rotina diaria operacional executada com sucesso." :
        "Rotina diaria operacional concluida com pendencias.",
  };
}
