import { NextResponse } from "next/server";
import { asPainelCortesiasError, removePainelCortesia } from "@/lib/painel-cortesias";
import { requirePainelApiAccess } from "@/lib/painel-api-auth";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ courtesyId: string }> },
) {
  const access = await requirePainelApiAccess(request, ["vis_cort"]);
  if (!access.ok) return access.response;

  try {
    const { courtesyId } = await context.params;
    const data = await removePainelCortesia(courtesyId);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    const operationError = asPainelCortesiasError(error);
    return NextResponse.json(
      { ok: false, error: { code: operationError.code, message: operationError.message } },
      { status: operationError.status },
    );
  }
}
