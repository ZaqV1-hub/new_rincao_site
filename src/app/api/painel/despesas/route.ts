import { createOperationalExpense,listOperationalExpenses } from '@/lib/operational-expenses';
import { invalidTrip } from '@/lib/trip-settlement-contract';
import { readTripFinancialBody,runTripFinancialRoute } from '@/lib/trip-settlement-route';
export const runtime = 'nodejs';
export function GET(request: Request) {
  return runTripFinancialRoute(request,async () => { const query = new URL(request.url).searchParams;
    if ([...query.keys()].some(key => key !== 'date') || query.getAll('date').length !== 1) return invalidTrip();
    return Response.json({ ok: true,data: await listOperationalExpenses(query.get('date')!) });
  });
}
export function POST(request: Request) { return runTripFinancialRoute(request,async actor => Response.json({ ok: true,data: await createOperationalExpense(await readTripFinancialBody(request),actor) })); }
