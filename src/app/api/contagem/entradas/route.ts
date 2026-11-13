import { requirePainelApiAccess } from '@/lib/painel-api-auth';
import { TripCountingError } from '@/lib/trip-counting-contract';
import { readCountingBody } from '@/lib/trip-counting-route';
import { admitCountingVoucher } from '@/lib/counting-admission';
import { VoucherOperationError } from '@/lib/ops-voucher-validation-contract';
export const runtime='nodejs';
export async function POST(request:Request){
  const respond=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
  try{
    const origin=request.headers.get('origin');
    if(origin&&origin!==new URL(request.url).origin)return respond({ok:false,error:{message:'Origem não autorizada.'}},403);
    const access=await requirePainelApiAccess(request,'vis_portaria');if(!access.ok){access.response.headers.set('Cache-Control','private, no-store');return access.response;}
    return respond({ok:true,data:await admitCountingVoucher(await readCountingBody(request),{name:access.session.actorName,cpf:access.session.actorCpf})});
  }catch(error){if(error instanceof VoucherOperationError||error instanceof TripCountingError){const validation=error instanceof VoucherOperationError?error.details?.validation:undefined;return respond({ok:false,error:{code:error.code,message:error.code==='voucher_already_used'?'Ingresso já utilizado. Entrada não autorizada.':error.message,...(validation?{details:{validation:{actorName:validation.actorName,date:validation.date,time:validation.time}}}:{})}},error.status);}return respond({ok:false,error:{message:'Não foi possível confirmar a entrada. Confira a mesma tentativa.'}},503);}
}
