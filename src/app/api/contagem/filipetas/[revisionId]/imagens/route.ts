import {getCountingSlip} from '@/lib/counting-slip';
import {getCountingSignature} from '@/lib/trip-counting';
import {countingSlipText} from '@/lib/counting-slip-contract';
import {renderCountingImages} from '@/lib/counting-export';
import {runCountingRoute} from '@/lib/trip-counting-route';
export const runtime='nodejs';
export function GET(request:Request,{params}:{params:Promise<{revisionId:string}>}){return runCountingRoute(request,async actor=>{const id=(await params).revisionId,slip=await getCountingSlip(id,actor),signature=await getCountingSignature(id,actor);const images=await renderCountingImages('Filipeta de contagem',`${slip.clientName} · ${slip.date}`,[{text:countingSlipText(slip)},{text:'Assinatura do responsável',image:signature.bytes}]);return Response.json({ok:true,data:images.map((image,index)=>({name:`filipeta-${id}-${index+1}.png`,url:`data:image/png;base64,${image.toString('base64')}`}))});});}
