import { NextResponse } from "next/server";
import type { AuthErrorResponse } from "@/lib/auth-contracts";
import { authenticateOperationsRequest } from "@/lib/ops-auth";
import { authorizePainelApiAccess } from "@/lib/painel-api-auth";
import {
  asBoxOfficeSaleError,
  createOperationalBoxOfficeSale,
} from "@/lib/ops-box-office-sales";

export const runtime = "nodejs";

type BoxOfficeSalePayload = {
  agendaId?: unknown;
  cpf?: unknown;
  items?: unknown;
  courtesies?: unknown;
  payments?: unknown;
  reason?: unknown;
  idempotencyKey?: unknown;
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

function readActor(payload: BoxOfficeSalePayload | null) {
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

export async function POST(request: Request) {
  const auth = authenticateOperationsRequest(request, {
    requiredPermission: "ops.purchases",
  });

  if (!auth.ok) {
    return auth.response;
  }

  const painelAuth = await authorizePainelApiAccess(request, "vis_bilhet");

  if (!painelAuth.ok) {
    return painelAuth.response;
  }

  let payload: BoxOfficeSalePayload | null = null;

  try {
    payload = (await request.json()) as BoxOfficeSalePayload;
  } catch {
    payload = null;
  }

  try {
    const result = await createOperationalBoxOfficeSale({
      agendaId: Number(payload?.agendaId),
      cpf: typeof payload?.cpf === "string" ? payload.cpf : null,
      items: Array.isArray(payload?.items)
        ? (payload.items as Array<{
            type: string;
            quantity: number;
            discountId?: number | null;
          }>)
        : [],
      courtesies: Array.isArray(payload?.courtesies)
        ? (payload.courtesies as Array<{
            authorId: number;
            authorizedById?: number | null;
            quantity: number;
            identification?: string | null;
            note?: string | null;
          }>)
        : [],
      payments: Array.isArray(payload?.payments)
        ? (payload.payments as Array<{
            method: string;
            value: string | number;
          }>)
        : [],
      reason: typeof payload?.reason === "string" ? payload.reason : "",
      idempotencyKey:
        typeof payload?.idempotencyKey === "string"
          ? payload.idempotencyKey
          : null,
      actor: readActor(payload),
    });

    return NextResponse.json({
      ok: true,
      data: result,
    });
  } catch (error) {
    const operationError = asBoxOfficeSaleError(error);

    console.error("ops-box-office-sale-bff-failed", error);

    return errorResponse(
      operationError.code,
      operationError.message,
      operationError.status,
    );
  }
}
