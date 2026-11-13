import {createHash} from 'node:crypto';
import type {PoolClient} from 'pg';
import {readCountingDay} from './trip-counting';
import {readCountingAttendance} from './counting-attendance';
import {getOperationalParkId} from './operational-day-contract';
import {normalizeCountDraft,type CountDraft} from './trip-counting-contract';
import type {CountingDayReport} from './counting-day-report-contract';
import type {CountingSlip} from './counting-slip-contract';
export async function readCountingDayReport(client:PoolClient,date:string):Promise<CountingDayReport>{
 const day=await readCountingDay(client,date),dayUse=await readCountingAttendance(client,date);
 const revisions=(await client.query<{id:string;vehicleId:string;catalogVersion:number;counts:CountDraft['counts'];pcdDetails:CountDraft['pcdDetails'];notes:string;name:string;phone:string;confirmed:boolean;ownerName:string;startedAt:string;completedAt:string;context:Partial<CountingSlip>|null}>(`SELECT n.id,n.vehicle_id::text AS "vehicleId",n.catalog_version AS "catalogVersion",n.counts,n.pcd_details AS "pcdDetails",n.notes,n.responsible_name AS name,n.responsible_phone AS phone,n.contact_confirmed AS confirmed,n.owner_name AS "ownerName",n.created_at::text AS "startedAt",n.completed_at::text AS "completedAt",n.document_context AS context
 FROM passeio_contagens n JOIN passeio_veiculos v ON v.current_count_id=n.id AND v.parque=n.parque JOIN agenda a ON a.idagenda=v.agenda_id WHERE n.parque=$1 AND a.dtagenda=$2::date AND n.status='completed' AND v.estado='completed'`,[getOperationalParkId(),date])).rows;
 const groups=day.groups.map(group=>({agendaId:group.agendaId,clientId:group.clientId,name:group.clientName,plannedPeople:group.plannedPeople,foodNotes:group.foodNotes,transportName:group.transportName,
  pending:group.vehicles.filter(v=>v.state!=='completed').map(v=>({vehicleId:v.id,label:`${v.type==='bus'?'Ônibus':'Van'} ${v.ordinal}`,state:v.state})),
  slips:group.vehicles.filter(v=>v.state==='completed').map(v=>{const n=revisions.find(n=>Number(n.vehicleId)===v.id);if(!n)throw new Error('count_revision_missing');return {revisionId:n.id,vehicleId:v.id,clientName:n.context?.clientName??group.clientName,date:n.context?.date??date,type:n.context?.type??v.type,ordinal:n.context?.ordinal??v.ordinal,transportName:n.context?n.context.transportName??null:v.transportName,groupType:n.context?n.context.groupType??null:group.groupType,ownerName:n.ownerName,startedAt:n.startedAt,completedAt:n.completedAt,draft:normalizeCountDraft({counts:n.counts,pcdDetails:n.pcdDetails,notes:n.notes,responsible:{name:n.name,phone:n.phone,confirmed:n.confirmed}},true,{catalogVersion:n.catalogVersion,reading:true}),signatureUrl:`/api/contagem/assinaturas/${n.id}`,legacyContext:!n.context} satisfies CountingSlip;})}));
 const facts={date,dayUse,groups};return {...facts,generatedAt:new Date().toISOString(),fingerprint:createHash('sha256').update(JSON.stringify(facts)).digest('hex')};
}
