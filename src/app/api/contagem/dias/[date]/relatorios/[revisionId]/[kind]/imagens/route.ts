import {getCountingDayClosure} from '@/lib/counting-day-closure';
import {countingDayReportText} from '@/lib/counting-day-report-contract';
import {getCountingSignature} from '@/lib/trip-counting';
import {renderCountingImages,type CountingExportBlock} from '@/lib/counting-export';
import {TripCountingError} from '@/lib/trip-counting-contract';
import {runCountingRoute} from '@/lib/trip-counting-route';
export const runtime='nodejs';
export function GET(request:Request,{params}:{params:Promise<{date:string;revisionId:string;kind:string}>}){return runCountingRoute(request,async actor=>{
 const {date,revisionId,kind}=await params;if(!['general','kitchen'].includes(kind))throw new TripCountingError('report_kind','Relatório inválido.',400);
 const result=await getCountingDayClosure(date),revision=result.history.find(r=>r.id===revisionId);if(!revision)throw new TripCountingError('report_missing','Relatório emitido não encontrado.',404);
 const report=revision.snapshot,blocks:CountingExportBlock[]=[{text:countingDayReportText(report,kind as 'general'|'kitchen',revision.version)}];
 if(kind==='general')for(const group of report.groups)for(const slip of group.slips){const signature=await getCountingSignature(slip.revisionId,actor);blocks.push({text:`${group.name} · ${slip.type==='bus'?'Ônibus':'Van'} ${slip.ordinal} · ${slip.draft.responsible.name}`,image:signature.bytes});}
 const images=await renderCountingImages(kind==='general'?'Contagem geral':'Cozinha',`${date} · Revisão ${revision.version}`,blocks);return Response.json({ok:true,data:images.map((image,i)=>({name:`contagem-${date}-${kind}-r${revision.version}-${i+1}.png`,url:`data:image/png;base64,${image.toString('base64')}`}))});
 });}
