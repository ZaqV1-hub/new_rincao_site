import {getPublicRequestOrigin} from '@/lib/request-origin';
import {getCountingWhatsappStatus,sendCountingWhatsapp} from '@/lib/counting-whatsapp';
import {readCountingBody,runCountingRoute} from '@/lib/trip-counting-route';
import {invalidCount} from '@/lib/trip-counting-contract';
export const runtime='nodejs';
type Context={params:Promise<{revisionId:string}>};
export function GET(request:Request,{params}:Context){return runCountingRoute(request,async actor=>Response.json({ok:true,data:await getCountingWhatsappStatus((await params).revisionId,actor)}));}
export function POST(request:Request,{params}:Context){
 if(request.headers.get('origin')!==getPublicRequestOrigin(request))return new Response(null,{status:403});
 return runCountingRoute(request,async actor=>{
  const body=await readCountingBody(request);
  if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).length)return invalidCount();
  return Response.json({ok:true,data:await sendCountingWhatsapp((await params).revisionId,actor)});
 });
}
