import {ownerReadRoute} from '@/lib/owner-route';
import {renderOwnerPdf,renderOwnerXlsx} from '@/lib/owner-export';
export const runtime='nodejs';
export function GET(request:Request){return ownerReadRoute(request,true,async(data,name,format)=>{
 const bytes=format==='pdf'?await renderOwnerPdf(data,name):await renderOwnerXlsx(data,name);
 return new Response(new Uint8Array(bytes),{headers:{'Content-Type':format==='pdf'?'application/pdf':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':`attachment; filename="parques-${data.period.current.start.slice(0,7)}.${format}"`}});
});}
