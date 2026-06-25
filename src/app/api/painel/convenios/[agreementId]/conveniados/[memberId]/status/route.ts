import { NextResponse } from "next/server";
import {
  asPainelConvenioMembersError,
  togglePainelConvenioMemberStatus,
} from "@/lib/painel-convenio-members";
import { requirePainelApiAccess } from "@/lib/painel-api-auth";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ agreementId: string; memberId: string }> },
) {
  const access = await requirePainelApiAccess(request, ["vis_conve"]);
  if (!access.ok) {
    return access.response;
  }

  try {
    const params = await context.params;
    const payload = (await request.json().catch(() => null)) as
      | { status?: unknown }
      | null;
    const data = await togglePainelConvenioMemberStatus({
      agreementId: params.agreementId,
      memberId: params.memberId,
      status: payload?.status,
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
