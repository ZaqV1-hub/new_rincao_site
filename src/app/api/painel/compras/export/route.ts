import { NextResponse } from "next/server";
import {
  listPainelPurchases,
  mapPainelPurchaseListExportRows,
  renderPainelPurchaseListExportTable,
} from "@/lib/painel-compras";
import { requirePainelApiAccess } from "@/lib/painel-api-auth";

export const runtime = "nodejs";

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
    console.error("painel-compras-export-failed", error);

    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "painel_compras_export_failed",
          message: "Nao foi possivel exportar a lista de compras.",
        },
      },
      { status: 500 },
    );
  }
}
