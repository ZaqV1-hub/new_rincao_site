import { NextResponse } from "next/server";
import {
  asPainelAgendaError,
  previewPainelAgendaRange,
} from "@/lib/painel-agenda";
import { authenticateOperationsRequest } from "@/lib/ops-auth";
import { authorizePainelApiAccess } from "@/lib/painel-api-auth";

export const runtime = "nodejs";

type RangeCheckPayload = {
  excludeAgendaId?: unknown;
  startDate?: unknown;
  endDate?: unknown;
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
    return (await request.json()) as RangeCheckPayload;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
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

  try {
    const data = await previewPainelAgendaRange({
      excludeAgendaId:
        Number.isInteger(Number(payload?.excludeAgendaId)) &&
        Number(payload?.excludeAgendaId) > 0
          ? Number(payload?.excludeAgendaId)
          : null,
      startDate:
        typeof payload?.startDate === "string" ? payload.startDate.trim() : "",
      endDate: typeof payload?.endDate === "string" ? payload.endDate.trim() : "",
    });

    return NextResponse.json({
      ok: true,
      data,
    });
  } catch (error) {
    const operationError = asPainelAgendaError(error);

    console.error("painel-agenda-range-check-failed", error);

    return errorResponse(
      operationError.code,
      operationError.message,
      operationError.status,
    );
  }
}
