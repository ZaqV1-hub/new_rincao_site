import {requirePainelAccess} from '@/lib/painel-session';
import {getCountingSlip} from '@/lib/counting-slip';
import {getCountingShare} from '@/lib/counting-manual-share';
import {countingSlipText,countingTime} from '@/lib/counting-slip-contract';
import {CountingSlipCard} from '@/components/counting-slip';
import {CountingShare} from '@/components/counting-share';
export default async function Page({params}:{params:Promise<{revisionId:string}>}){
 const {revisionId}=await params,session=await requirePainelAccess('vis_contagem',`/contagem/filipetas/${revisionId}`),actor={name:session.actorName,cpf:session.actorCpf,manager:session.legacyRoleId===1};
 const slip=await getCountingSlip(revisionId,actor),last=await getCountingShare(revisionId,actor);
 return <div className="space-y-5"><a href={`/contagem?date=${slip.date}`} className="inline-flex min-h-11 items-center underline">← Voltar ao passeio</a><CountingSlipCard slip={slip}/>{last&&<p>{last.action==='declared'?'Envio manual declarado':'Compartilhamento iniciado'} por {last.actorName??'Operador'} em {countingTime(last.at)}. Entrega não confirmada pelo sistema.</p>}<CountingShare text={countingSlipText(slip)} imagesUrl={`/api/contagem/filipetas/${revisionId}/imagens`} phone={slip.draft.responsible.phone} recordUrl={`/api/contagem/filipetas/${revisionId}/envios`}/></div>;
}
