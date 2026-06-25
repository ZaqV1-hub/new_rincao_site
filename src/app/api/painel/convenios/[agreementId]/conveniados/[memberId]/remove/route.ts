import { NextResponse } from "next/server";
import {
  asPainelConvenioMembersError,
  removePainelConvenioMember,
} from "@/lib/painel-convenio-members";
import { requirePainelApiAccess } from "@/lib/painel-api-auth";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ agreementId: string; memberId: string }> },
) {
  const access = await requirePainelApiAccess(request, ["vis_conve"]);
  if (!access.ok) {
    return access.response;
  }

  try {
    const params = await context.params;
    const data = await removePainelConvenioMember({
      agreementId: params.agreementId,
      memberId: params.memberId,
    });
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    const operationError = asPainelConvenioMembersError(error);
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
