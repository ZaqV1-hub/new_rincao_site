import {recordCountingShare,getCountingShare} from '@/lib/counting-manual-share';
import {readCountingBody,runCountingRoute} from '@/lib/trip-counting-route';
export const runtime='nodejs';
type Context={params:Promise<{revisionId:string}>};
export function GET(request:Request,{params}:Context){return runCountingRoute(request,async actor=>Response.json({ok:true,data:await getCountingShare((await params).revisionId,actor)}));}
export function POST(request:Request,{params}:Context){if(request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin)return new Response(null,{status:403});return runCountingRoute(request,async actor=>Response.json({ok:true,data:await recordCountingShare((await params).revisionId,await readCountingBody(request),actor)}));}
