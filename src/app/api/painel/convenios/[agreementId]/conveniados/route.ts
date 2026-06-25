import { NextResponse } from "next/server";
import {
  asPainelConvenioMembersError,
  createPainelConvenioMember,
  listPainelConvenioMembers,
} from "@/lib/painel-convenio-members";
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
    const { searchParams } = new URL(request.url);
    const filters = Object.fromEntries(searchParams.entries());
    const data = await listPainelConvenioMembers({
      agreementId: params.agreementId,
      filters,
      page: searchParams.get("page"),
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

export async function POST(
  request: Request,
  context: { params: Promise<{ agreementId: string }> },
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
    const data = await createPainelConvenioMember({
      agreementId: params.agreementId,
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
