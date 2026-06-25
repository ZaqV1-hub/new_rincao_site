import { NextResponse } from "next/server";
import {
  asPainelCortesiasError,
  createPainelCortesia,
  listPainelCortesias,
  type PainelCortesiaFormValues,
} from "@/lib/painel-cortesias";
import { requirePainelApiAccess } from "@/lib/painel-api-auth";

export async function GET(request: Request) {
  const access = await requirePainelApiAccess(request, ["vis_cort"]);
  if (!access.ok) return access.response;

  try {
    const { searchParams } = new URL(request.url);
    const data = await listPainelCortesias({
      page: searchParams.get("page"),
      perPage: searchParams.get("pp"),
    });
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    const operationError = asPainelCortesiasError(error);
    return NextResponse.json(
      { ok: false, error: { code: operationError.code, message: operationError.message } },
      { status: operationError.status },
    );
  }
}

export async function POST(request: Request) {
  const access = await requirePainelApiAccess(request, ["vis_cort"]);
  if (!access.ok) return access.response;

  try {
    const payload = (await request.json().catch(() => null)) as { values?: PainelCortesiaFormValues } | null;
    const data = await createPainelCortesia(
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
