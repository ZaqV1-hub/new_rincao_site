import { getOperationalTripDay } from '@/lib/operational-trip-day';
import { invalidTrip } from '@/lib/trip-settlement-contract';
import { publicTripDetail,runTripFinancialRoute } from '@/lib/trip-settlement-route';
export const runtime = 'nodejs';
export function GET(request: Request,context: { params: Promise<{ date: string }> }) {
  return runTripFinancialRoute(request,async actor => {
    if (new URL(request.url).search) return invalidTrip();
    const day = await getOperationalTripDay((await context.params).date);
    return Response.json({ ok: true,data: { ...day,trips: day.trips.map(trip => publicTripDetail(trip,actor)) } });
  });
}
