import type { ChargebackAutomationStatus } from "@/lib/chargeback-contract";
import { getOperationalJobHealth } from "@/lib/ops-job-runs";
import { listChargebackCases } from "@/lib/chargeback-repository";
import { requirePainelApiAccess } from "@/lib/painel-api-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const access = await requirePainelApiAccess(request, "vis_compra");
  if (!access.ok) return access.response;

  const rawOffset = new URL(request.url).searchParams.get("offset") ?? "0";
  const offset = Number(rawOffset);
  if (!/^\d+$/.test(rawOffset) || !Number.isSafeInteger(offset)) {
    return Response.json({ ok: false, error: { message: "Página inválida." } }, { status: 400 });
  }

  try {
    const result = await listChargebackCases({ limit: 20, offset });
    const enabled = process.env.CIELO_CHARGEBACK_ENABLED?.trim() === "true";
    const automation: ChargebackAutomationStatus = {
      enabled, status: enabled ? "unavailable" : "disabled", lastRunAt: null, lastSuccessAt: null,
    };
    if (enabled) {
      try {
        const health = await getOperationalJobHealth({
          jobName: "chargebacks", triggerSource: "scheduled", maxAgeMinutes: 15,
        });
        automation.status = health.status;
        automation.lastRunAt = health.latestRun?.finishedAt ?? health.latestRun?.createdAt ?? null;
        automation.lastSuccessAt = health.lastSuccessAt;
      } catch {
        // Case monitoring remains available if the separate job history database fails.
      }
    }
    return Response.json(
      { ok: true, ...result, automation },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return Response.json(
      { ok: false, error: { message: "Consulta de contestações indisponível." } },
      { status: 503 },
    );
  }
}
