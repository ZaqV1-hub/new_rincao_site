import { NextResponse } from "next/server";
import { ClientObservationError, deleteClientObservation } from "@/lib/client-observations";
import { requirePainelApiAccess } from "@/lib/painel-api-auth";

export const runtime = "nodejs";

export async function DELETE(request: Request, context: { params: Promise<{ clientId: string; observationId: string }> }) {
  const access = await requirePainelApiAccess(request, ["vis_clientes", "vis_escola"]);
  if (!access.ok) return access.response;
  if (access.session.legacyRoleId !== 1) {
    return NextResponse.json({ ok: false, error: { code: "manager_required", message: "Apenas gerentes podem excluir observações." } }, { status: 403 });
  }
  try {
    const params = await context.params;
    await deleteClientObservation({ clientId: params.clientId, observationId: params.observationId });
    return NextResponse.json({ ok: true, data: {} });
  } catch (error) {
    const known = error instanceof ClientObservationError ? error : null;
    return NextResponse.json({ ok: false, error: { code: known?.code ?? "observation_unavailable", message: known?.message ?? "Não foi possível excluir a observação." } }, { status: known?.status ?? 502 });
  }
}
