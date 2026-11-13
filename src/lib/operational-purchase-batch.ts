import { tripFingerprint } from "./trip-settlement-source";
import { createHash, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { getIngressoSistemaDbPool } from "@/lib/ingresso-db";
import { getOperationalParkId } from "@/lib/operational-day-contract";
import { lockOperationalDay } from "@/lib/operational-day-lock";
import { getOperationalDay, type OperationalDay } from "@/lib/operational-day";
import { isCivilDate, voucherValidityRange } from "@/lib/operational-date";
import { getOnlineCapacityOccupied } from "@/lib/online-capacity";
import { registerOpsAuditLog } from "@/lib/ops-audit-log";
import type { CatalogActor } from "@/lib/painel-operational-catalog";
import { normalizePurchaseBatch, invalidPurchaseBatch, purchaseBatchRange, PurchaseBatchError,
  type PurchaseBatchInput, type PurchaseBatchItem, type PurchaseBatchPreview, type PurchaseBatchResult } from "./operational-purchase-batch-contract";

type Purchase = { id: number; status: string; purchasedOn: string; periodId: number | null; email: string | null; schoolContext: unknown };
type Voucher = { id: number; purchaseId: number; agendaId: number; schoolId: number | null; type: string; serviceId: string | null;
  park: string | null; from: string | null; until: string | null; visit: string | null; agendaType: string | null; groupAgenda: boolean;
  used: string; status: string | null; usedOn: string | null; closedAt: string | null; periodId: number | null; validationPeriodId: number | null; amount: string };
type Period = { id: number; park: string | null; date: string | null; closed: boolean };
type Capacity = { purchaseId: number; park: string; date: string; quantity: number; held: boolean };
type Snapshot = {
  today: string; purchases: Purchase[]; vouchers: Voucher[]; periods: Period[]; capacity: Capacity[];
  paymentPeriods: { purchaseId: number; periodId: number }[]; closedDates: string[]; holds: number[]; pending: number[];
  target: OperationalDay | null; targetHasGroups: boolean; occupied: number;
};
const hash = (data: unknown) => createHash("sha256").update(JSON.stringify(data)).digest("hex");
const uniqueNumbers = (ids: (number | null)[]) => [...new Set(ids.filter((id): id is number => id !== null))].sort((a,b) => a-b);
function periodsFor(s: Snapshot, id: number) {
  return uniqueNumbers([s.purchases.find(p => p.id === id)?.periodId ?? null,
    ...s.vouchers.filter(v => v.purchaseId === id).flatMap(v => [v.periodId,v.validationPeriodId]),
    ...s.paymentPeriods.filter(p => p.purchaseId === id).map(p => p.periodId)]);
}
function datesFor(s: Snapshot, input: PurchaseBatchInput) {
  return [...new Set([input.targetDate,...s.vouchers.flatMap(v => [v.from ?? v.visit,v.usedOn]),
    ...s.periods.map(p => p.date),...s.capacity.map(c => c.date)].filter((d): d is string => isCivilDate(d)))].sort();
}
async function readSnapshot(client: PoolClient, input: PurchaseBatchInput): Promise<Snapshot> {
  const ids = input.purchaseIds, park = getOperationalParkId();
  const purchases = (await client.query<Purchase>(`SELECT c.idcompra AS id,btrim(c.stcompra) AS status,c.dtcompra::text AS "purchasedOn",
    c.caixa_periodo_id AS "periodId",u.email,to_jsonb(c)->'checkout_school_site_context' AS "schoolContext"
    FROM compra c LEFT JOIN usuario u ON u.cpf=c.cpf WHERE c.idcompra=ANY($1::int[]) ORDER BY c.idcompra`, [ids])).rows;
  const vouchers = (await client.query<Voucher>(`SELECT v.idvoucher AS id,v.idcompra AS "purchaseId",v.idagenda AS "agendaId",v.idescola AS "schoolId",
    btrim(v.tpvoucher) AS type,v.servico_id::text AS "serviceId",v.parque_operacional AS park,v.dtinicio_validade::text AS "from",v.dtvalidade::text AS until,
    a.dtagenda::text AS visit,btrim(a.tpagenda) AS "agendaType",EXISTS(SELECT 1 FROM agenda_extras ae WHERE ae.idagenda=v.idagenda) AS "groupAgenda",
    btrim(v.stusado) AS used,btrim(v.stvoucher) AS status,v.dtuso::text AS "usedOn",v.closed_at::text AS "closedAt",v.periodo_id AS "periodId",
    v.validacao_periodo_id AS "validationPeriodId",v.vlunicompra::text AS amount
    FROM voucher v LEFT JOIN agenda a ON a.idagenda=v.idagenda WHERE v.idcompra=ANY($1::int[]) ORDER BY v.idcompra,v.idvoucher`, [ids])).rows;
  if (vouchers.length > 1000) throw new PurchaseBatchError("batch_too_large", "Selecione no máximo 1.000 vouchers por lote.", 400);
  const paymentPeriods = (await client.query<{ purchaseId: number; periodId: number }>(`SELECT DISTINCT idcompra AS "purchaseId",periodo_id AS "periodId"
    FROM compra_pagamentos WHERE idcompra=ANY($1::int[]) AND periodo_id IS NOT NULL ORDER BY idcompra,periodo_id`, [ids])).rows;
  const periodIds = uniqueNumbers([...purchases.map(p => p.periodId),...vouchers.flatMap(v => [v.periodId,v.validationPeriodId]),...paymentPeriods.map(p => p.periodId)]);
  const periods = (await client.query<Period>(`SELECT id,parque AS park,data_operacional::text AS date,
    fechado_em IS NOT NULL OR folha_id IS NOT NULL OR EXISTS(SELECT 1 FROM caixa_fechamentos f WHERE f.periodo_id=p.id) AS closed
    FROM caixa_periodos p WHERE id=ANY($1::int[]) ORDER BY id`, [periodIds])).rows;
  const capacity = (await client.query<Capacity>(`SELECT idcompra AS "purchaseId",parque AS park,data::text AS date,quantidade AS quantity,delivery_hold AS held
    FROM online_capacity_reservations WHERE idcompra=ANY($1::int[]) ORDER BY idcompra`, [ids])).rows;
  const holdTable = (await client.query<{ name: string | null }>("SELECT to_regclass('commerce_school_payment_hold')::text AS name")).rows[0].name;
  const holds = holdTable ? (await client.query<{ id: number }>("SELECT order_id AS id FROM commerce_school_payment_hold WHERE order_id=ANY($1::int[]) AND status<>'released' ORDER BY order_id", [ids])).rows.map(r => r.id) : [];
  const pending = (await client.query<{ id: number }>("SELECT purchase_id::int AS id FROM purchase_adjustments WHERE parque=$1 AND purchase_id=ANY($2::int[]) AND status='pending' ORDER BY purchase_id", [park,ids])).rows.map(r => r.id);
  const target = input.targetDate ? await getOperationalDay(input.targetDate,client) : null;
  const targetHasGroups = target?.dayUseAgendaId ? (await client.query("SELECT 1 FROM agenda_extras WHERE idagenda=$1 LIMIT 1", [target.dayUseAgendaId])).rows.length > 0 : false;
  const occupied = target ? await getOnlineCapacityOccupied(client,park,target.date) : 0;
  const today = (await client.query<{ today: string }>("SELECT (clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date::text AS today")).rows[0].today;
  const result: Snapshot = { today,purchases,vouchers,periods,capacity,paymentPeriods,closedDates: [],holds,pending,target,targetHasGroups,occupied };
  result.closedDates = (await client.query<{ date: string }>("SELECT data::text AS date FROM operacao_dias WHERE parque=$1 AND data=ANY($2::date[]) AND estado='closed' ORDER BY data", [park,datesFor(result,input)])).rows.map(r => r.date);
  return result;
}
function preview(input: PurchaseBatchInput, s: Snapshot, resolvingPurchaseId?: number): PurchaseBatchPreview {
  const park = getOperationalParkId();
  const items: PurchaseBatchItem[] = input.purchaseIds.map(id => {
    const item: PurchaseBatchItem = { purchaseId: id,status: "rejected",message: "Compra indisponível.",vouchers: [] };
    const reject = (message: string) => ({ ...item,message,vouchers: [] });
    const p = s.purchases.find(p => p.id === id), vs = s.vouchers.filter(v => v.purchaseId === id), cap = s.capacity.find(c => c.purchaseId === id);
    if (!p || !vs.length || vs.some(v => v.park && v.park !== park) || (cap && cap.park !== park)) return reject("Compra indisponível neste parque.");
    if (p.status !== "conc") return reject("A compra precisa estar confirmada e não cancelada.");
    if (p.schoolContext != null || vs.some(v => v.schoolId !== null || v.type === "escol" || v.groupAgenda || !["padra","promo"].includes(v.agendaType ?? "")) ||
      !vs.some(v => !v.serviceId && ["norma","infan","isent","corte"].includes(v.type)) ||
      vs.some(v => !v.serviceId && !["norma","infan","isent","corte"].includes(v.type))) return reject("O lote aceita somente compras inteiras de day use, sem passeios ou escolares.");
    if (vs.some(v => v.used !== "n" || v.usedOn !== null)) return reject("A compra contém ingresso usado, cancelado ou inválido.");
    if (cap?.held || s.holds.includes(id)) return reject("Compra retida para conferência pelo atendimento.");
    if (s.pending.includes(id) && resolvingPurchaseId !== id) return reject("Já existe um ajuste pendente para esta compra.");
    if (new Set(vs.map(v => v.from ?? v.visit)).size !== 1) return reject("A compra possui mais de uma data de visita. Confira o cadastro.");
    if (cap && (cap.date !== (vs[0].from ?? vs[0].visit) || cap.quantity !== vs.filter(v => !v.serviceId).length)) return reject("A reserva de vagas não corresponde aos ingressos. Confira a compra antes de mover.");
    try {
      for (const v of vs) {
        const from = v.from ?? v.visit;
        // Legacy admission expires six calendar months after purchase, even without an explicit end date.
        const until = v.from ? v.until : isCivilDate(p.purchasedOn) ? voucherValidityRange(p.purchasedOn,"6_months").validUntil : null;
        if (!isCivilDate(from) || !isCivilDate(until) || until < s.today || v.status === "vencido") return reject("A compra contém ingresso vencido ou sem validade verificável.");
        const range = purchaseBatchRange(input.targetDate ?? from,until,input.validity);
        if (range.validUntil < s.today) return reject("A nova validade já estaria vencida.");
        item.vouchers.push({ id: v.id,from,until,nextFrom: range.validFrom,nextUntil: range.validUntil });
      }
    } catch { return reject("A nova data está fora da validade. Escolha uma validade compatível."); }
    if (input.targetDate && (input.targetDate < s.today || !s.target?.dayUseOpen || !s.target.dayUseAgendaId || s.target.closed || s.targetHasGroups)) return reject("Escolha uma data futura ou de hoje com day use aberto, sem vínculo de grupo.");
    if (cap && input.targetDate && cap.date !== input.targetDate && (s.target?.version == null || s.target.onlineSoldOut)) return reject("O destino não está disponível para transferir a reserva de vagas online.");
    const linked = periodsFor(s,id);
    if (linked.some(id => !s.periods.some(p => p.id === id)) || s.periods.some(p => linked.includes(p.id) && p.park !== null && p.park !== park)) return reject("Não foi possível conferir o vínculo financeiro da compra.");
    if (resolvingPurchaseId === id && s.closedDates.length) return reject("Reabra as datas afetadas antes de resolver o ajuste.");
    if (resolvingPurchaseId !== id && (vs.some(v => v.closedAt) || s.periods.some(p => linked.includes(p.id) && p.closed) ||
      [...vs.map(v => v.from ?? v.visit),...s.periods.filter(p => linked.includes(p.id)).map(p => p.date),cap?.date].some(d => d && s.closedDates.includes(d)))) {
      return { ...item,status: "adjustment_required",message: "Histórico fechado: será registrada uma pendência. Os ingressos não serão alterados agora." };
    }
    if (input.notifyEmail && (!p.email || p.email.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(p.email))) return reject("O cadastro não possui e-mail válido para o aviso solicitado.");
    return { ...item,status: "eligible",message: "Pronta para alterar, mantendo os preços pagos." };
  });
  const incoming = items.filter(i => i.status === "eligible").map(i => s.capacity.find(c => c.purchaseId === i.purchaseId)).filter((c): c is Capacity => !!c && !!input.targetDate && c.date !== input.targetDate);
  if (s.target?.onlineLimit != null && s.occupied + incoming.reduce((n,c) => n+c.quantity,0) > s.target.onlineLimit) {
    for (const item of items) if (incoming.some(c => c.purchaseId === item.purchaseId)) { item.status = "rejected"; item.message = "O lote excede as vagas online disponíveis no destino."; item.vouchers = []; }
  }
  return { fingerprint: hash({ input,s,items }),items };
}
export async function previewPurchaseBatch(value: unknown): Promise<PurchaseBatchPreview> {
  const input = normalizePurchaseBatch(value), client = await getIngressoSistemaDbPool().connect();
  try { await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY"); const result = preview(input,await readSnapshot(client,input)); await client.query("COMMIT"); return result; }
  catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}
export async function applyPurchaseBatch(value: unknown, actor: CatalogActor): Promise<PurchaseBatchResult> { return applyBatch(value,actor); }
async function applyBatch(value: unknown, actor: CatalogActor, resolution?: {client:PoolClient;purchaseId:number}): Promise<PurchaseBatchResult> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalidPurchaseBatch();
  const { fingerprint,idempotencyKey,...data } = value as Record<string,unknown>;
  const input = normalizePurchaseBatch(data);
  if (typeof fingerprint !== "string" || !/^[a-f0-9]{64}$/.test(fingerprint) || typeof idempotencyKey !== "string" || !/^[A-Za-z0-9:_-]{1,100}$/.test(idempotencyKey)) return invalidPurchaseBatch();
  if (!actor.cpf || !/^\d{11}$/.test(actor.cpf)) throw new PurchaseBatchError("batch_actor_required", "Sua sessão precisa identificar o operador.",403);
  const park = getOperationalParkId(), requestHash = hash({ input,fingerprint,resolvingPurchaseId:resolution?.purchaseId }), client = resolution?.client ?? await getIngressoSistemaDbPool().connect();
  try {
    if (!resolution) await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`purchase-batch:${park}:${idempotencyKey}`]);
    const existing = (await client.query<{ request_hash: string; actor_cpf: string; result: PurchaseBatchResult }>("SELECT request_hash,actor_cpf,result FROM purchase_batches WHERE parque=$1 AND idempotency_key=$2", [park,idempotencyKey])).rows[0];
    if (existing) {
      if (existing.actor_cpf !== actor.cpf) throw new PurchaseBatchError("batch_forbidden", "Esta solicitação pertence a outro operador.",403);
      if (existing.request_hash !== requestHash) throw new PurchaseBatchError("batch_idempotency_conflict", "Esta chave já foi utilizada em outro lote.");
      if (!resolution) await client.query("COMMIT"); return existing.result;
    }
    const before = await readSnapshot(client,input);
    for (const date of datesFor(before,input)) await lockOperationalDay(client,park,date);
    await client.query("SELECT id FROM caixa_periodos WHERE id=ANY($1::int[]) ORDER BY id FOR UPDATE", [before.periods.map(p => p.id)]);
    if (before.target?.dayUseAgendaId) await client.query("SELECT idagenda FROM agenda WHERE idagenda=$1 FOR SHARE", [before.target.dayUseAgendaId]);
    await client.query("SELECT idcompra FROM compra WHERE idcompra=ANY($1::int[]) ORDER BY idcompra FOR UPDATE", [input.purchaseIds]);
    await client.query("SELECT idvoucher FROM voucher WHERE idcompra=ANY($1::int[]) ORDER BY idcompra,idvoucher FOR UPDATE", [input.purchaseIds]);
    await client.query("SELECT idcompra FROM online_capacity_reservations WHERE idcompra=ANY($1::int[]) ORDER BY idcompra FOR UPDATE", [input.purchaseIds]);
    const current = await readSnapshot(client,input), checked = preview(input,current,resolution?.purchaseId);
    if (hash(before) !== hash(current) || checked.fingerprint !== fingerprint) throw new PurchaseBatchError("batch_preview_changed", "Os dados mudaram. Gere uma nova prévia antes de confirmar.");
    const batchId = randomUUID();
    const result: PurchaseBatchResult = { batchId,applied: [],adjustments: [],rejected: [],emailPending: 0 };
    await client.query(`INSERT INTO purchase_batches(id,parque,idempotency_key,request_hash,actor_cpf,actor_name,command,result)
      VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb)`, [batchId,park,idempotencyKey,requestHash,actor.cpf,actor.name,JSON.stringify(input),JSON.stringify(result)]);
    for (const item of checked.items) {
      if (item.status === "rejected") { result.rejected.push(item.purchaseId); continue; }
      const original = current.vouchers.filter(v => v.purchaseId === item.purchaseId);
      if (item.status === "adjustment_required") {
        const relatedPeriods = periodsFor(current,item.purchaseId);
        const sourceDates = [...new Set([...original.map(v => v.from ?? v.visit),...current.periods.filter(p => relatedPeriods.includes(p.id)).map(p => p.date)].filter(isCivilDate))];
        await client.query(`INSERT INTO purchase_adjustments(id,batch_id,parque,purchase_id,source_dates,before_snapshot,requested_change)
          VALUES($1,$2,$3,$4,$5::date[],$6::jsonb,$7::jsonb)`, [randomUUID(),batchId,park,item.purchaseId,sourceDates,JSON.stringify(original),JSON.stringify({ ...input,purchaseIds: [item.purchaseId] })]);
        result.adjustments.push(item.purchaseId);
      } else {
        for (const v of item.vouchers) await client.query(`UPDATE voucher SET idagenda=COALESCE($2,idagenda),dtinicio_validade=$3::date,dtvalidade=$4::date,
          parque_operacional=$5,flreagendado='s' WHERE idvoucher=$1 AND idcompra=$6`, [v.id,current.target?.dayUseAgendaId ?? null,v.nextFrom,v.nextUntil,park,item.purchaseId]);
        if (input.targetDate) await client.query("UPDATE online_capacity_reservations SET data=$2::date WHERE idcompra=$1 AND data<>$2::date", [item.purchaseId,input.targetDate]);
        result.applied.push(item.purchaseId);
        if (input.notifyEmail) {
          await client.query(`INSERT INTO purchase_batch_email(id,batch_id,purchase_id,destination,material_snapshot)
            VALUES($1,$2,$3,$4,$5::jsonb)`, [randomUUID(),batchId,item.purchaseId,current.purchases.find(p => p.id === item.purchaseId)!.email,JSON.stringify({ purchaseId: item.purchaseId,vouchers: item.vouchers,reason: input.reason })]);
          result.emailPending++;
        }
      }
      await registerOpsAuditLog(client,{ origem: "voucher",acao: item.status === "eligible" ? "reschedule_batch" : "adjustment_pending",compraId: item.purchaseId,
        descricao: item.status === "eligible" ? "Data/validade alterada pelo painel, preservando preços." : "Ajuste solicitado para compra com histórico fechado.",
        motivo: input.reason,usuarioNome: actor.name,detalhes: { batchId,actorCpf: actor.cpf,vouchers: item.vouchers } },"postgres");
    }
    await client.query("UPDATE purchase_batches SET result=$2::jsonb WHERE id=$1", [batchId,JSON.stringify(result)]);
    if (!resolution) await client.query("COMMIT"); return result;
  } catch (error) { if (!resolution) await client.query("ROLLBACK"); throw error; } finally { if (!resolution) client.release(); }
}


