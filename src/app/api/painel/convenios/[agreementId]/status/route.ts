import { NextResponse } from "next/server";
import {
  asPainelConveniosError,
  togglePainelConvenioStatus,
} from "@/lib/painel-convenios";
import { requirePainelApiAccess } from "@/lib/painel-api-auth";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ agreementId: string }> },
) {
  const access = await requirePainelApiAccess(request, ["vis_conve"]);
  if (!access.ok) {
    return access.response;
  }

  try {
    const payload = (await request.json().catch(() => null)) as
      | { status?: unknown }
      | null;
    const params = await context.params;
    const data = await togglePainelConvenioStatus({
      agreementId: params.agreementId,
      status: payload?.status,
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
