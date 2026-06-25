import { NextResponse } from "next/server";
import { getPublicAgendaEventById } from "@/lib/agenda-repository";
import { parseAgendaId } from "@/lib/agenda-id";
import type {
  BffErrorResponse,
  PublicAgendaDetailResponse,
} from "@/lib/agenda-contracts";

export const runtime = "nodejs";

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json<BffErrorResponse>(
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

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const agendaId = parseAgendaId(id);

  if (!agendaId) {
    return errorResponse(
      "invalid_agenda_id",
      "Informe um identificador de agenda valido.",
      400,
    );
  }

  try {
    const event = await getPublicAgendaEventById(agendaId);

    if (!event) {
      return errorResponse(
        "agenda_not_found",
        "Agenda publica nao encontrada.",
        404,
      );
    }

    return NextResponse.json<PublicAgendaDetailResponse>({
      ok: true,
      data: event,
    });
  } catch (error) {
    console.error("public-agenda-detail-bff-failed", error);

    return errorResponse(
      "agenda_unavailable",
      "Nao foi possivel consultar a agenda publica agora.",
      502,
    );
  }
}
