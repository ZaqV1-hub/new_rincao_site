import { NextResponse } from "next/server";
import {
  asPainelCodIndicaError,
  getPainelCodIndicaDetail,
  updatePainelCodIndica,
  type PainelCodIndicaFormValues,
} from "@/lib/painel-cod-indica";
import { requirePainelApiAccess } from "@/lib/painel-api-auth";

export async function GET(
  request: Request,
  context: { params: Promise<{ codigo: string }> },
) {
  const access = await requirePainelApiAccess(request, ["vis_indica"]);
  if (!access.ok) {
    return access.response;
  }

  try {
    const { codigo } = await context.params;
    const { searchParams } = new URL(request.url);
    const detail = await getPainelCodIndicaDetail(
      codigo,
      Object.fromEntries(searchParams.entries()),
    );
    return NextResponse.json({ ok: true, data: detail });
  } catch (error) {
    const mapped = asPainelCodIndicaError(error);
    return NextResponse.json(
      { ok: false, error: { code: mapped.code, message: mapped.message } },
      { status: mapped.status },
    );
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ codigo: string }> },
) {
  const access = await requirePainelApiAccess(request, ["vis_indica"]);
  if (!access.ok) {
    return access.response;
  }

  try {
    const payload = (await request.json().catch(() => null)) as
      | { values?: PainelCodIndicaFormValues }
      | null;
    const { codigo } = await context.params;
    const data = await updatePainelCodIndica(
      codigo,
      (payload?.values ?? {}) as PainelCodIndicaFormValues,
      access.session.actorCpf,
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
