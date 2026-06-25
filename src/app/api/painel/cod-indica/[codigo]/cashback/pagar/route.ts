import { NextResponse } from "next/server";
import {
  asPainelCodIndicaError,
  payPainelCodIndicaCashback,
  type PainelCodIndicaCashbackPaymentValues,
} from "@/lib/painel-cod-indica";
import { requirePainelApiAccess } from "@/lib/painel-api-auth";

export async function POST(
  request: Request,
  context: { params: Promise<{ codigo: string }> },
) {
  const access = await requirePainelApiAccess(request, ["vis_indica"]);
  if (!access.ok) {
    return access.response;
  }

  try {
    const payload = (await request.json().catch(() => null)) as
      | {
          values?: PainelCodIndicaCashbackPaymentValues;
          actor?: { name?: string | null; cpf?: string | null };
        }
      | null;
    const { codigo } = await context.params;
    const data = await payPainelCodIndicaCashback(
      codigo,
      (payload?.values ?? {}) as PainelCodIndicaCashbackPaymentValues,
      {
        roleId: access.session.legacyRoleId ?? null,
        cpf: payload?.actor?.cpf ?? access.session.actorCpf,
        name: payload?.actor?.name ?? access.session.actorName,
      },
    );
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    const mapped = asPainelCodIndicaError(error);
    return NextResponse.json(
      { ok: false, error: { code: mapped.code, message: mapped.message } },
      { status: mapped.status },
    );
  }
}
