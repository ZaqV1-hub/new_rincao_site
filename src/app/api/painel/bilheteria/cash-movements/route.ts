import { NextResponse } from "next/server";
import { readJsonPayload } from "@/lib/ops-route-utils";
import { requirePainelApiAccess } from "@/lib/painel-api-auth";
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
};

function readMovementType(value: unknown): OperationalCashMovementType {
  return value === "fundo" || value === "sangria" ? value : "fundo";
}

function readMovementValue(value: unknown) {
  return typeof value === "number" || typeof value === "string" ? value : "";
}

async function authorize(request: Request) {
  return requirePainelApiAccess(request, "vis_bilhet");
}

export async function POST(request: Request) {
  const access = await authorize(request);

  if (!access.ok) {
    return access.response;
  }

  const payload = await readJsonPayload<CashMovementPayload>(request);

  try {
    const result = await createOperationalCashMovement({
      type: readMovementType(payload?.type),
      responsible: typeof payload?.responsible === "string" ? payload.responsible : "",
      value: readMovementValue(payload?.value),
      reason: typeof payload?.reason === "string" ? payload.reason : "",
      actor: {
        name: access.session.actorName,
        cpf: access.session.actorCpf,
      },
    });

    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    const operationError = asOperationalCashError(error);

    console.error("painel-bilheteria-cash-movement-create-failed", error);

    return NextResponse.json(
      {
        ok: false,
        error: {
          code: operationError.code,
          message: operationError.message,
        },
      },
      { status: operationError.status },
    );
  }
}

export async function PATCH(request: Request) {
  const access = await authorize(request);

  if (!access.ok) {
    return access.response;
  }

  const payload = await readJsonPayload<CashMovementPayload>(request);

  try {
    const result = await updateOperationalCashMovement({
      movementId: Number(payload?.movementId),
      responsible: typeof payload?.responsible === "string" ? payload.responsible : "",
      value: readMovementValue(payload?.value),
      reason: typeof payload?.reason === "string" ? payload.reason : "",
      actor: {
        name: access.session.actorName,
        cpf: access.session.actorCpf,
      },
    });

    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    const operationError = asOperationalCashError(error);

    console.error("painel-bilheteria-cash-movement-update-failed", error);

    return NextResponse.json(
      {
        ok: false,
        error: {
          code: operationError.code,
          message: operationError.message,
        },
      },
      { status: operationError.status },
    );
  }
}

export async function DELETE(request: Request) {
  const access = await authorize(request);

  if (!access.ok) {
    return access.response;
  }

  const payload = await readJsonPayload<CashMovementPayload>(request);

  try {
    const result = await deleteOperationalCashMovement({
      movementId: Number(payload?.movementId),
      reason: typeof payload?.reason === "string" ? payload.reason : "",
      actor: {
        name: access.session.actorName,
        cpf: access.session.actorCpf,
      },
    });

    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    const operationError = asOperationalCashError(error);

    console.error("painel-bilheteria-cash-movement-delete-failed", error);

    return NextResponse.json(
      {
        ok: false,
        error: {
          code: operationError.code,
          message: operationError.message,
        },
      },
      { status: operationError.status },
    );
  }
}
