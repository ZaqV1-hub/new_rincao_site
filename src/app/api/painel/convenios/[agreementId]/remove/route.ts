import { NextResponse } from "next/server";
import { asPainelConveniosError, removePainelConvenio } from "@/lib/painel-convenios";
import { requirePainelApiAccess } from "@/lib/painel-api-auth";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ agreementId: string }> },
) {
  const access = await requirePainelApiAccess(request, ["vis_conve"]);
  if (!access.ok) {
    return access.response;
  }

  try {
    const params = await context.params;
    const data = await removePainelConvenio({
      agreementId: params.agreementId,
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
