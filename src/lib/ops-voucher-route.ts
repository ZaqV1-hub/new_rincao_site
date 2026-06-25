import { NextResponse } from "next/server";
import type { AuthErrorResponse } from "@/lib/auth-contracts";
import { asVoucherOperationError } from "@/lib/ops-voucher-validation";
import {
  authorizeOpsRouteAccess,
  readJsonPayload,
  readRouteActor,
} from "@/lib/ops-route-utils";

type VoucherActor = ReturnType<typeof readRouteActor>;

type VoucherPayloadBase = {
  voucherIds?: unknown;
  purchaseId?: unknown;
  actor?: {
    name?: unknown;
    cpf?: unknown;
  } | null;
};

type ValidatePayload = VoucherPayloadBase & {
  voucherNumber?: unknown;
  schoolId?: unknown;
  agendaId?: unknown;
  confirm?: unknown;
};

type VoucherRouteContext = {
  purchaseId: number;
  voucherIds: number[];
  actor: VoucherActor;
};

type ValidateRouteContext = VoucherRouteContext & {
  voucherNumber: string;
  schoolId: number;
  agendaId: number;
  confirm: boolean;
};

type VoucherOperationContext = VoucherRouteContext | ValidateRouteContext;

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

function readVoucherIds(value: unknown) {
  return Array.isArray(value)
    ? value
        .map((voucherId) => Number(voucherId))
        .filter((voucherId) => Number.isInteger(voucherId) && voucherId > 0)
    : [];
}

function readBaseContext(payload: VoucherPayloadBase | null): VoucherRouteContext {
  return {
    purchaseId: Number(payload?.purchaseId),
    voucherIds: readVoucherIds(payload?.voucherIds),
    actor: readRouteActor(payload?.actor),
  };
}

export async function authorizeOpsVoucherRoute(request: Request) {
  return authorizeOpsRouteAccess(request, {
    requiredPermission: "ops.vouchers",
    painelPermissions: "vis_bilhet",
  });
}

export async function readValidateVoucherPayload(request: Request) {
  const payload = await readJsonPayload<ValidatePayload>(request);
  const base = readBaseContext(payload);

  return {
    context: {
      ...base,
      confirm: payload?.confirm === true,
      voucherNumber:
        typeof payload?.voucherNumber === "string" ? payload.voucherNumber.trim() : "",
      schoolId: Number(payload?.schoolId),
      agendaId: Number(payload?.agendaId),
    } satisfies ValidateRouteContext,
  };
}

export async function readVoucherOperationPayload(request: Request) {
  const payload = await readJsonPayload<VoucherPayloadBase>(request);

  return {
    context: readBaseContext(payload),
  };
}

export function invalidValidateVoucherResponse() {
  return errorResponse(
    "invalid_operations_payload",
    "Informe voucherNumber, purchaseId, schoolId+agendaId ou voucherIds para validar.",
    400,
  );
}

export function invalidUnvalidateVoucherResponse() {
  return errorResponse(
    "invalid_operations_payload",
    "Informe voucherIds ou purchaseId para desvalidar.",
    400,
  );
}

export function createVoucherOperationErrorResponse(
  code: string,
  message: string,
  status: number,
) {
  return errorResponse(code, message, status);
}

export async function runOpsVoucherOperationRoute<
  TContext extends VoucherOperationContext,
  TResult,
>(
  request: Request,
  options: {
    readContext: (request: Request) => Promise<{ context: TContext }>;
    run: (context: TContext) => Promise<TResult | null>;
    invalidResponse: () => Response;
    logKey: string;
  },
) {
  const access = await authorizeOpsVoucherRoute(request);

  if (!access.ok) {
    return access.response;
  }

  const { context } = await options.readContext(request);

  try {
    const result = await options.run(context);

    if (!result) {
      return options.invalidResponse();
    }

    return NextResponse.json({
      ok: true,
      data: result,
    });
  } catch (error) {
    const operationError = asVoucherOperationError(error);

    console.error(options.logKey, error);

    return createVoucherOperationErrorResponse(
      operationError.code,
      operationError.message,
      operationError.status,
    );
  }
}
