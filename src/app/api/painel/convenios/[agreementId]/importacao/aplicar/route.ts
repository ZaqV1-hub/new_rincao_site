import { NextResponse } from "next/server";
import {
  applyPainelConvenioImport,
  asPainelConvenioImportError,
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
    const data = await applyPainelConvenioImport({
      agreementId: params.agreementId,
      importId: payload?.importId,
      actor: {
        name: access.session.actorName,
        cpf: access.session.actorCpf,
      },
    });
    return NextResponse.json({
      ok: true,
      data: {
        ...data,
        message: data.result.message,
      },
    });
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
