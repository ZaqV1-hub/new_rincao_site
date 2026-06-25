import { NextResponse } from "next/server";
import {
  asPainelCompraConvenioError,
  listPainelCompraConvenio,
  mapPainelCompraConvenioExportRows,
  renderPainelCompraConvenioExportTable,
} from "@/lib/painel-compra-convenio";
import { requirePainelApiAccess } from "@/lib/painel-api-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const access = await requirePainelApiAccess(request, ["vis_compra", "vis_conve"]);
  if (!access.ok) {
    return access.response;
  }

  try {
    const url = new URL(request.url);
    const filters = Object.fromEntries(url.searchParams.entries());
    const result = await listPainelCompraConvenio(filters);
    const rows = mapPainelCompraConvenioExportRows(result);
    const body = renderPainelCompraConvenioExportTable(rows);

    return new NextResponse(body, {
      status: 200,
      headers: {
        "content-type": "application/vnd.ms-excel; charset=utf-8",
        "content-disposition": 'attachment; filename="compras-reservas.xls"',
      },
    });
  } catch (error) {
    const operationError = asPainelCompraConvenioError(error);
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
