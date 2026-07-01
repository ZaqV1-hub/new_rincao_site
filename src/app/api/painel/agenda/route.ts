import { NextResponse } from "next/server";
import {
  asPainelAgendaError,
  getPainelAgendaDay,
  upsertPainelAgendaRange,
  type PainelAgendaMutationInput,
} from "@/lib/painel-agenda";
import { authenticateOperationsRequest } from "@/lib/ops-auth";
import { authorizePainelApiAccess } from "@/lib/painel-api-auth";

export const runtime = "nodejs";

type AgendaMutationPayload = {
  agendaId?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  priceTableId?: unknown;
  informationId?: unknown;
  type?: unknown;
  status?: unknown;
  promotionName?: unknown;
  promotionDescription?: unknown;
  confirmOverwrite?: unknown;
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
    return (await request.json()) as AgendaMutationPayload;
  } catch {
    return null;
  }
}

function parseInput(payload: AgendaMutationPayload | null): PainelAgendaMutationInput {
  return {
    agendaId:
      Number.isInteger(Number(payload?.agendaId)) && Number(payload?.agendaId) > 0
        ? Number(payload?.agendaId)
        : null,
    startDate:
      typeof payload?.startDate === "string" ? payload.startDate.trim() : "",
    endDate: typeof payload?.endDate === "string" ? payload.endDate.trim() : "",
    priceTableId: Number(payload?.priceTableId),
    informationId: Number(payload?.informationId),
    type: String(payload?.type ?? "").trim() as PainelAgendaMutationInput["type"],
    status: String(payload?.status ?? "").trim() as PainelAgendaMutationInput["status"],
    promotionName:
      typeof payload?.promotionName === "string"
        ? payload.promotionName
        : null,
    promotionDescription:
      typeof payload?.promotionDescription === "string"
        ? payload.promotionDescription
        : null,
    confirmOverwrite: payload?.confirmOverwrite === true,
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
  };
}

function readDateParam(request: Request) {
  const url = new URL(request.url);
  const date = url.searchParams.get("date")?.trim() ?? "";

  return date;
}

export async function GET(request: Request) {
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

  const date = readDateParam(request);

  if (!date) {
    return errorResponse(
      "agenda_invalid_date",
      "Informe a data selecionada em formato valido.",
      400,
    );
  }

  try {
    const data = await getPainelAgendaDay(date);

    return NextResponse.json({
      ok: true,
      data,
    });
  } catch (error) {
    const operationError = asPainelAgendaError(error);

    console.error("painel-agenda-day-load-failed", error);

    return errorResponse(
      operationError.code,
      operationError.message,
      operationError.status,
    );
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
    const data = await upsertPainelAgendaRange(parseInput(payload));

    return NextResponse.json({
      ok: true,
      data,
    });
  } catch (error) {
    const operationError = asPainelAgendaError(error);

    console.error("painel-agenda-upsert-failed", error);

    return errorResponse(
      operationError.code,
      operationError.message,
      operationError.status,
    );
  }
}
