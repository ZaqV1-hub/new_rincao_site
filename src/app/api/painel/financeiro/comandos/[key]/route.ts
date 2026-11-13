import { getTripCommand } from '@/lib/trip-settlement';
import { invalidTrip } from '@/lib/trip-settlement-contract';
import { runTripFinancialRoute } from '@/lib/trip-settlement-route';
export const runtime = 'nodejs';
export function GET(request: Request,context: { params: Promise<{ key: string }> }) {
  return runTripFinancialRoute(request,async actor => { if (new URL(request.url).search) return invalidTrip(); return Response.json({ ok: true,data: await getTripCommand((await context.params).key,actor) }); });
}
