import { getOperationalDayClosure,getOperationalDayRevision } from '@/lib/operational-day-closure';
import { renderOperationalDayPdf,renderOperationalDayXlsx } from '@/lib/operational-day-export';
import { runTripFinancialRoute } from '@/lib/trip-settlement-route';
import { invalidTrip } from '@/lib/trip-settlement-contract';
export const runtime='nodejs';
export function GET(request:Request,context:{params:Promise<{date:string}>}){return runTripFinancialRoute(request,async actor=>{
  const query=new URL(request.url).searchParams,format=query.get('format'),revisionId=query.get('revision'),period=query.get('period'),date=(await context.params).date;
  if([...query.keys()].some(k=>!['format','revision','period'].includes(k))||[...new Set(query.keys())].some(k=>query.getAll(k).length>1)||!['pdf','xlsx'].includes(format??'')||(period!==null&&!/^[1-9]\d{0,9}$/.test(period)))return invalidTrip();
  const day=revisionId?null:await getOperationalDayClosure(date),revision=revisionId?await getOperationalDayRevision(date,revisionId):day!.current,snapshot=revision?.snapshot??day!.live,periodId=period?Number(period):undefined;
  if(periodId&&!snapshot.sessions.some(s=>s.id===periodId))return invalidTrip('Caixa não pertence a esta revisão.');
  const bytes=format==='pdf'?await renderOperationalDayPdf(snapshot,revision,periodId,actor.name??'Operador identificado'):await renderOperationalDayXlsx(snapshot,revision,periodId,actor.name??'Operador identificado');
  return new Response(new Uint8Array(bytes),{headers:{'Content-Type':format==='pdf'?'application/pdf':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':`attachment; filename="fechamento-${date}-${revision?.revision??'provisorio'}${periodId?`-caixa-${periodId}`:''}.${format}"`}});
});}
