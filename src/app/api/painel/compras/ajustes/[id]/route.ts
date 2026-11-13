import { requirePainelApiAccess } from '@/lib/painel-api-auth';
import { previewPurchaseAdjustment,resolvePurchaseAdjustment } from '@/lib/operational-purchase-batch';
import { PurchaseBatchError } from '@/lib/operational-purchase-batch-contract';
import { runTripFinancialRoute,readTripFinancialBody } from '@/lib/trip-settlement-route';
import { invalidTrip } from '@/lib/trip-settlement-contract';
export const runtime='nodejs';
type Context={params:Promise<{id:string}>};
async function batchResponse(run:()=>Promise<unknown>){try{return Response.json({ok:true,data:await run()});}catch(e){if(e instanceof PurchaseBatchError)return Response.json({ok:false,error:{code:e.code,message:e.message}},{status:e.status});throw e;}}
export function GET(request:Request,context:Context){return runTripFinancialRoute(request,async actor=>{const access=await requirePainelApiAccess(request,'vis_compra');if(!access.ok)return access.response;if(new URL(request.url).search)return invalidTrip();if(!actor.manager)return Response.json({ok:false,error:{code:'adjustment_manager_required',message:'A resolução exige um gerente.'}},{status:403});return batchResponse(async()=>previewPurchaseAdjustment((await context.params).id));});}
export function POST(request:Request,context:Context){return runTripFinancialRoute(request,async actor=>{const access=await requirePainelApiAccess(request,'vis_compra');if(!access.ok)return access.response;return batchResponse(async()=>resolvePurchaseAdjustment((await context.params).id,await readTripFinancialBody(request),actor));});}
