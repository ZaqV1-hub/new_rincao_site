import { changeTripSettlement,getTripSettlement } from '@/lib/trip-settlement';
import { invalidTrip } from '@/lib/trip-settlement-contract';
import { financialTripKey,publicTripDetail,readTripFinancialBody,runTripFinancialRoute } from '@/lib/trip-settlement-route';
export const runtime = 'nodejs';
export function GET(request: Request,context: { params: Promise<{ agendaId: string; clientId: string }> }) {
  return runTripFinancialRoute(request,async actor => { if (new URL(request.url).search) return invalidTrip(); return Response.json({ ok: true,data: publicTripDetail(await getTripSettlement(financialTripKey(await context.params)),actor) }); });
}
export function POST(request: Request,context: { params: Promise<{ agendaId: string; clientId: string }> }) {
  return runTripFinancialRoute(request,async actor => {
    const body = await readTripFinancialBody(request);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return invalidTrip();
    const { action,...data } = body as Record<string,unknown>;
    if (typeof action !== 'string') return invalidTrip();
    return Response.json({ ok: true,data: await changeTripSettlement(financialTripKey(await context.params),action,data,actor) });
  });
}
