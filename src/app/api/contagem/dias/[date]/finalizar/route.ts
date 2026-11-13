import {changeCountingDayClosure} from '@/lib/counting-day-closure';
import {runCountingRoute,readCountingBody} from '@/lib/trip-counting-route';
export const runtime='nodejs';
export function POST(request:Request,{params}:{params:Promise<{date:string}>}){if(request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin)return new Response(null,{status:403});return runCountingRoute(request,async actor=>Response.json({ok:true,data:await changeCountingDayClosure((await params).date,await readCountingBody(request),actor)}));}
