import { NextResponse } from "next/server";
import {
  asPainelCodIndicaError,
  removePainelCodIndica,
} from "@/lib/painel-cod-indica";
import { requirePainelApiAccess } from "@/lib/painel-api-auth";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ codigo: string }> },
) {
  const access = await requirePainelApiAccess(request, ["vis_indica"]);
  if (!access.ok) {
    return access.response;
  }

  try {
    const { codigo } = await context.params;
    const data = await removePainelCodIndica(codigo);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    const mapped = asPainelCodIndicaError(error);
    return NextResponse.json(
      { ok: false, error: { code: mapped.code, message: mapped.message } },
      { status: mapped.status },
    );
  }
}
