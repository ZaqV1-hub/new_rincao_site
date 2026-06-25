import { NextResponse } from "next/server";
import { listPainelPurchases } from "@/lib/painel-compras";
import { requirePainelApiAccess } from "@/lib/painel-api-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const access = await requirePainelApiAccess(request, "vis_compra");

  if (!access.ok) {
    return access.response;
  }

  try {
    const url = new URL(request.url);
    const filters = Object.fromEntries(url.searchParams.entries());
    const page = url.searchParams.get("page");
    const result = await listPainelPurchases({
      page,
      filters,
    });

    return NextResponse.json({
      ok: true,
      data: result,
    });
  } catch (error) {
    console.error("painel-compras-list-failed", error);

    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "painel_compras_list_failed",
          message: "Nao foi possivel carregar a lista de compras.",
        },
      },
      { status: 500 },
    );
  }
}
