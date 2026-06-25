import { NextResponse } from "next/server";
import {
  asPainelDescontosError,
  getPainelDiscountType,
  updatePainelDiscountType,
} from "@/lib/painel-descontos";
import { requirePainelApiAccess } from "@/lib/painel-api-auth";

type PainelDiscountTypeFormValues = {
  descricao: string;
};

export async function GET(
  request: Request,
  context: { params: Promise<{ typeId: string }> },
) {
  const access = await requirePainelApiAccess(request, ["vis_desc"]);
  if (!access.ok) return access.response;

  try {
    const { typeId } = await context.params;
    const data = await getPainelDiscountType(typeId);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    const operationError = asPainelDescontosError(error);
    return NextResponse.json(
      { ok: false, error: { code: operationError.code, message: operationError.message } },
      { status: operationError.status },
    );
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ typeId: string }> },
) {
  const access = await requirePainelApiAccess(request, ["vis_desc"]);
  if (!access.ok) return access.response;

  try {
    const { typeId } = await context.params;
    const payload = (await request.json().catch(() => null)) as { values?: PainelDiscountTypeFormValues } | null;
    const data = await updatePainelDiscountType(
      typeId,
      (payload?.values ?? { descricao: "" }) as PainelDiscountTypeFormValues,
    );
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    const operationError = asPainelDescontosError(error);
    return NextResponse.json(
      { ok: false, error: { code: operationError.code, message: operationError.message } },
      { status: operationError.status },
    );
  }
}
