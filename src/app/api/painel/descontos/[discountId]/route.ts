import { NextResponse } from "next/server";
import {
  asPainelDescontosError,
  getPainelDiscount,
  updatePainelDiscount,
} from "@/lib/painel-descontos";
import { requirePainelApiAccess } from "@/lib/painel-api-auth";

type PainelDiscountFormValues = {
  tipo_id: string;
  nome: string;
  tipo_aplicacao: string;
  valor: string;
};

export async function GET(
  request: Request,
  context: { params: Promise<{ discountId: string }> },
) {
  const access = await requirePainelApiAccess(request, ["vis_desc"]);
  if (!access.ok) return access.response;

  try {
    const { discountId } = await context.params;
    const data = await getPainelDiscount(discountId);
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
  context: { params: Promise<{ discountId: string }> },
) {
  const access = await requirePainelApiAccess(request, ["vis_desc"]);
  if (!access.ok) return access.response;

  try {
    const { discountId } = await context.params;
    const payload = (await request.json().catch(() => null)) as { values?: PainelDiscountFormValues } | null;
    const data = await updatePainelDiscount(
      discountId,
      (payload?.values ?? {
        tipo_id: "",
        nome: "",
        tipo_aplicacao: "",
        valor: "",
      }) as PainelDiscountFormValues,
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
