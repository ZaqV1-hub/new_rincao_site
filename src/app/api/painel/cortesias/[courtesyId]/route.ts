import { NextResponse } from "next/server";
import {
  asPainelCortesiasError,
  getPainelCortesia,
  updatePainelCortesia,
  type PainelCortesiaFormValues,
} from "@/lib/painel-cortesias";
import { requirePainelApiAccess } from "@/lib/painel-api-auth";

export async function GET(
  request: Request,
  context: { params: Promise<{ courtesyId: string }> },
) {
  const access = await requirePainelApiAccess(request, ["vis_cort"]);
  if (!access.ok) return access.response;

  try {
    const { courtesyId } = await context.params;
    const data = await getPainelCortesia(courtesyId);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    const operationError = asPainelCortesiasError(error);
    return NextResponse.json(
      { ok: false, error: { code: operationError.code, message: operationError.message } },
      { status: operationError.status },
    );
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ courtesyId: string }> },
) {
  const access = await requirePainelApiAccess(request, ["vis_cort"]);
  if (!access.ok) return access.response;

  try {
    const { courtesyId } = await context.params;
    const payload = (await request.json().catch(() => null)) as { values?: PainelCortesiaFormValues } | null;
    const data = await updatePainelCortesia(
      courtesyId,
      (payload?.values ?? { nome: "" }) as PainelCortesiaFormValues,
    );
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    const operationError = asPainelCortesiasError(error);
    return NextResponse.json(
      { ok: false, error: { code: operationError.code, message: operationError.message } },
      { status: operationError.status },
    );
  }
}
