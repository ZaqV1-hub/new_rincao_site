import {
  asPainelConvenioImportError,
  getPainelConvenioImportLog,
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
    const importId = searchParams.get("importId");
    const log = await getPainelConvenioImportLog({
      agreementId: params.agreementId,
      importId,
    });

    return new Response(log, {
      status: 200,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "content-disposition": 'attachment; filename="Erros.txt"',
      },
    });
  } catch (error) {
    const operationError = asPainelConvenioImportError(error);
    return Response.json(
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
