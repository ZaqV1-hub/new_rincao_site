import { NextResponse } from "next/server";
import {
  asPainelConvenioImportError,
  getPainelConvenioImportState,
} from "@/lib/painel-convenio-import";
import { requirePainelApiAccess } from "@/lib/painel-api-auth";

export async function GET(
  request: Request,
  context: { params: Promise<{ agreementId: string }> },
) {
  const access = await requirePainelApiAccess(request, ["vis_conve"]);
  if (!access.ok) {
    return access.response;
  }

  try {
    const params = await context.params;
    const { searchParams } = new URL(request.url);
    const data = await getPainelConvenioImportState({
      agreementId: params.agreementId,
      importId: searchParams.get("importId"),
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
