import { NextResponse } from "next/server";
import {
  asPainelConvenioImportError,
  stagePainelConvenioImport,
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
    const formData = await request.formData();
    const file = formData.get("qqfile");
    const csvText = file instanceof File ? await file.text() : "";
    const data = await stagePainelConvenioImport({
      agreementId: params.agreementId,
      csvText,
      actor: {
        name: access.session.actorName,
        cpf: access.session.actorCpf,
      },
    });
    return NextResponse.json({
      ok: true,
      data: {
        stage: data,
        message: "Leitura do Arquivo CSV finalizada.",
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
