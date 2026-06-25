import { NextResponse } from "next/server";
import {
  asPainelDescontosError,
  removePainelDiscountType,
} from "@/lib/painel-descontos";
import { requirePainelApiAccess } from "@/lib/painel-api-auth";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ typeId: string }> },
) {
  const access = await requirePainelApiAccess(request, ["vis_desc"]);
  if (!access.ok) return access.response;

  try {
    const { typeId } = await context.params;
    const data = await removePainelDiscountType(typeId);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    const operationError = asPainelDescontosError(error);
    return NextResponse.json(
      { ok: false, error: { code: operationError.code, message: operationError.message } },
      { status: operationError.status },
    );
  }
}
