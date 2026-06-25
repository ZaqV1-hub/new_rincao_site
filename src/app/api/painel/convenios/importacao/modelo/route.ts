import { buildConvenioImportTemplateCsv } from "@/lib/painel-convenio-import";
import { requirePainelApiAccess } from "@/lib/painel-api-auth";

export async function GET(request: Request) {
  const access = await requirePainelApiAccess(request, ["vis_conve"]);
  if (!access.ok) {
    return access.response;
  }

  return new Response(buildConvenioImportTemplateCsv(), {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="modelo-importacao.csv"',
    },
  });
}
