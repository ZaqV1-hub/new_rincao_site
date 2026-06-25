import { NextResponse } from "next/server";
import {
  asPainelConvenioMembersError,
  getPainelConvenioMemberDetail,
  updatePainelConvenioMember,
} from "@/lib/painel-convenio-members";
import { requirePainelApiAccess } from "@/lib/painel-api-auth";

export async function GET(
  request: Request,
  context: { params: Promise<{ agreementId: string; memberId: string }> },
) {
  const access = await requirePainelApiAccess(request, ["vis_conve"]);
  if (!access.ok) {
    return access.response;
  }

  try {
    const params = await context.params;
    const data = await getPainelConvenioMemberDetail({
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

export async function PUT(
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
      | { values?: unknown }
      | null;
    const data = await updatePainelConvenioMember({
      agreementId: params.agreementId,
      memberId: params.memberId,
      values: (payload?.values ?? {}) as {
        cpf: string;
        qtcompradia: string;
        dtiniado: string;
        dtfimado: string;
      },
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
