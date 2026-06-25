import { NextResponse } from "next/server";
import {
  asPainelCodIndicaError,
  setPainelCodIndicaStatus,
} from "@/lib/painel-cod-indica";
import { requirePainelApiAccess } from "@/lib/painel-api-auth";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ codigo: string }> },
) {
  const access = await requirePainelApiAccess(request, ["vis_indica"]);
  if (!access.ok) {
    return access.response;
  }

  try {
    const payload = (await request.json().catch(() => null)) as
      | { status?: unknown }
      | null;
    const { codigo } = await context.params;
    const data = await setPainelCodIndicaStatus(codigo, String(payload?.status ?? ""));
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    const mapped = asPainelCodIndicaError(error);
    return NextResponse.json(
      { ok: false, error: { code: mapped.code, message: mapped.message } },
      { status: mapped.status },
    );
  }
}
