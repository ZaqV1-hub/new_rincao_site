import { NextResponse } from "next/server";
import {
  asPainelDescontosError,
  createPainelDiscountType,
  listPainelDiscountTypes,
} from "@/lib/painel-descontos";
import { requirePainelApiAccess } from "@/lib/painel-api-auth";

type PainelDiscountTypeFormValues = {
  descricao: string;
};

export async function GET(request: Request) {
  const access = await requirePainelApiAccess(request, ["vis_desc"]);
  if (!access.ok) return access.response;

  try {
    const { searchParams } = new URL(request.url);
    const data = await listPainelDiscountTypes({
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
    const payload = (await request.json().catch(() => null)) as { values?: PainelDiscountTypeFormValues } | null;
    const data = await createPainelDiscountType(
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
