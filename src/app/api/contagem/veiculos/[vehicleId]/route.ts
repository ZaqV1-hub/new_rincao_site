import { getCountingVehicle } from '@/lib/trip-counting';
import { countingRouteId,runCountingRoute } from '@/lib/trip-counting-route';
export const runtime = 'nodejs';
export function GET(request: Request,context: { params: Promise<{ vehicleId: string }> }) {
  return runCountingRoute(request,async actor => Response.json({ ok: true,data: await getCountingVehicle(countingRouteId((await context.params).vehicleId),actor) }));
}
