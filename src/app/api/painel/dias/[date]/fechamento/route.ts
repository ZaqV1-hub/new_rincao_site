import { getOperationalDayClosure,changeOperationalDayClosure } from '@/lib/operational-day-closure';
import { runTripFinancialRoute,readTripFinancialBody } from '@/lib/trip-settlement-route';
import { invalidTrip } from '@/lib/trip-settlement-contract';
export const runtime='nodejs';
type Context={params:Promise<{date:string}>};
export function GET(request:Request,context:Context){return runTripFinancialRoute(request,async()=>{if(new URL(request.url).search)return invalidTrip();return Response.json({ok:true,data:await getOperationalDayClosure((await context.params).date)});});}
export function POST(request:Request,context:Context){return runTripFinancialRoute(request,async actor=>Response.json({ok:true,data:await changeOperationalDayClosure((await context.params).date,await readTripFinancialBody(request),actor)}));}
