import { NextResponse } from "next/server";
import { ClientObservationError } from "@/lib/client-observations";
import { requirePainelApiAccess } from "@/lib/painel-api-auth";
import { readJsonPayload } from "@/lib/ops-route-utils";
import { addSiteUserObservation, listSiteUserObservations } from "@/lib/site-user-observations";

export const runtime = "nodejs";

type Context = { params: Promise<{ cpf: string }> };

function errorResponse(error: unknown, fallback: string) {
  const known = error instanceof ClientObservationError ? error : null;
  return NextResponse.json(
    { ok: false, error: { code: known?.code ?? "observation_unavailable", message: known?.message ?? fallback } },
    { status: known?.status ?? 502 },
  );
}

export async function GET(request: Request, context: Context) {
  const access = await requirePainelApiAccess(request, ["vis_situsu"]);
  if (!access.ok) return access.response;
  try {
    const data = await listSiteUserObservations((await context.params).cpf);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return errorResponse(error, "Não foi possível consultar as observações.");
  }
}

export async function POST(request: Request, context: Context) {
  const access = await requirePainelApiAccess(request, ["vis_situsu"]);
  if (!access.ok) return access.response;
  try {
    const payload = await readJsonPayload<{ text?: unknown }>(request);
    const data = await addSiteUserObservation({
      cpf: (await context.params).cpf,
      text: payload?.text,
      actorName: access.session.actorName,
    });
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return errorResponse(error, "Não foi possível salvar a observação.");
  }
}
