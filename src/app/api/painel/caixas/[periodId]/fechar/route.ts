import { closeCashSession } from "@/lib/operational-cash-session";
import { cashPeriodId, readCashCommand, runCashSessionRoute } from "@/lib/operational-cash-route";

export function POST(request: Request, context: { params: Promise<{ periodId: string }> }) {
  return runCashSessionRoute(request, async (actor) => {
    const periodId = await cashPeriodId(context);
    const input = await readCashCommand<Omit<Parameters<typeof closeCashSession>[0], "periodId">>(request, ["countedCashCents", "reason", "idempotencyKey"]);
    return Response.json({ ok: true, data: await closeCashSession({ ...input, periodId }, actor) });
  });
}
