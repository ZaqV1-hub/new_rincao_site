import { NextResponse } from "next/server";
import {
  asPainelCodIndicaError,
  createPainelCodIndica,
  listPainelCodIndica,
  type PainelCodIndicaFormValues,
} from "@/lib/painel-cod-indica";
import { requirePainelApiAccess } from "@/lib/painel-api-auth";

export async function GET(request: Request) {
  const access = await requirePainelApiAccess(request, ["vis_indica"]);
  if (!access.ok) {
    return access.response;
  }

  const { searchParams } = new URL(request.url);
  const filters = Object.fromEntries(searchParams.entries());
  const data = await listPainelCodIndica({
    page: searchParams.get("page"),
    filters,
  });

  return NextResponse.json({ ok: true, data });
}

export async function POST(request: Request) {
  const access = await requirePainelApiAccess(request, ["vis_indica"]);
  if (!access.ok) {
    return access.response;
  }

  try {
    const payload = (await request.json().catch(() => null)) as
      | { values?: PainelCodIndicaFormValues }
      | null;
    const data = await createPainelCodIndica(
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
