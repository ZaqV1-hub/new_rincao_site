import { changeTripCount } from '@/lib/trip-counting';
import type { CountAction } from '@/lib/trip-counting-contract';
import { countingRouteId,readCountingBody,runCountingRoute } from '@/lib/trip-counting-route';
export const runtime = 'nodejs';
export function POST(request: Request,context: { params: Promise<{ vehicleId: string; action: string }> }) {
  return runCountingRoute(request,async actor => {
    const { vehicleId,action } = await context.params;
    return Response.json({ ok: true,data: await changeTripCount(countingRouteId(vehicleId),action as CountAction,await readCountingBody(request),actor) });
  });
}
