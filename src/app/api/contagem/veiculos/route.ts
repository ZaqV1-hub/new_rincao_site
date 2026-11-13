import { addCountingVehicle } from '@/lib/trip-counting';
import { readCountingBody,runCountingRoute } from '@/lib/trip-counting-route';
export const runtime = 'nodejs';
export function POST(request: Request) { return runCountingRoute(request,async actor => Response.json({ ok: true,data: await addCountingVehicle(await readCountingBody(request),actor) })); }
