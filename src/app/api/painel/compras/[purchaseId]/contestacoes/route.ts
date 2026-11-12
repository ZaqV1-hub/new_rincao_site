import { listChargebackCases } from "@/lib/chargeback-repository";
import { requirePainelApiAccess } from "@/lib/painel-api-auth";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ purchaseId: string }> }) {
  const access = await requirePainelApiAccess(request, "vis_compra");
  if (!access.ok) return access.response;

  const { purchaseId: rawPurchaseId } = await params;
  const purchaseId = Number(rawPurchaseId);
  const rawOffset = new URL(request.url).searchParams.get("offset") ?? "0";
  const offset = Number(rawOffset);
  if (!/^\d+$/.test(rawPurchaseId) || purchaseId < 1 || purchaseId > 2_147_483_647) {
    return Response.json({ ok: false, error: { message: "Compra inválida." } }, { status: 400 });
  }
  if (!/^\d+$/.test(rawOffset) || !Number.isSafeInteger(offset)) {
    return Response.json({ ok: false, error: { message: "Página inválida." } }, { status: 400 });
  }

  try {
    const result = await listChargebackCases({ purchaseId, limit: 20, offset });
    return Response.json(
      { ok: true, ...result },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return Response.json(
      { ok: false, error: { message: "Consulta de contestações indisponível." } },
      { status: 503 },
    );
  }
}