type AdjustmentRow={id:string;purchaseId:number;status:string;beforeSnapshot:Voucher[];requestedChange:PurchaseBatchInput;resolution:Record<string,unknown>|null};
async function readAdjustment(client:PoolClient,id:string,lock=false){
  if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id))return invalidPurchaseBatch();
  const row=(await client.query<AdjustmentRow>(`SELECT id,purchase_id::int AS "purchaseId",status,before_snapshot AS "beforeSnapshot",requested_change AS "requestedChange",resolution FROM purchase_adjustments WHERE parque=$1 AND id=$2${lock?' FOR UPDATE':''}`,[getOperationalParkId(),id])).rows[0];
  if(!row)throw new PurchaseBatchError('adjustment_missing','Ajuste não encontrado.',404);return row;
}
async function adjustmentPreview(client:PoolClient,row:AdjustmentRow){
  const input=normalizePurchaseBatch(row.requestedChange),snapshot=await readSnapshot(client,input),result=preview(input,snapshot,row.purchaseId);
  if(input.purchaseIds.length!==1||input.purchaseIds[0]!==row.purchaseId)throw new PurchaseBatchError('adjustment_invalid','A solicitação não corresponde à compra.');
  if(tripFingerprint(snapshot.vouchers)!==tripFingerprint(row.beforeSnapshot))throw new PurchaseBatchError('adjustment_source_changed','Os ingressos mudaram desde a solicitação. Rejeite o ajuste e gere uma nova solicitação após conferir a compra.');
  return {input,snapshot,result};
}
export async function previewPurchaseAdjustment(id:string){
  const client=await getIngressoSistemaDbPool().connect();
  try{await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');const row=await readAdjustment(client,id);if(row.status!=='pending')throw new PurchaseBatchError('adjustment_resolved','O ajuste já foi resolvido.');const {input,result}=await adjustmentPreview(client,row);await client.query('COMMIT');return {request:input,...result};}
  catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
export async function resolvePurchaseAdjustment(id:string,value:unknown,actor:CatalogActor & {manager:boolean}){
  if(!actor.manager||!actor.cpf||!/^\d{11}$/.test(actor.cpf))throw new PurchaseBatchError('adjustment_manager_required','A resolução exige um gerente identificado.',403);
  if(!value||typeof value!=='object'||Array.isArray(value))return invalidPurchaseBatch();
  const data=value as Record<string,unknown>;
  if(Object.keys(data).some(k=>!['decision','reason','fingerprint','idempotencyKey'].includes(k))||!['apply','reject'].includes(String(data.decision))||typeof data.reason!=='string'||!data.reason.trim()||data.reason.length>1000||data.reason.includes('\0')||typeof data.idempotencyKey!=='string'||!/^[A-Za-z0-9:_-]{1,100}$/.test(data.idempotencyKey)||(data.decision==='apply'&&(typeof data.fingerprint!=='string'||!/^[a-f0-9]{64}$/.test(data.fingerprint))))return invalidPurchaseBatch();
  const client=await getIngressoSistemaDbPool().connect(),requestHash=hash({id,data}),park=getOperationalParkId();
  try{
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`purchase-batch:${park}:${data.idempotencyKey}`]);
    const initial=await readAdjustment(client,id),input=normalizePurchaseBatch(initial.requestedChange),snapshot=await readSnapshot(client,input);
    for(const date of datesFor(snapshot,input))await lockOperationalDay(client,park,date);
    const row=await readAdjustment(client,id,true);
    if(row.status!=='pending'){
      if(row.resolution?.idempotencyKey!==data.idempotencyKey||row.resolution?.requestHash!==requestHash||row.resolution?.actorCpf!==actor.cpf)throw new PurchaseBatchError('adjustment_idempotency_conflict','O ajuste foi resolvido por outra tentativa.');
      await client.query('COMMIT');return row.resolution;
    }
    let batch:PurchaseBatchResult|null=null;
    if(data.decision==='apply'){
      const checked=await adjustmentPreview(client,row);
      if(checked.result.fingerprint!==data.fingerprint)throw new PurchaseBatchError('adjustment_preview_changed','Os dados mudaram. Confira uma nova prévia.');
      if(checked.result.items[0]?.status!=='eligible')throw new PurchaseBatchError('adjustment_not_eligible',checked.result.items[0]?.message??'A compra não pode ser alterada.');
      batch=await applyBatch({...checked.input,fingerprint:data.fingerprint,idempotencyKey:data.idempotencyKey},actor,{client,purchaseId:row.purchaseId});
      if(!batch.applied.includes(row.purchaseId))throw new PurchaseBatchError('adjustment_not_applied','O ajuste não foi aplicado.');
    }
    const resolution={id,decision:data.decision,reason:data.reason.trim(),actorCpf:actor.cpf,actorName:actor.name,idempotencyKey:data.idempotencyKey,requestHash,batch};
    await client.query("UPDATE purchase_adjustments SET status=$2,resolved_at=clock_timestamp(),resolution=$3::jsonb WHERE id=$1",[id,data.decision==='apply'?'resolved':'rejected',JSON.stringify(resolution)]);
    await registerOpsAuditLog(client,{origem:'voucher',acao:'adjustment_resolved',compraId:row.purchaseId,descricao:data.decision==='apply'?'Ajuste aplicado após revisão, preservando snapshots anteriores.':'Ajuste rejeitado; ingressos preservados.',motivo:data.reason.trim(),usuarioNome:actor.name,detalhes:resolution},'postgres');
    await client.query('COMMIT');return resolution;
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
