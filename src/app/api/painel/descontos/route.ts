import { NextResponse } from "next/server";
import {
  asPainelDescontosError,
  createPainelDiscount,
  listPainelDiscounts,
} from "@/lib/painel-descontos";
import { requirePainelApiAccess } from "@/lib/painel-api-auth";

export async function GET(request: Request) {
  const access = await requirePainelApiAccess(request, ["vis_desc"]);
  if (!access.ok) return access.response;

  try {
    const { searchParams } = new URL(request.url);
    const data = await listPainelDiscounts({
      page: searchParams.get("page"),
    });
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    const operationError = asPainelDescontosError(error);
    return NextResponse.json(
      { ok: false, error: { code: operationError.code, message: operationError.message } },
      { status: operationError.status },
    );
  }
}

export async function POST(request: Request) {
  const access = await requirePainelApiAccess(request, ["vis_desc"]);
  if (!access.ok) return access.response;

  try {
    const payload = (await request.json().catch(() => null)) as { values?: PainelDiscountFormValues } | null;
    const data = await createPainelDiscount(
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

type PainelDiscountFormValues = {
  tipo_id: string;
  nome: string;
  tipo_aplicacao: string;
  valor: string;
};
