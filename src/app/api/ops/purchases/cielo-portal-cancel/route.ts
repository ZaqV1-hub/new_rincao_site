import { NextResponse } from "next/server";
import { authenticateOperationsRequest } from "@/lib/ops-auth";
import { authorizePainelApiAccess } from "@/lib/painel-api-auth";
import { CieloPortalCancellationError, markCieloPortalCancelled } from "@/lib/cielo-portal-cancellation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = authenticateOperationsRequest(request, { requiredPermission: "ops.purchases" });
  if (!auth.ok) return auth.response;
  const painelAuth = await authorizePainelApiAccess(request, "vis_compra");
  if (!painelAuth.ok) return painelAuth.response;

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  try {
    const result = await markCieloPortalCancelled({
      purchaseId: Number(body?.purchaseId),
      paymentId: String(body?.paymentId ?? ""),
      amount: Number(body?.amount),
      evidence: String(body?.evidence ?? ""),
      actorName: auth.actorName,
    });
    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    if (!(error instanceof CieloPortalCancellationError)) console.error("cielo-portal-cancellation-failed", error);
    const known = error instanceof CieloPortalCancellationError ? error : null;
    return NextResponse.json({ ok: false, error: {
      code: known?.code ?? "portal_cancellation_unavailable",
      message: known?.message ?? "Nao foi possivel registrar o cancelamento externo.",
    } }, { status: known?.status ?? 502 });
  }
}
