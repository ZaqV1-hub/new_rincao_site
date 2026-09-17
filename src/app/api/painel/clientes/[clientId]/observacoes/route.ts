import { NextResponse } from "next/server";
import { addClientObservation, ClientObservationError } from "@/lib/client-observations";
import { requirePainelApiAccess } from "@/lib/painel-api-auth";
import { readJsonPayload } from "@/lib/ops-route-utils";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ clientId: string }> }) {
  const access = await requirePainelApiAccess(request, ["vis_clientes", "vis_escola"]);
  if (!access.ok) return access.response;
  try {
    const payload = await readJsonPayload<{ text?: unknown }>(request);
    const result = await addClientObservation({
      clientId: (await context.params).clientId,
      text: payload?.text,
      actorName: access.session.actorName,
    });
    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    const known = error instanceof ClientObservationError ? error : null;
    return NextResponse.json({ ok: false, error: { code: known?.code ?? "observation_unavailable", message: known?.message ?? "Não foi possível salvar a observação." } }, { status: known?.status ?? 502 });
  }
}
