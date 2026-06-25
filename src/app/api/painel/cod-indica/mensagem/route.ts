import { NextResponse } from "next/server";
import {
  asPainelCodIndicaError,
  getPainelCodIndicaMessage,
  savePainelCodIndicaMessage,
  type PainelCodIndicaMessageValues,
} from "@/lib/painel-cod-indica";
import { requirePainelApiAccess } from "@/lib/painel-api-auth";

export async function GET(request: Request) {
  const access = await requirePainelApiAccess(request, ["vis_indica"]);
  if (!access.ok) {
    return access.response;
  }

  try {
    const data = await getPainelCodIndicaMessage();
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    const mapped = asPainelCodIndicaError(error);
    return NextResponse.json(
      { ok: false, error: { code: mapped.code, message: mapped.message } },
      { status: mapped.status },
    );
  }
}

export async function PUT(request: Request) {
  const access = await requirePainelApiAccess(request, ["vis_indica"]);
  if (!access.ok) {
    return access.response;
  }

  try {
    const payload = (await request.json().catch(() => null)) as
      | { values?: PainelCodIndicaMessageValues }
      | null;
    const data = await savePainelCodIndicaMessage(
      (payload?.values ?? {}) as PainelCodIndicaMessageValues,
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
