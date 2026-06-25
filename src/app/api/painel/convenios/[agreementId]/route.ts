import { NextResponse } from "next/server";
import {
  asPainelConveniosError,
  getPainelConvenioDetail,
  updatePainelConvenio,
} from "@/lib/painel-convenios";
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
    const data = await getPainelConvenioDetail(params.agreementId);
    return NextResponse.json({ ok: true, data });
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

export async function PUT(
  request: Request,
  context: { params: Promise<{ agreementId: string }> },
) {
  const access = await requirePainelApiAccess(request, ["vis_conve"]);
  if (!access.ok) {
    return access.response;
  }

  try {
    const payload = (await request.json().catch(() => null)) as
      | { values?: unknown }
      | null;
    const params = await context.params;
    const data = await updatePainelConvenio({
      agreementId: params.agreementId,
      values: (payload?.values ?? {}) as {
        nmconvenio: string;
        dtini: string;
        dtfim: string;
        idtabpreco: string;
      },
    });
    return NextResponse.json({ ok: true, data });
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
