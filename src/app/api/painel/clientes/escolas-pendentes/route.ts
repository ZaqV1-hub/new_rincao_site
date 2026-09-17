import { NextResponse } from "next/server";
import { requirePainelApiAccess } from "@/lib/painel-api-auth";
import { listSchoolsPendingClassification } from "@/lib/school-profile";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const access = await requirePainelApiAccess(request, ["vis_clientes", "vis_escola"]);
  if (!access.ok) return access.response;

  try {
    const schools = await listSchoolsPendingClassification();
    return NextResponse.json({ ok: true, data: { schools } });
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: "pending_schools_unavailable", message: "Não foi possível carregar as escolas pendentes." } },
      { status: 502 },
    );
  }
}
