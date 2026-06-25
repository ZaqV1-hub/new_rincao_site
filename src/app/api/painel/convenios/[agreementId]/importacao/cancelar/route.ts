import { NextResponse } from "next/server";
import {
  asPainelConvenioImportError,
  cancelPainelConvenioImport,
} from "@/lib/painel-convenio-import";
import { requirePainelApiAccess } from "@/lib/painel-api-auth";

export async function POST(
  request: Request,
  context: { params: Promise<{ agreementId: string }> },
) {
  const access = await requirePainelApiAccess(request, ["vis_conve"]);
  if (!access.ok) {
    return access.response;
  }

  try {
    const params = await context.params;
    const payload = (await request.json().catch(() => null)) as
      | { importId?: unknown }
      | null;
    const data = await cancelPainelConvenioImport({
      agreementId: params.agreementId,
      importId: payload?.importId,
    });
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    const operationError = asPainelConvenioImportError(error);
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: operationError.code,
          message: operationError.message,
        },
      },
      { status: operationError.status },
    );
  }
}
