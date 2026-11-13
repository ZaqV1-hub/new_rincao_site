import { createHash, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { getIngressoSistemaDbPool } from '@/lib/ingresso-db';
import { getOperationalParkId } from '@/lib/operational-day-contract';
import { lockOperationalDay } from '@/lib/operational-day-lock';
import { isCivilDate } from '@/lib/operational-date';
import { registerOpsAuditLog } from '@/lib/ops-audit-log';
import { COUNT_CATALOG_VERSION,countCategories,countId,countRecord,countText,invalidCount,normalizeCountDraft,TripCountingError,
  type CountAction,type CountDraft,type CountingActor,type CountingResult } from './trip-counting-contract';
import { normalizeCountingSignature,type CountingSignature } from './trip-counting-signature';

type GroupType = 'school' | 'group' | null;
type Vehicle = { id: number; agendaId: number; clientId: number; date: string; clientName: string; type: 'bus' | 'van'; plannedPeople: number | null;
  state: CountingResult['state']; version: number; addedOnDay: boolean; isExtra: boolean; ordinal: number; transportName: string | null; groupType: GroupType;
  financiallyFinalized: boolean; currentRevision: string | null; lastCompletedRevision: string | null };
type Revision = { id: string; status: 'draft' | 'completed'; ownerCpf: string | null; ownerName: string | null; counts: CountDraft['counts'];
  pcdDetails: CountDraft['pcdDetails']; notes: string; responsibleName: string; responsiblePhone: string; contactConfirmed: boolean; completedAt: string | null;
  catalogVersion: number; startedAt: Date; draftSaved: boolean };
export type CountingVehicleDetail = Vehicle & {
  closed: boolean; today: string; startedAt: string | null; draftSubtotal: number | null;
  revision: { id: string; status: string; ownerName: string | null; ownedByMe: boolean; draft: CountDraft;
    total: number | null; completedAt: string | null; startedAt: string; catalogVersion: number; canReadSignature: boolean } | null;
  history: { id: string; ownerName: string | null; completedAt: string; canReadSignature: boolean }[];
};
type CountingDayGroup = { agendaId: number; clientId: number; clientName: string; groupType: GroupType; foodNotes: string | null;
  plannedPeople: number | null; transportName: string | null };
type CountingFeedEvent = { id: number; action: 'start' | 'takeover' | 'complete' | 'add' | 'recount'; vehicleId: number; actorName: string | null; at: string };
export type CountingDay = { date: string; park: string; today: string; closed: boolean; generatedAt: string; carriers: { id: number; name: string }[];
  feed: CountingFeedEvent[]; groups: (CountingDayGroup & { vehicleCounts: { planned: number; extra: number; waiting: number; counting: number; completed: number };
    vehicles: (Vehicle & { total: number | null; draftSubtotal: number | null; ownerName: string | null; startedAt: string | null })[] })[] };
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function denied(code: string,message: string,status = 409): never { throw new TripCountingError(code,message,status); }
function actorId(actor: CountingActor) { if (!actor.cpf || !/^\d{11}$/.test(actor.cpf)) return denied('count_actor_required','Operador não identificado.',403); return actor.cpf; }
function keyInput(value: unknown) { if (typeof value !== 'string' || !/^[A-Za-z0-9:_-]{1,100}$/.test(value)) return invalidCount(); return value; }
function vehicleId(value: string | number) { return countId(Number(value)); }
async function transaction<T>(run: (client: PoolClient) => Promise<T>,readOnly = false) {
  const client = await getIngressoSistemaDbPool().connect();
  try {
    for (let attempt = 0;; attempt++) {
      try {
        // Financial closure also uses SERIALIZABLE; every count writer must participate in its snapshot conflict detection.
        await client.query(readOnly ? 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY' : 'BEGIN ISOLATION LEVEL SERIALIZABLE');
        const result = await run(client); await client.query('COMMIT'); return result;
      } catch (error) {
        await client.query('ROLLBACK');
        if (!readOnly && attempt < 2 && (error as {code?:string}).code === '40001') continue;
        throw error;
      }
    }
  } finally { client.release(); }
}
async function command<T extends Omit<CountingResult,'commandId' | 'confirmedAt'>>(action: string,input: unknown,key: string,actor: CountingActor,run: (client: PoolClient) => Promise<T>): Promise<CountingResult> {
  const park = getOperationalParkId(),cpf = actorId(actor),hash = digest({ action,input });
  return transaction(async client => {
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`count-command:${park}:${key}`]);
    const previous = (await client.query<{ actor_cpf: string; request_hash: string; result: CountingResult }>('SELECT actor_cpf,request_hash,result FROM contagem_comandos WHERE parque=$1 AND idempotency_key=$2',[park,key])).rows[0];
    if (previous) {
      if (previous.actor_cpf !== cpf) return denied('count_command_forbidden','Esta tentativa pertence a outro operador.',403);
      if (previous.request_hash !== hash) return denied('count_idempotency_conflict','Esta chave já pertence a outro conteúdo. Consulte a tentativa original.');
      return previous.result;
    }
    const changed = await run(client),commandId = randomUUID();
    const time = (await client.query<{ time: Date }>('SELECT clock_timestamp() AS time')).rows[0].time.toISOString();
    const result = { ...changed,commandId,confirmedAt: time };
    await client.query('INSERT INTO contagem_comandos(id,parque,idempotency_key,action,request_hash,actor_cpf,result) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb)',[commandId,park,key,action,hash,cpf,JSON.stringify(result)]);
    return result;
  });
}
export async function getCountingCommand(key: unknown,actor: CountingActor): Promise<CountingResult | null> {
  const id = keyInput(key),cpf = actorId(actor),park = getOperationalParkId();
  return transaction(async client => {
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`count-command:${park}:${id}`]);
    const row = (await client.query<{ actor_cpf: string; result: CountingResult }>('SELECT actor_cpf,result FROM contagem_comandos WHERE parque=$1 AND idempotency_key=$2',[park,id])).rows[0];
    if (row && row.actor_cpf !== cpf) return denied('count_command_forbidden','Esta tentativa pertence a outro operador.',403);
    return row?.result ?? null;
  });
}
async function dayState(client: PoolClient,date: string) {
  const row = (await client.query<{ today: string; closed: boolean }>(`SELECT (clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date::text AS today,
    EXISTS(SELECT 1 FROM operacao_dias WHERE parque=$1 AND data=$2::date AND estado='closed') OR EXISTS(SELECT 1 FROM contagem_dias WHERE parque=$1 AND data=$2::date AND estado='closed') AS closed`,[getOperationalParkId(),date])).rows[0];
  return row;
}
async function assertEditable(client: PoolClient,date: string,actor: CountingActor,reason: string) {
  const day = await dayState(client,date);
  if (day.closed) return denied('count_day_closed','O dia foi finalizado. A contagem está somente para consulta.');
  if (date > day.today) return denied('count_day_readonly','A programação futura está disponível apenas para consulta.');
  if (date < day.today && (!actor.manager || !reason)) return denied('count_day_readonly','Alterar uma data passada exige gerente e motivo.');
}
async function lockTrip(client: PoolClient,agendaId: number,clientId: number,actor: CountingActor,reason: string) {
  const park = getOperationalParkId();
  const initial = (await client.query<{ date: string }>('SELECT a.dtagenda::text AS date FROM agenda a JOIN agenda_extras ae ON ae.idagenda=a.idagenda WHERE ae.idagenda=$1 AND ae.idcliente=$2',[agendaId,clientId])).rows[0];
  if (!initial || !isCivilDate(initial.date)) return denied('count_trip_missing','Passeio não encontrado.',404);
  await lockOperationalDay(client,park,initial.date);
  const fresh = (await client.query<{ date: string; status: string; clientStatus: string | null }>(`SELECT a.dtagenda::text AS date,a.stagenda AS status,to_jsonb(ae)->>'stagenda_cli' AS "clientStatus"
    FROM agenda a JOIN agenda_extras ae ON ae.idagenda=a.idagenda WHERE ae.idagenda=$1 AND ae.idcliente=$2 FOR SHARE OF a,ae`,[agendaId,clientId])).rows[0];
  if (!fresh || fresh.date !== initial.date) return denied('count_context_changed','A data do passeio mudou. Consulte o estado atual.');
  if ([fresh.status,fresh.clientStatus].some(value => value && ['can','canc','ina','inat'].includes(value.trim()))) return denied('count_trip_cancelled','Este passeio está cancelado ou inativo.');
  await assertEditable(client,initial.date,actor,reason);
  await client.query('INSERT INTO passeio_operacao(parque,agenda_id,cliente_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[park,agendaId,clientId]);
  const trip = (await client.query<{ receipt: string | null }>(`SELECT to_jsonb(o)->>'finalized_receipt_id' AS receipt FROM passeio_operacao o WHERE parque=$1 AND agenda_id=$2 AND cliente_id=$3 FOR UPDATE`,[park,agendaId,clientId])).rows[0];
  if (trip.receipt) return denied('count_trip_finalized','O passeio possui recibo finalizado. Corrija pelo fluxo de revisão financeira.');
  return initial.date;
}
const groupType = `CASE WHEN btrim(to_jsonb(a)->>'tpagenda')='escol' THEN 'school'
  WHEN btrim(to_jsonb(a)->>'tpagenda') IN ('igrej','casam','melho','confr','ongs','grmix') THEN 'group' END`;
const tripTransport = `CASE WHEN o.transport_mode='client' THEN 'Transporte do cliente' ELSE carrier.nome END`;
const vehicleColumns = `v.id::text,v.agenda_id AS "agendaId",v.cliente_id AS "clientId",a.dtagenda::text AS date,c.nome AS "clientName",v.tipo AS type,
  v.planned_people AS "plannedPeople",v.estado AS state,v.versao AS version,v.added_on_day AS "addedOnDay",v.is_extra AS "isExtra",v.ordinal,
  COALESCE(vehicle_carrier.nome,${tripTransport}) AS "transportName",${groupType} AS "groupType",
  (to_jsonb(o)->>'finalized_receipt_id' IS NOT NULL) AS "financiallyFinalized",v.current_count_id AS "currentRevision",v.last_completed_count_id AS "lastCompletedRevision"`;
const vehicleSource = `FROM passeio_veiculos v JOIN agenda a ON a.idagenda=v.agenda_id JOIN clientes c ON c.idcliente=v.cliente_id
  JOIN passeio_operacao o ON o.parque=v.parque AND o.agenda_id=v.agenda_id AND o.cliente_id=v.cliente_id
  LEFT JOIN transportadores carrier ON carrier.parque=o.parque AND carrier.id=o.carrier_id
  LEFT JOIN transportadores vehicle_carrier ON vehicle_carrier.parque=v.parque AND vehicle_carrier.id=v.carrier_id`;
async function readVehicle(client: PoolClient,id: number,lock = false): Promise<Vehicle> {
  const row = (await client.query<Omit<Vehicle,'id'> & { id: string }>(`SELECT ${vehicleColumns} ${vehicleSource} WHERE v.parque=$1 AND v.id=$2${lock ? ' FOR UPDATE OF v' : ''}`,[getOperationalParkId(),id])).rows[0];
  if (!row) return denied('count_vehicle_missing','Veículo não encontrado neste parque.',404);
  return { ...row,id: vehicleId(row.id) };
}
async function readRevision(client: PoolClient,id: string | null): Promise<Revision | null> {
  if (!id) return null;
  return (await client.query<Revision>(`SELECT id,status,owner_cpf AS "ownerCpf",owner_name AS "ownerName",counts,pcd_details AS "pcdDetails",notes,
    responsible_name AS "responsibleName",responsible_phone AS "responsiblePhone",contact_confirmed AS "contactConfirmed",completed_at::text AS "completedAt",
    created_at AS "startedAt",catalog_version AS "catalogVersion",(draft_saved_at IS NOT NULL OR catalog_version=1) AS "draftSaved"
    FROM passeio_contagens WHERE parque=$1 AND id=$2`,[getOperationalParkId(),id])).rows[0] ?? null;
}
function revisionDraft(revision: Revision): CountDraft {
  return normalizeCountDraft({ counts: revision.counts,pcdDetails: revision.pcdDetails,notes: revision.notes,
    responsible: { name: revision.responsibleName,phone: revision.responsiblePhone,confirmed: revision.contactConfirmed } },revision.status === 'completed',
  { catalogVersion: revision.catalogVersion,reading: true });
}
async function audit(client: PoolClient,vehicle: Pick<Vehicle,'id' | 'version' | 'agendaId' | 'clientId'>,action: string,actor: CountingActor,reason: string,revisionId: string | null,signature?: CountingSignature) {
  await registerOpsAuditLog(client,{ origem: 'painel-contagem',acao: action,descricao: `Contagem do veículo #${vehicle.id}.`,motivo: reason || 'Contagem operacional',usuarioNome: actor.name,
    detalhes: { vehicleId: vehicle.id,agendaId: vehicle.agendaId,clientId: vehicle.clientId,version: vehicle.version,revisionId,actorCpf: actor.cpf,...(signature ? { signatureHash: signature.hash } : {}) } },'postgres');
}
async function newRevision(client: PoolClient,vehicle: Vehicle,actor: CountingActor) {
  const id = randomUUID(),counts = Object.fromEntries(countCategories.map(key => [key,0]));
  await client.query(`INSERT INTO passeio_contagens(id,parque,vehicle_id,catalog_version,status,owner_cpf,owner_name,counts,previous_revision,created_by)
    VALUES($1,$2,$3,$8,'draft',$4,$5,$6::jsonb,$7,$4)`,[id,getOperationalParkId(),vehicle.id,actor.cpf,actor.name?.slice(0,160),JSON.stringify(counts),vehicle.lastCompletedRevision,COUNT_CATALOG_VERSION]);
  return id;
}
export async function changeTripCount(id: number,action: CountAction,value: unknown,actor: CountingActor): Promise<CountingResult> {
  countId(id); actorId(actor);
  if (!['start','save','release','takeover','complete','recount'].includes(action)) return invalidCount();
  const data = countRecord(value,['version','idempotencyKey','reason',...(['save','complete'].includes(action) ? ['draft'] : []),...(action === 'complete' ? ['signature'] : [])]);
  const version = countId(data.version),key = keyInput(data.idempotencyKey),reason = countText(data.reason ?? '',1000);
  if (version >= 2147483647) return invalidCount();
  if (['takeover','recount'].includes(action) && !reason) return denied('count_reason_required','Informe o motivo da alteração.');
  // Preserve the input hash for commands confirmed before catalog 2.
  const draft = ['save','complete'].includes(action) ? normalizeCountDraft(data.draft,action === 'complete',{ catalogVersion: 1,reading: true }) : null;
  const signature = action === 'complete' ? await normalizeCountingSignature(data.signature) : null;
  return command(action,{ id,version,reason,draft,signatureHash: signature?.hash ?? null },key,actor,async client => {
    const discovered = await readVehicle(client,id),date = await lockTrip(client,discovered.agendaId,discovered.clientId,actor,reason);
    const vehicle = await readVehicle(client,id,true);
    if (vehicle.date !== date || vehicle.agendaId !== discovered.agendaId || vehicle.clientId !== discovered.clientId) return denied('count_context_changed','O vínculo do veículo mudou. Consulte o estado atual.');
    if (vehicle.version !== version) return denied('count_version_conflict','O veículo mudou. Seu rascunho foi preservado; confira a versão atual antes de continuar.');
    const revision = await readRevision(client,vehicle.currentRevision);
    let revisionId = revision?.id ?? null,state = vehicle.state;
    if (action === 'start' || action === 'recount') {
      if (action === 'recount') { if (state !== 'completed' || revision?.status !== 'completed') return denied('count_not_completed','Só é possível recontar um veículo concluído.'); }
      else if (state === 'counting' && revision?.status === 'draft' && revision.ownerCpf === null) {
        await client.query('UPDATE passeio_contagens SET owner_cpf=$2,owner_name=$3,updated_at=clock_timestamp() WHERE id=$1',[revision.id,actor.cpf,actor.name?.slice(0,160)]);
      } else if (state !== 'waiting' || revision) return denied('count_already_started','Este veículo já possui uma contagem.');
      if (action === 'recount' || state === 'waiting') revisionId = await newRevision(client,vehicle,actor);
      state = 'counting';
    } else {
      if (state !== 'counting' || !revision || revision.status !== 'draft') return denied('count_not_started','Inicie a contagem antes de editar.');
      if (action !== 'takeover' && revision.ownerCpf !== actor.cpf) return denied('count_owned_by_other','A contagem está sob responsabilidade de outro operador.');
      if (action === 'takeover' || action === 'release') await client.query('UPDATE passeio_contagens SET owner_cpf=$2,owner_name=$3,updated_at=clock_timestamp() WHERE id=$1',
        [revision.id,action === 'release' ? null : actor.cpf,action === 'release' ? null : actor.name?.slice(0,160)]);
      if (draft) {
        const normalized = normalizeCountDraft(draft,action === 'complete');
        const { clientName,type,ordinal,transportName,groupType } = vehicle;
        const document = signature ? { clientName,date,type,ordinal,transportName,groupType } : null;
        if (signature) await client.query('INSERT INTO contagem_assinaturas(revision_id,png,sha256,width,height) VALUES($1,$2,$3,$4,$5)',[revision.id,signature.bytes,signature.hash,signature.width,signature.height]);
        await client.query(`UPDATE passeio_contagens SET counts=$2::jsonb,pcd_details=$3::jsonb,notes=$4,responsible_name=$5,responsible_phone=$6,contact_confirmed=$7,
          status=$8,completed_at=CASE WHEN $8='completed' THEN clock_timestamp() ELSE NULL END,updated_at=clock_timestamp(),draft_saved_at=clock_timestamp(),
          catalog_version=$9,document_context=$10::jsonb WHERE id=$1`,
        [revision.id,JSON.stringify(normalized.counts),JSON.stringify(normalized.pcdDetails),normalized.notes,normalized.responsible.name,normalized.responsible.phone,normalized.responsible.confirmed,
          signature ? 'completed' : 'draft',COUNT_CATALOG_VERSION,document ? JSON.stringify(document) : null]);
        if (signature) state = 'completed';
      }
    }
    await client.query(`UPDATE passeio_veiculos SET current_count_id=$2,estado=$3,versao=versao+1,
      last_completed_count_id=CASE WHEN $3='completed' THEN $2 ELSE last_completed_count_id END WHERE id=$1 AND parque=$4`,[id,revisionId,state,getOperationalParkId()]);
    await audit(client,{ ...vehicle,version: version+1 },action,actor,reason,revisionId,signature ?? undefined);
    await assertEditable(client,date,actor,reason);
    return { vehicleId: id,version: version+1,revisionId,state };
  });
}
export async function addCountingVehicle(value: unknown,actor: CountingActor): Promise<CountingResult> {
  const input = countRecord(value,['agendaId','clientId','type','plannedPeople','carrierId','reason','idempotencyKey']);
  const agendaId = countId(input.agendaId),clientId = countId(input.clientId),reason = countText(input.reason ?? '',1000),key = keyInput(input.idempotencyKey);
  const carrierId = input.carrierId == null ? null : countId(input.carrierId);
  if (!['bus','van'].includes(String(input.type)) || (input.plannedPeople !== null && (typeof input.plannedPeople !== 'number' || !Number.isInteger(input.plannedPeople) || input.plannedPeople < 0 || input.plannedPeople > 100000))) return invalidCount();
  return command('add',{ agendaId,clientId,type: input.type,plannedPeople: input.plannedPeople,reason,...(carrierId === null ? {} : { carrierId }) },key,actor,async client => {
    const park = getOperationalParkId(),date = await lockTrip(client,agendaId,clientId,actor,reason);
    if (carrierId !== null && !(await client.query('SELECT 1 FROM transportadores WHERE parque=$1 AND id=$2 FOR SHARE',[park,carrierId])).rowCount) return invalidCount('Transportador indisponível neste parque.');
    const count = (await client.query<{ count: number }>('SELECT count(*)::int AS count FROM passeio_veiculos WHERE parque=$1 AND agenda_id=$2 AND cliente_id=$3 AND tipo=$4',[park,agendaId,clientId,input.type])).rows[0].count;
    if (count >= 100) return denied('count_vehicle_limit','O passeio atingiu o limite de 100 veículos deste tipo.');
    const row = (await client.query<{ id: string }>(`INSERT INTO passeio_veiculos(parque,agenda_id,cliente_id,tipo,planned_people,added_on_day,created_by,carrier_id,is_extra)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,true) RETURNING id::text`,[park,agendaId,clientId,input.type,input.plannedPeople,date === (await dayState(client,date)).today,actor.cpf,carrierId])).rows[0];
    const id = vehicleId(row.id); await audit(client,{ id,version: 1,agendaId,clientId },'add',actor,reason,null); await assertEditable(client,date,actor,reason);
    return { vehicleId: id,version: 1,revisionId: null,state: 'waiting' };
  });
}
export async function getCountingVehicle(id: number,actor: CountingActor): Promise<CountingVehicleDetail> {
  countId(id); actorId(actor);
  return transaction(async client => {
    const vehicle = await readVehicle(client,id),revision = await readRevision(client,vehicle.currentRevision),day = await dayState(client,vehicle.date);
    const history = (await client.query<{ id: string; ownerCpf: string; ownerName: string | null; completedAt: string }>(`SELECT id,owner_cpf AS "ownerCpf",owner_name AS "ownerName",completed_at::text AS "completedAt"
      FROM passeio_contagens WHERE parque=$1 AND vehicle_id=$2 AND status='completed' ORDER BY completed_at DESC`,[getOperationalParkId(),id])).rows;
    const draft = revision ? revisionDraft(revision) : null;
    const subtotal = draft && Object.values(draft.counts).some(value => value !== null)
      ? countCategories.reduce((sum,key) => sum+(draft.counts[key] ?? 0),0) : null;
    const startedAt = revision?.startedAt.toISOString() ?? null;
    return { ...vehicle,...day,startedAt,draftSubtotal: revision?.status === 'draft' && revision.draftSaved ? subtotal : null,
      revision: revision && draft ? { id: revision.id,status: revision.status,ownerName: revision.ownerName,ownedByMe: revision.ownerCpf === actor.cpf,
      draft,total: revision.status === 'completed' && vehicle.state === 'completed' ? subtotal : null,startedAt: revision.startedAt.toISOString(),catalogVersion: revision.catalogVersion,
      completedAt: revision.completedAt,canReadSignature: revision.status === 'completed' } : null,
      history: history.map(row => ({ id: row.id,ownerName: row.ownerName,completedAt: row.completedAt,canReadSignature: true })) };
  },true);
}
export async function getCountingSignature(id: string,actor: CountingActor): Promise<CountingSignature> {
  actorId(actor); if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) return invalidCount();
  return transaction(async client => {
    const row = (await client.query<CountingSignature & { ownerCpf: string; vehicleId: string }>(`SELECT s.png AS bytes,s.sha256 AS hash,s.width,s.height,c.owner_cpf AS "ownerCpf",c.vehicle_id::text AS "vehicleId"
      FROM contagem_assinaturas s JOIN passeio_contagens c ON c.id=s.revision_id WHERE c.parque=$1 AND c.status='completed' AND c.id=$2`,[getOperationalParkId(),id])).rows[0];
    if (!row) return denied('count_signature_forbidden','Sem permissão para consultar esta assinatura.',403);
    await registerOpsAuditLog(client,{ origem: 'painel-contagem',acao: 'signature_view',descricao: 'Assinatura da contagem consultada.',motivo: 'Consulta autorizada',usuarioNome: actor.name,
      detalhes: { revisionId: id,vehicleId: row.vehicleId,actorCpf: actor.cpf } },'postgres');
    return { bytes: row.bytes,hash: row.hash,width: row.width,height: row.height };
  });
}
export async function getCountingDay(date: string): Promise<CountingDay> {
  if (!isCivilDate(date)) return invalidCount();
  return transaction(client => readCountingDay(client,date),true);
}

