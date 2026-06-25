import { NextResponse } from "next/server";
import {
  asPainelConveniosError,
  createPainelConvenio,
  listPainelConvenios,
} from "@/lib/painel-convenios";
import { requirePainelApiAccess } from "@/lib/painel-api-auth";

export async function GET(request: Request) {
  const access = await requirePainelApiAccess(request, ["vis_conve"]);
  if (!access.ok) {
    return access.response;
  }

  const { searchParams } = new URL(request.url);
  const filters = Object.fromEntries(searchParams.entries());
  const data = await listPainelConvenios({
    page: searchParams.get("page"),
    filters,
  });

  return NextResponse.json({
    ok: true,
    data,
  });
}

export async function POST(request: Request) {
  const access = await requirePainelApiAccess(request, ["vis_conve"]);
  if (!access.ok) {
    return access.response;
  }

  try {
    const payload = (await request.json().catch(() => null)) as
      | { values?: unknown }
      | null;
    const data = await createPainelConvenio({
      values: (payload?.values ?? {}) as {
        nmconvenio: string;
        dtini: string;
        dtfim: string;
        idtabpreco: string;
      },
    });

    return NextResponse.json({
      ok: true,
      data,
    });
  } catch (error) {
    const operationError = asPainelConveniosError(error);
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
