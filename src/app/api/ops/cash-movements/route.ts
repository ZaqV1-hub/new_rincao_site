import { NextResponse } from "next/server";
import type { AuthErrorResponse } from "@/lib/auth-contracts";
import { authenticateOperationsRequest } from "@/lib/ops-auth";
import { authorizePainelApiAccess } from "@/lib/painel-api-auth";
import {
  asOperationalCashError,
  createOperationalCashMovement,
  deleteOperationalCashMovement,
  type OperationalCashMovementType,
  updateOperationalCashMovement,
} from "@/lib/ops-cash-management";

export const runtime = "nodejs";

type CashMovementPayload = {
  movementId?: unknown;
  type?: unknown;
  responsible?: unknown;
  value?: unknown;
  reason?: unknown;
  actor?: {
    name?: unknown;
    cpf?: unknown;
  } | null;
};

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

function readActor(payload: CashMovementPayload | null) {
  return {
    name:
      typeof payload?.actor?.name === "string"
        ? payload.actor.name.trim()
        : null,
    cpf:
      typeof payload?.actor?.cpf === "string"
        ? payload.actor.cpf.trim()
        : null,
  };
}

function readMovementType(value: unknown): OperationalCashMovementType {
  return value === "fundo" || value === "sangria" ? value : "fundo";
}

function readMovementValue(value: unknown) {
  return typeof value === "number" || typeof value === "string" ? value : "";
}

export async function POST(request: Request) {
  const auth = authenticateOperationsRequest(request, {
    requiredPermission: "ops.cash",
  });

  if (!auth.ok) {
    return auth.response;
  }

  const painelAuth = await authorizePainelApiAccess(request, "vis_bilhet");

  if (!painelAuth.ok) {
    return painelAuth.response;
  }

  let payload: CashMovementPayload | null = null;

  try {
    payload = (await request.json()) as CashMovementPayload;
  } catch {
    payload = null;
  }

  try {
    const result = await createOperationalCashMovement({
      type: readMovementType(payload?.type),
      responsible:
        typeof payload?.responsible === "string" ? payload.responsible : "",
      value: readMovementValue(payload?.value),
      reason: typeof payload?.reason === "string" ? payload.reason : "",
      actor: readActor(payload),
    });

    return NextResponse.json({
      ok: true,
      data: result,
    });
  } catch (error) {
    const operationError = asOperationalCashError(error);

    console.error("ops-cash-movements-bff-failed", error);

    return errorResponse(
      operationError.code,
      operationError.message,
      operationError.status,
    );
  }
}

export async function PATCH(request: Request) {
  const auth = authenticateOperationsRequest(request, {
    requiredPermission: "ops.cash",
  });

  if (!auth.ok) {
    return auth.response;
  }

  const painelAuth = await authorizePainelApiAccess(request, "vis_bilhet");

  if (!painelAuth.ok) {
    return painelAuth.response;
  }

  let payload: CashMovementPayload | null = null;

  try {
    payload = (await request.json()) as CashMovementPayload;
  } catch {
    payload = null;
  }

  try {
    const result = await updateOperationalCashMovement({
      movementId: Number(payload?.movementId),
      responsible:
        typeof payload?.responsible === "string" ? payload.responsible : "",
      value: readMovementValue(payload?.value),
      reason: typeof payload?.reason === "string" ? payload.reason : "",
      actor: readActor(payload),
    });

    return NextResponse.json({
      ok: true,
      data: result,
    });
  } catch (error) {
    const operationError = asOperationalCashError(error);

    console.error("ops-cash-movements-patch-bff-failed", error);

    return errorResponse(
      operationError.code,
      operationError.message,
      operationError.status,
    );
  }
}

export async function DELETE(request: Request) {
  const auth = authenticateOperationsRequest(request, {
    requiredPermission: "ops.cash",
  });

  if (!auth.ok) {
    return auth.response;
  }

  const painelAuth = await authorizePainelApiAccess(request, "vis_bilhet");

  if (!painelAuth.ok) {
    return painelAuth.response;
  }

  let payload: CashMovementPayload | null = null;

  try {
    payload = (await request.json()) as CashMovementPayload;
  } catch {
    payload = null;
  }

  try {
    const result = await deleteOperationalCashMovement({
      movementId: Number(payload?.movementId),
      reason: typeof payload?.reason === "string" ? payload.reason : "",
      actor: readActor(payload),
    });

    return NextResponse.json({
      ok: true,
      data: result,
    });
  } catch (error) {
    const operationError = asOperationalCashError(error);

    console.error("ops-cash-movements-delete-bff-failed", error);

    return errorResponse(
      operationError.code,
      operationError.message,
      operationError.status,
    );
  }
}
