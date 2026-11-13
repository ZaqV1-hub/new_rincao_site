import { getIngressoSistemaDbPool } from './ingresso-db';
import { getOperationalParkId } from './operational-day-contract';
import { normalizeCountDraft,TripCountingError,type CountingActor,type CountDraft } from './trip-counting-contract';
import { registerOpsAuditLog } from './ops-audit-log';
import type { CountingSlip } from './counting-slip-contract';
export async function getCountingSlip(revisionId:string,actor:CountingActor):Promise<CountingSlip>{
  if(!actor.cpf||!/^\d{11}$/.test(actor.cpf)||! /^[a-f0-9-]{36}$/.test(revisionId))throw new TripCountingError('count_slip_invalid','Filipeta não encontrada.',404);
  const client=await getIngressoSistemaDbPool().connect();
  try{
    const row=(await client.query<{vehicleId:string;clientName:string;date:string;type:'bus'|'van';ordinal:number;ownerName:string;startedAt:string;completedAt:string;catalogVersion:number;counts:CountDraft['counts'];pcdDetails:CountDraft['pcdDetails'];notes:string;name:string;phone:string;confirmed:boolean;context:Partial<CountingSlip>|null}>(`SELECT n.vehicle_id::text AS "vehicleId",c.nome AS "clientName",a.dtagenda::text AS date,v.tipo AS type,v.ordinal,n.owner_name AS "ownerName",n.created_at::text AS "startedAt",n.completed_at::text AS "completedAt",n.catalog_version AS "catalogVersion",n.counts,n.pcd_details AS "pcdDetails",n.notes,n.responsible_name AS name,n.responsible_phone AS phone,n.contact_confirmed AS confirmed,n.document_context AS context
      FROM passeio_contagens n JOIN passeio_veiculos v ON v.parque=n.parque AND v.id=n.vehicle_id JOIN agenda a ON a.idagenda=v.agenda_id JOIN clientes c ON c.idcliente=v.cliente_id WHERE n.id=$1 AND n.parque=$2 AND n.status='completed'`,[revisionId,getOperationalParkId()])).rows[0];
    if(!row)throw new TripCountingError('count_slip_missing','Filipeta concluída não encontrada.',404);
    const draft=normalizeCountDraft({counts:row.counts,pcdDetails:row.pcdDetails,notes:row.notes,responsible:{name:row.name,phone:row.phone,confirmed:row.confirmed}},true,{catalogVersion:row.catalogVersion,reading:true});
    const context=row.context;
    await registerOpsAuditLog(client,{origem:'painel-contagem',acao:'slip_view',descricao:'Filipeta consultada.',motivo:'Consulta autorizada',usuarioNome:actor.name,detalhes:{revisionId,actorCpf:actor.cpf}},'postgres');
    return {revisionId,vehicleId:Number(row.vehicleId),clientName:context?.clientName??row.clientName,date:context?.date??row.date,type:context?.type??row.type,ordinal:context?.ordinal??row.ordinal,transportName:context?.transportName??null,groupType:context?.groupType??null,ownerName:row.ownerName,startedAt:row.startedAt,completedAt:row.completedAt,draft,signatureUrl:`/api/contagem/assinaturas/${revisionId}`,legacyContext:!context};
  }finally{client.release();}
}
