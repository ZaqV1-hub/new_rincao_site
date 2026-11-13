import { getCountingDay } from '@/lib/trip-counting';
import { runCountingRoute } from '@/lib/trip-counting-route';
export const runtime = 'nodejs';
export function GET(request: Request,context: { params: Promise<{ date: string }> }) {
  return runCountingRoute(request,async () => Response.json({ ok: true,data: await getCountingDay((await context.params).date) }));
}
