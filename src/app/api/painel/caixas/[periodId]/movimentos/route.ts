import { createCashSessionMovement } from "@/lib/operational-cash-session";
import { cashPeriodId, readCashCommand, runCashSessionRoute } from "@/lib/operational-cash-route";

export function POST(request: Request, context: { params: Promise<{ periodId: string }> }) {
  return runCashSessionRoute(request, async (actor) => {
    const periodId = await cashPeriodId(context);
    const input = await readCashCommand<Omit<Parameters<typeof createCashSessionMovement>[0], "periodId">>(request, ["type", "responsible", "amountCents", "reason", "idempotencyKey"]);
    return Response.json({ ok: true, data: await createCashSessionMovement({ ...input, periodId }, actor) });
  });
}
