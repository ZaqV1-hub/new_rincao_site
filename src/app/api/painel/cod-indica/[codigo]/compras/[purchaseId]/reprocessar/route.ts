import { NextResponse } from "next/server";
import {
  asPainelCodIndicaError,
  reprocessPainelCodIndicaPurchase,
} from "@/lib/painel-cod-indica";
import { requirePainelApiAccess } from "@/lib/painel-api-auth";

export async function POST(
  request: Request,
  context: { params: Promise<{ codigo: string; purchaseId: string }> },
) {
  const access = await requirePainelApiAccess(request, ["vis_indica"]);
  if (!access.ok) {
    return access.response;
  }

  try {
    const payload = (await request.json().catch(() => null)) as
      | { actorRoleId?: unknown }
      | null;
    const { codigo, purchaseId } = await context.params;
    const data = await reprocessPainelCodIndicaPurchase(
      codigo,
      Number(purchaseId),
      typeof payload?.actorRoleId === "number"
        ? payload.actorRoleId
        : (access.session.legacyRoleId ?? null),
    );
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    const mapped = asPainelCodIndicaError(error);
    return NextResponse.json(
      { ok: false, error: { code: mapped.code, message: mapped.message } },
      { status: mapped.status },
    );
  }
}
