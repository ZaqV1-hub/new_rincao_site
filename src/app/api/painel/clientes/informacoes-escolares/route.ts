import { NextResponse } from "next/server";
import { requirePainelApiAccess } from "@/lib/painel-api-auth";
import { updateSchoolVoucherInformation } from "@/lib/school-voucher-information";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  const access = await requirePainelApiAccess(request, ["vis_clientes", "vis_escola"]);
  if (!access.ok) return access.response;

  try {
    const payload = (await request.json()) as { text?: unknown };
    const text = await updateSchoolVoucherInformation(payload.text);
    return NextResponse.json({ ok: true, data: { text, message: "Informações escolares atualizadas." } });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: { code: "school_voucher_information_unavailable", message: error instanceof Error ? error.message : "Não foi possível salvar as informações escolares." } },
      { status: 400 },
    );
  }
}
