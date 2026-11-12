import { getCashSession } from "@/lib/operational-cash-session";
import { cashPeriodId, cashQuery, runCashSessionRoute } from "@/lib/operational-cash-route";

export function GET(request: Request, context: { params: Promise<{ periodId: string }> }) {
  return runCashSessionRoute(request, async () => {
    cashQuery(request);
    return Response.json({ ok: true, data: await getCashSession(await cashPeriodId(context)) });
  });
}
