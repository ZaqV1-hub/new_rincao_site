import { authenticateOperationsJobRequest } from "@/lib/ops-auth";
import { runChargebackSync } from "@/lib/chargeback-sync";
import { recordOperationalJobRun } from "@/lib/ops-job-runs";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = authenticateOperationsJobRequest(request);
  if (!auth.ok) return auth.response;
  const startedAt = new Date().toISOString();
  try {
    const data = await runChargebackSync();
    if (data) {
      await recordOperationalJobRun({ jobName: "chargebacks", triggerSource: "scheduled", initiatedBy: "scheduler", status: data.failed ? "partial" : "success", message: "Processamento automático de contestações concluído.", summary: data, startedAt: data.startedAt, finishedAt: data.finishedAt });
    }
    return Response.json({ ok: true, data }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    await recordOperationalJobRun({ jobName: "chargebacks", triggerSource: "scheduled", initiatedBy: "scheduler", status: "failed", message: "Falha no processamento de contestações. Verifique configuração, conectividade e banco.", summary: {}, startedAt, finishedAt: new Date().toISOString() }).catch(() => undefined);
    return Response.json({ ok: false, error: { code: "chargeback_job_failed", message: "Não foi possível concluir o processamento automático de contestações." } }, { status: 503 });
  }
}
