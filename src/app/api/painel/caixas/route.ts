import { listCashSessions, openCashSession } from "@/lib/operational-cash-session";
import { cashQuery, invalidCashRequest, readCashCommand, runCashSessionRoute } from "@/lib/operational-cash-route";
import { isCivilDate } from "@/lib/operational-date";

export function GET(request: Request) {
  return runCashSessionRoute(request, async () => {
    const date = cashQuery(request, ["date"]).get("date") ?? "";
    if (!isCivilDate(date)) invalidCashRequest();
    return Response.json({ ok: true, data: await listCashSessions(date) });
  });
}
export function POST(request: Request) {
  return runCashSessionRoute(request, async (actor) => {
    const input = await readCashCommand<Parameters<typeof openCashSession>[0]>(request, ["date", "locationId", "openingCashCents", "idempotencyKey"]);
    return Response.json({ ok: true, data: await openCashSession(input, actor) }, { status: 201 });
  });
}
