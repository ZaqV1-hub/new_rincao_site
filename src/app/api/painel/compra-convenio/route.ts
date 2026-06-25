import { NextResponse } from "next/server";
import {
  asPainelCompraConvenioError,
  listPainelCompraConvenio,
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
    const data = await listPainelCompraConvenio(filters);
    return NextResponse.json({ ok: true, data });
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
