import { NextResponse } from "next/server";
import type { AuthErrorResponse } from "@/lib/auth-contracts";
import { authenticateOperationsRequest } from "@/lib/ops-auth";
import { requirePainelApiAccess } from "@/lib/painel-api-auth";
import {
  asOperationalCashClosureError,
  autoCloseOperationalCashClosures,
} from "@/lib/ops-cash-closures";

export const runtime = "nodejs";

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json<AuthErrorResponse>(
    {
      ok: false,
      error: {
        code,
        message,
      },
    },
    { status, headers: { "Cache-Control": "private, no-store" } },
  );
}

type AutoCloseCashClosuresPayload = {
  reason?: unknown;
  actor?: {
    name?: unknown;
    cpf?: unknown;
  } | null;
};

export async function POST(request: Request) {
  const auth = authenticateOperationsRequest(request, {
    requiredPermission: "ops.cash",
  });

  if (!auth.ok) {
    auth.response.headers.set("Cache-Control", "private, no-store");
    return auth.response;
  }

  let actor: { name: string | null; cpf: string | null } = { name: "Fechamento automatico", cpf: null };
  if (auth.via !== "bearer") {
    const access = await requirePainelApiAccess(request, "vis_bilhet");
    if (!access.ok) {
      access.response.headers.set("Cache-Control", "private, no-store");
      return access.response;
    }
    if (access.session.legacyRoleId !== 1) {
      return errorResponse("manager_required", "Somente gestor pode executar o fechamento.", 403);
    }
    actor = { name: access.session.actorName, cpf: access.session.actorCpf };
  }

  let payload: AutoCloseCashClosuresPayload | null = null;

  try {
    payload = (await request.json()) as AutoCloseCashClosuresPayload;
  } catch {
    payload = null;
  }

  try {
    const result = await autoCloseOperationalCashClosures({
      reason: typeof payload?.reason === "string" ? payload.reason : "",
      actor,
    });

    return NextResponse.json({
      ok: true,
      data: result,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const operationError = asOperationalCashClosureError(error);

    console.error("ops-cash-auto-close-bff-failed", error);

    return errorResponse(
      operationError.code,
      operationError.message,
      operationError.status,
    );
  }
}
