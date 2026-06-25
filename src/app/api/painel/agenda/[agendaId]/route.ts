import { NextResponse } from "next/server";
import {
  asPainelAgendaError,
  deletePainelAgenda,
} from "@/lib/painel-agenda";
import { authenticateOperationsRequest } from "@/lib/ops-auth";
import { authorizePainelApiAccess } from "@/lib/painel-api-auth";

export const runtime = "nodejs";

type AgendaDeletePayload = {
  reason?: unknown;
  actor?: {
    name?: unknown;
    cpf?: unknown;
  } | null;
};

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json(
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

async function readPayload(request: Request) {
  try {
    return (await request.json()) as AgendaDeletePayload;
  } catch {
    return null;
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ agendaId: string }> },
) {
  const auth = authenticateOperationsRequest(request, {
    requiredPermission: "ops.read",
  });

  if (!auth.ok) {
    return auth.response;
  }

  const painelAuth = await authorizePainelApiAccess(request, "vis_agenda");

  if (!painelAuth.ok) {
    return painelAuth.response;
  }

  const payload = await readPayload(request);
  const { agendaId } = await context.params;

  try {
    const data = await deletePainelAgenda(Number(agendaId), {
      reason: typeof payload?.reason === "string" ? payload.reason : "",
      actor: {
        name:
          typeof payload?.actor?.name === "string"
            ? payload.actor.name.trim()
            : null,
        cpf:
          typeof payload?.actor?.cpf === "string"
            ? payload.actor.cpf.trim()
            : null,
      },
    });

    return NextResponse.json({
      ok: true,
      data,
    });
  } catch (error) {
    const operationError = asPainelAgendaError(error);

    console.error("painel-agenda-delete-failed", error);

    return errorResponse(
      operationError.code,
      operationError.message,
      operationError.status,
    );
  }
}
