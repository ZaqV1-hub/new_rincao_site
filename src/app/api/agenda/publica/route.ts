import { NextResponse } from "next/server";
import { getPublicAgendaEvents } from "@/lib/agenda-repository";
import type {
  BffErrorResponse,
  PublicAgendaResponse,
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

function parseMonthYear(request: Request) {
  const url = new URL(request.url);
  const now = new Date();
  const monthParam = url.searchParams.get("mes") ?? url.searchParams.get("month");
  const yearParam = url.searchParams.get("ano") ?? url.searchParams.get("year");
  const month = monthParam ? Number(monthParam) : now.getMonth() + 1;
  const year = yearParam ? Number(yearParam) : now.getFullYear();

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return { valid: false as const, month, year };
  }

  if (!Number.isInteger(year) || year < 2020 || year > 2100) {
    return { valid: false as const, month, year };
  }

  return { valid: true as const, month, year };
}

export async function GET(request: Request) {
  const params = parseMonthYear(request);

  if (!params.valid) {
    return errorResponse(
      "invalid_month_year",
      "Informe mes e ano validos para consultar a agenda publica.",
      400,
    );
  }

  try {
    const events = await getPublicAgendaEvents(params.month, params.year);

    return NextResponse.json<PublicAgendaResponse>({
      ok: true,
      data: {
        month: params.month,
        year: params.year,
        events,
      },
    });
  } catch (error) {
    console.error("public-agenda-bff-failed", error);

    return errorResponse(
      "agenda_unavailable",
      "Nao foi possivel consultar a agenda publica agora.",
      502,
    );
  }
}
