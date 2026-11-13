import { getCountingCommand } from '@/lib/trip-counting';
import { runCountingRoute } from '@/lib/trip-counting-route';
export const runtime = 'nodejs';
export function GET(request: Request,context: { params: Promise<{ key: string }> }) {
  return runCountingRoute(request,async actor => Response.json({ ok: true,data: await getCountingCommand((await context.params).key,actor) }));
}