export async function readCountingDay(client: PoolClient,date: string): Promise<CountingDay> {
  const park = getOperationalParkId(),day = await dayState(client,date);
  const groups = (await client.query<CountingDayGroup>(`SELECT ae.idagenda AS "agendaId",ae.idcliente AS "clientId",c.nome AS "clientName",
    o.planned_people AS "plannedPeople",o.food_notes AS "foodNotes",${groupType} AS "groupType",${tripTransport} AS "transportName"
    FROM agenda_extras ae JOIN agenda a ON a.idagenda=ae.idagenda JOIN clientes c ON c.idcliente=ae.idcliente
    LEFT JOIN passeio_operacao o ON o.parque=$1 AND o.agenda_id=ae.idagenda AND o.cliente_id=ae.idcliente
    LEFT JOIN transportadores carrier ON carrier.parque=o.parque AND carrier.id=o.carrier_id
    WHERE a.dtagenda=$2::date ORDER BY c.nome,ae.idagenda,ae.idcliente`,[park,date])).rows;
  const vehicles = (await client.query<Omit<Vehicle,'id'> & { id: string; total: number | null; draftSubtotal: number | null; ownerName: string | null; startedAt: Date | null }>(
    `SELECT ${vehicleColumns},n.owner_name AS "ownerName",n.created_at AS "startedAt",
      CASE WHEN v.estado='completed' AND n.status='completed' THEN subtotal.people END AS total,
      CASE WHEN v.estado='counting' AND n.status='draft' AND (n.draft_saved_at IS NOT NULL OR n.catalog_version=1) THEN subtotal.people END AS "draftSubtotal"
      ${vehicleSource}
      LEFT JOIN passeio_contagens n ON n.id=v.current_count_id AND n.parque=v.parque
      LEFT JOIN LATERAL (SELECT sum(value::int)::int AS people FROM jsonb_each_text(n.counts)) subtotal ON true
      WHERE v.parque=$1 AND a.dtagenda=$2::date ORDER BY v.id`,[park,date])).rows;
  const carriers = (await client.query<{ id: string; name: string }>('SELECT id::text,nome AS name FROM transportadores WHERE parque=$1 ORDER BY nome,id',[park])).rows;
  const hasAudit = (await client.query<{ available: boolean }>("SELECT to_regclass('edicoes_log') IS NOT NULL AS available")).rows[0].available;
  const feed = hasAudit ? (await client.query<Omit<CountingFeedEvent,'at' | 'vehicleId'> & { at: Date; vehicleId: string }>(
    `SELECT e.id,e.acao AS action,v.id::text AS "vehicleId",e.usuario_nome AS "actorName",e.created_at AS at
      FROM edicoes_log e JOIN passeio_veiculos v ON v.id::text=(CASE WHEN e.origem='painel-contagem' THEN NULLIF(e.detalhes_json,'')::jsonb->>'vehicleId' END)
      JOIN agenda a ON a.idagenda=v.agenda_id
      WHERE e.origem='painel-contagem' AND e.acao IN ('start','takeover','complete','add','recount') AND v.parque=$1 AND a.dtagenda=$2::date
      ORDER BY e.id DESC LIMIT 30`,[park,date])).rows : [];
  return { date,park,...day,generatedAt: new Date().toISOString(),carriers: carriers.map(carrier => ({ ...carrier,id: vehicleId(carrier.id) })),
    feed: feed.map(event => ({ ...event,vehicleId: vehicleId(event.vehicleId),at: event.at.toISOString() })),
    groups: groups.map(group => {
      const tripVehicles = vehicles.filter(v => v.agendaId === group.agendaId && v.clientId === group.clientId);
      const vehicleCounts = { planned: 0,extra: 0,waiting: 0,counting: 0,completed: 0 };
      for (const vehicle of tripVehicles) {
        vehicleCounts[vehicle.isExtra ? 'extra' : 'planned']++;
        vehicleCounts[vehicle.state]++;
      }
      return { ...group,vehicleCounts,vehicles: tripVehicles.map(v => ({ ...v,id: vehicleId(v.id),startedAt: v.startedAt?.toISOString() ?? null })) };
    }) };
}
