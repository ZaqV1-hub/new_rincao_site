import {getCountingSlip} from '@/lib/counting-slip';
import {runCountingRoute} from '@/lib/trip-counting-route';
export const runtime='nodejs';
export function GET(request:Request,{params}:{params:Promise<{revisionId:string}>}){return runCountingRoute(request,async actor=>Response.json({ok:true,data:await getCountingSlip((await params).revisionId,actor)}));}
