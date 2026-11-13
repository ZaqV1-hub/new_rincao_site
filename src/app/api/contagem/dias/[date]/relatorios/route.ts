import {getCountingDayClosure} from '@/lib/counting-day-closure';
import {runCountingRoute} from '@/lib/trip-counting-route';
export const runtime='nodejs';
export function GET(request:Request,{params}:{params:Promise<{date:string}>}){return runCountingRoute(request,async()=>Response.json({ok:true,data:await getCountingDayClosure((await params).date)}));}
