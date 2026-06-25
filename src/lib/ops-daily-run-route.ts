import { NextResponse } from "next/server";
import type { AuthErrorResponse } from "@/lib/auth-contracts";
import {
  asOperationalDailyJobsError,
  runOperationalDailyJobs,
  type RunOperationalDailyJobsInput,
  type RunOperationalDailyJobsSuccess,
} from "@/lib/ops-daily-jobs";
import { recordOperationalJobRun } from "@/lib/ops-job-runs";

type DailyRunPaymentSyncPayload = {
  recentDays?: unknown;
  cancelAfterDays?: unknown;
  limit?: unknown;
} | null;

type DailyRunActorPayload = {
  name?: unknown;
  cpf?: unknown;
} | null;

type RecordOperationalJobRunInput = Parameters<
  typeof recordOperationalJobRun
>[0];

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json<AuthErrorResponse>(
    {
      ok: false,
      error: {
        code,
        message,
      },
    },
    { status },
  );
}

export async function readDailyRunJson<TPayload>(
  request: Request,
): Promise<TPayload | null> {
  try {
    return (await request.json()) as TPayload;
  } catch {
    return null;
  }
}

export function readDailyRunBoolean(value: unknown, fallback: boolean) {
  if (value === undefined || value === null) {
    return fallback;
  }

  if (typeof value === "boolean") {
    return value;
  }

  return ["1", "true", "s", "sim", "yes", "on"].includes(
    String(value).trim().toLowerCase(),
  );
}

export function readDailyRunPaymentSync(
  paymentSync: DailyRunPaymentSyncPayload | undefined,
): RunOperationalDailyJobsInput["paymentSync"] {
  if (!paymentSync) {
    return undefined;
  }

  return {
    recentDays:
      typeof paymentSync.recentDays === "number" ?
        paymentSync.recentDays :
        undefined,
    cancelAfterDays:
      typeof paymentSync.cancelAfterDays === "number" ?
        paymentSync.cancelAfterDays :
        undefined,
    limit:
      typeof paymentSync.limit === "number" ? paymentSync.limit : undefined,
  };
}

export function readDailyRunActor(
  actor: DailyRunActorPayload | undefined,
): NonNullable<RunOperationalDailyJobsInput["actor"]> {
  return {
    name: typeof actor?.name === "string" ? actor.name.trim() : null,
    cpf: typeof actor?.cpf === "string" ? actor.cpf.trim() : null,
  };
}

export async function handleOperationalDailyRun<TPayload>({
  request,
  errorLogKey,
  buildRunInput,
  buildJobRunInput,
}: {
  request: Request;
  errorLogKey: string;
  buildRunInput: (payload: TPayload | null) => RunOperationalDailyJobsInput;
  buildJobRunInput: (
    payload: TPayload | null,
    data: RunOperationalDailyJobsSuccess,
  ) => RecordOperationalJobRunInput;
}) {
  const payload = await readDailyRunJson<TPayload>(request);

  try {
    const data = await runOperationalDailyJobs(buildRunInput(payload));

    await recordOperationalJobRun(buildJobRunInput(payload, data));

    return NextResponse.json({
      ok: true,
      data,
    });
  } catch (error) {
    const operationError = asOperationalDailyJobsError(error);

    console.error(errorLogKey, error);

    return errorResponse(
      operationError.code,
      operationError.message,
      operationError.status,
    );
  }
}
