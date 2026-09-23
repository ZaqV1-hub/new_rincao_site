import { NextResponse } from "next/server";
import {
  asPainelComprasError,
  listPainelPurchases,
  mapPainelPurchaseListExportRows,
  renderPainelPurchaseListExportTable,
} from "@/lib/painel-compras";
import { requirePainelApiAccess } from "@/lib/painel-api-auth";

export const runtime = "nodejs";
const MAX_EXPORT_ROWS = 10_000;

export async function GET(request: Request) {
  const access = await requirePainelApiAccess(request, "vis_compra");

  if (!access.ok) {
    return access.response;
  }

  try {
    const url = new URL(request.url);
    const filters = Object.fromEntries(
      [...url.searchParams.entries()].filter(([key]) => key !== "page" && key !== "perPage"),
    );
    const result = await listPainelPurchases({
      page: "1",
      filters,
      allRows: true,
      maxRows: MAX_EXPORT_ROWS,
    });
    const rows = mapPainelPurchaseListExportRows(result);
    const html = renderPainelPurchaseListExportTable(rows);

    return new NextResponse(html, {
      headers: {
        "content-type": "application/vnd.ms-excel; charset=utf-8",
        "content-disposition": 'attachment; filename="compras.xls"',
      },
    });
  } catch (error) {
    const mapped = asPainelComprasError(error);

    if (mapped.status >= 500) {
      console.error("painel-compras-export-failed", error);
    }

    return NextResponse.json(
      {
        ok: false,
        error: {
          code: mapped.code,
          message: mapped.message,
        },
      },
      { status: mapped.status },
    );
  }
}
