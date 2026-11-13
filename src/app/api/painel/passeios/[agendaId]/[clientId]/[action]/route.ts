import { changeTripSettlement } from '@/lib/trip-settlement';
import { financialTripKey,readTripFinancialBody,runTripFinancialRoute } from '@/lib/trip-settlement-route';
export const runtime = 'nodejs';
export function POST(request: Request,context: { params: Promise<{ agendaId: string; clientId: string; action: string }> }) {
  return runTripFinancialRoute(request,async actor => { const params = await context.params; return Response.json({ ok: true,data: await changeTripSettlement(financialTripKey(params),params.action,await readTripFinancialBody(request),actor) }); });
}
