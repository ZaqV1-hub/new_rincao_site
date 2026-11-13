import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import { getOperationalCatalogPool, type CatalogActor } from "@/lib/painel-operational-catalog";
import { getOperationalParkId, type OperationalParkId } from "@/lib/operational-day-contract";
import { isCivilDate } from "@/lib/operational-date";
import { lockOperationalDay } from "@/lib/operational-day-lock";

export type CashSessionType = "sales" | "trips";
export type CashSessionMovement = {
  id: number; periodId: number; type: "fundo" | "sangria" | "despesa" | "devolucao";
  responsible: string; amountCents: number; reason: string; actor: CatalogActor; createdAt: string;
};
export type CashSessionSnapshot = {
  schemaVersion: 1; periodId: number; park: OperationalParkId; date: string; locationId: number; locationName: string; type: CashSessionType;
  generatedAt: string; closedAt: string | null; openingCashCents: number;
  payments: { method: string; amountCents: number }[]; receiptsCount: number; lastReceiptAt: string | null;
  cashReceivedCents: number; fundsCents: number; withdrawalsCents: number; expensesCents: number; refundsCents: number;
  expectedCashCents: number; countedCashCents: number | null; differenceCents: number | null;
  sales: { purchaseCount: number; ticketCount: number; serviceCount: number; courtesyCount: number; revenueCents: number; serviceRevenueCents: number; discountCents: number };
  admissions: { ticketCount: number; serviceCount: number; onlineTicketCount: number; schoolCount: number; unclassifiedCount: number };
  services: { serviceId: number; name: string; quantity: number; revenueCents: number }[];
  movements: CashSessionMovement[]; pending: string[];
};
export type CashSession = {
  id: number; park: OperationalParkId; date: string; locationId: number; locationName: string; type: CashSessionType;
  openingCashCents: number; openedAt: string; closedAt: string | null; openedBy: CatalogActor; closedBy: CatalogActor | null;
  closureId: number | null; countedCashCents: number | null; automatic: boolean; snapshot?: CashSessionSnapshot;
};
export type CashSessionDetail = CashSession & { snapshot: CashSessionSnapshot };
export class CashSessionError extends Error {
  constructor(readonly code: string, message: string, readonly status = 409) { super(message); this.name = "CashSessionError"; }
}

const MAX_INPUT_CENTS = 9999999999;
const MAX_TOTAL_CENTS = 999999999999;
const sessionColumns = `id,parque,data_operacional::text AS date,local_id::text,local_nome,tipo,troco_inicial::text,
  aberto_em::text,fechado_em::text,operador,aberto_por_cpf,fechado_por_nome,fechado_por_cpf,folha_id,contado::text,fechamento_auto`;
type SessionRow = { id: number; parque: OperationalParkId; date: string; local_id: string; local_nome: string; tipo: CashSessionType; troco_inicial: string;
  aberto_em: string; fechado_em: string | null; operador: string | null; aberto_por_cpf: string | null; fechado_por_nome: string | null; fechado_por_cpf: string | null;
  folha_id: number | null; contado: string | null; fechamento_auto: boolean };
type MovementRow = { id: number; periodo_id: number; tipo: CashSessionMovement["type"]; responsavel: string; valor: string; motivo: string | null; ator_nome: string | null; ator_cpf: string | null; created_at: string };

function invalid(message: string): never { throw new CashSessionError("invalid_input", message, 400); }
function identity(value: number) { if (!Number.isSafeInteger(value) || value <= 0) invalid("Informe um identificador positivo e seguro."); return value; }
function civilDate(value: string) { if (!isCivilDate(value)) invalid("Informe uma data civil válida."); return value; }
function inputCents(value: number, positive = false) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < (positive ? 1 : 0) || value > MAX_INPUT_CENTS) invalid("Informe um valor em centavos inteiros dentro do limite permitido.");
  return value;
}
function text(value: string, max: number) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) invalid("Informe os campos obrigatórios dentro do limite permitido.");
  return value.trim();
}
function actorInput(actor: CatalogActor): CatalogActor {
  const name = actor?.name === null ? null : text(actor?.name, 120);
  const cpf = actor?.cpf === null ? null : typeof actor?.cpf === "string" ? actor.cpf.replace(/\D/g, "") : "";
  if ((!name && !cpf) || (cpf !== null && !/^\d{11}$/.test(cpf))) invalid("O operador autenticado não foi identificado.");
  return { name, cpf };
}
function bounded(value: number) {
  if (!Number.isSafeInteger(value) || Math.abs(value) > MAX_TOTAL_CENTS) throw new CashSessionError("cash_invalid_data", "O valor do caixa excede o limite de apuração.");
  return value;
}
function cents(value: string) {
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) throw new CashSessionError("cash_invalid_data", "Há um valor monetário inválido no caixa.");
  const result = BigInt(match[2]) * BigInt(100) + BigInt((match[3] ?? "").padEnd(2, "0"));
  if (result > BigInt(MAX_TOTAL_CENTS)) throw new CashSessionError("cash_invalid_data", "O valor do caixa excede o limite de apuração.");
  return Number(match[1] ? -result : result);
}
function money(value: number) { bounded(value); return `${value < 0 ? "-" : ""}${Math.floor(Math.abs(value) / 100)}.${String(Math.abs(value) % 100).padStart(2, "0")}`; }
function instant(value: string) { const date = new Date(value); if (!Number.isFinite(date.getTime())) throw new CashSessionError("cash_invalid_data", "Há uma data inválida no caixa."); return date.toISOString(); }
function count(value: string | number) { const result = Number(value); if (!Number.isSafeInteger(result) || result < 0) throw new CashSessionError("cash_invalid_data", "Há uma quantidade inválida no caixa."); return result; }
function mapSession(row: SessionRow): CashSession {
  return { id: identity(row.id), park: row.parque, date: row.date, locationId: identity(Number(row.local_id)), locationName: row.local_nome, type: row.tipo,
    openingCashCents: cents(row.troco_inicial), openedAt: instant(row.aberto_em), closedAt: row.fechado_em ? instant(row.fechado_em) : null,
    openedBy: { name: row.operador, cpf: row.aberto_por_cpf }, closedBy: row.fechado_em ? { name: row.fechado_por_nome, cpf: row.fechado_por_cpf } : null,
    closureId: row.folha_id, countedCashCents: row.contado === null ? null : cents(row.contado), automatic: row.fechamento_auto };
}
async function sessionRow(client: PoolClient, periodId: number, lock = false): Promise<CashSession> {
  const row = (await client.query<SessionRow>(`SELECT ${sessionColumns} FROM caixa_periodos WHERE id=$1 AND parque=$2${lock ? " FOR UPDATE" : ""}`, [periodId, getOperationalParkId()])).rows[0];
  if (!row) throw new CashSessionError("cash_session_not_found", "Caixa não encontrado neste parque.", 404);
  return mapSession(row);
}
async function today(client: PoolClient) { return (await client.query<{ date: string }>("SELECT (clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date::text AS date")).rows[0].date; }
async function lockDay(client: PoolClient, park: OperationalParkId, date: string, closing = false) {
  await lockOperationalDay(client, park, date);
  const row = (await client.query<{ estado: string }>("SELECT estado FROM operacao_dias WHERE parque=$1 AND data=$2::date FOR UPDATE", [park,date])).rows[0];
  if (row?.estado === "closed" && !closing) throw new CashSessionError("day_closed", "O dia está fechado para novas operações.");
}

// Call before purchase/voucher locks, within the caller's transaction. Never opens a session.
export async function lockOpenCashSession(client: PoolClient, input: { periodId: number; expectedType?: CashSessionType; date?: string }): Promise<CashSession> {
  identity(input.periodId); if (input.date !== undefined) civilDate(input.date);
  const discovered = await sessionRow(client, input.periodId);
  await lockDay(client, discovered.park, discovered.date);
  const session = await sessionRow(client, input.periodId, true);
  if (session.date !== discovered.date) throw new CashSessionError("cash_session_changed", "O caixa mudou durante a operação. Atualize a tela.");
  if (session.closedAt) throw new CashSessionError("cash_session_closed", "Este caixa já foi fechado.");
  if (session.date !== await today(client) || (input.date !== undefined && input.date !== session.date)) throw new CashSessionError("cash_date_not_today", "A operação exige um caixa aberto na data de hoje.");
  if (input.expectedType !== undefined && session.type !== input.expectedType) throw new CashSessionError("cash_type_mismatch", "Este caixa não corresponde ao tipo da operação.");
  return session;
}

function canonical(value: unknown, ancestors = new Set<object>()): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (typeof value !== "object" || ancestors.has(value)) invalid("O conteúdo do comando de caixa é inválido.");
  ancestors.add(value);
  try {
    if (Array.isArray(value)) return `[${value.map((item) => canonical(item, ancestors)).join(",")}]`;
    if (Object.getPrototypeOf(value) !== Object.prototype) invalid("O conteúdo do comando de caixa é inválido.");
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key], ancestors)}`).join(",")}}`;
  } finally { ancestors.delete(value); }
}

// One command per transaction, before any day/row lock. E9 bulk close does not acquire command locks.
export async function withCashSessionCommand<T>(client: PoolClient, input: { action: string; key: string; payload: unknown; periodId: number | null }, run: () => Promise<{ periodId: number; response: T }>): Promise<T> {
  const park = getOperationalParkId(), action = text(input.action, 60), key = text(input.key, 100);
  if (input.periodId !== null) identity(input.periodId);
  const hash = createHash("sha256").update(canonical({ periodId: input.periodId, payload: input.payload })).digest("hex");
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`cash-command:${JSON.stringify([park,action,key])}`]);
  const existing = (await client.query<{ request_hash: string; response_json: T }>("SELECT request_hash,response_json FROM caixa_operacoes WHERE parque=$1 AND acao=$2 AND chave=$3", [park,action,key])).rows[0];
  if (existing) {
    if (existing.request_hash !== hash) throw new CashSessionError("idempotency_conflict", "Esta chave já foi usada com outro conteúdo. Consulte o resultado anterior.");
    return existing.response_json;
  }
  const result = await run();
  identity(result.periodId);
  if (input.periodId !== null && result.periodId !== input.periodId) throw new CashSessionError("cash_session_mismatch", "O comando retornou um caixa diferente do solicitado.");
  await sessionRow(client, result.periodId);
  const response = JSON.parse(canonical(result.response)) as T;
  await client.query("INSERT INTO caixa_operacoes(parque,acao,chave,request_hash,periodo_id,response_json) VALUES($1,$2,$3,$4,$5,$6::jsonb)", [park,action,key,hash,result.periodId,JSON.stringify(response)]);
  return response;
}

async function transaction<T>(run: (client: PoolClient) => Promise<T>, readOnly = false): Promise<T> {
  const client = await getOperationalCatalogPool().connect(); let discard = false;
  try {
    await client.query(readOnly ? "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY" : "BEGIN");
    try { const value = await run(client); await client.query("COMMIT"); return value; }
    catch (error) { try { await client.query("ROLLBACK"); } catch { discard = true; } throw error; }
  } finally { client.release(discard); }
}
async function audit(client: PoolClient, session: CashSession, action: string, reason: string, actor: CatalogActor, details: unknown, movementId: number | null = null) {
  await client.query(`INSERT INTO edicoes_log(origem,acao,periodo_id,folha_id,movimentacao_id,descricao,motivo,usuario_nome,detalhes_json)
    VALUES('caixa-operacional',$1,$2,$3,$4,$5,$6,$7,$8)`, [action,session.id,session.closureId,movementId,`Caixa ${session.locationName}: ${action}.`,reason,actor.name ?? actor.cpf,JSON.stringify({actorCpf:actor.cpf,...(details as object)})]);
}

export async function readCashSessionSnapshot(client: PoolClient, session: CashSession): Promise<CashSessionSnapshot> {
  if (session.park !== getOperationalParkId()) throw new CashSessionError("cash_session_not_found", "Caixa não encontrado neste parque.",404);
  if (session.closedAt) {
    const closure = (await client.query<{ snapshot_json: CashSessionSnapshot }>("SELECT snapshot_json FROM caixa_fechamentos WHERE id=$1 AND periodo_id=$2 AND modelo_operacional=TRUE", [session.closureId,session.id])).rows[0];
    if (!closure || closure.snapshot_json.schemaVersion !== 1 || closure.snapshot_json.periodId !== session.id || closure.snapshot_json.park !== session.park) throw new CashSessionError("cash_snapshot_missing", "O fechamento deste caixa precisa de conferência.");
    return closure.snapshot_json;
  }
  const paymentRows = (await client.query<{ method: string; amount: string; quantity: string; last: string | null }>(`SELECT btrim(forma_pagamento) AS method,SUM(valor)::text AS amount,COUNT(*)::text AS quantity,MAX(recebido_em)::text AS last
    FROM ${session.type === "trips" ? `(SELECT forma_pagamento,valor,recebido_em,periodo_id FROM compra_pagamentos
      UNION ALL SELECT method AS forma_pagamento,(amount_cents/100.0)::numeric(12,2) AS valor,confirmed_at AS recebido_em,period_id AS periodo_id
      FROM passeio_recebimentos WHERE status='confirmed') trip_payments` : "compra_pagamentos"} WHERE periodo_id=$1 GROUP BY btrim(forma_pagamento) ORDER BY btrim(forma_pagamento)`,[session.id])).rows;
  const payments = paymentRows.map((row) => ({method:row.method,amountCents:cents(row.amount)}));
  if (payments.some((payment) => payment.amountCents < 0 || !payment.method)) throw new CashSessionError("cash_invalid_data", "Há recebimentos inválidos neste caixa.");
  const movementRows = (await client.query<MovementRow>(`SELECT id,periodo_id,tipo,responsavel,valor::text,motivo,ator_nome,ator_cpf,created_at::text
    FROM movimentacao_caixa WHERE periodo_id=$1 ORDER BY id`,[session.id])).rows;
  const movements = movementRows.map((row): CashSessionMovement => ({id:row.id,periodId:row.periodo_id,type:row.tipo,responsible:row.responsavel,amountCents:cents(row.valor),reason:row.motivo ?? "",actor:{name:row.ator_nome,cpf:row.ator_cpf},createdAt:instant(row.created_at)}));
  if (movements.some((movement) => movement.amountCents < 0 || !["fundo","sangria","despesa","devolucao"].includes(movement.type))) throw new CashSessionError("cash_invalid_data", "Há movimentos inválidos neste caixa.");
  const purchase = (await client.query<{ quantity: string; revenue: string; discount: string; invalid: string }>(`SELECT COUNT(*)::text AS quantity,COALESCE(SUM(vltotcompra),0)::text AS revenue,COALESCE(SUM(vltotdesc),0)::text AS discount,
    COUNT(*) FILTER (WHERE vltotcompra IS NULL OR vltotcompra<0 OR vltotdesc<0)::text AS invalid
    FROM compra WHERE caixa_periodo_id=$1 AND stcompra='conc'`,[session.id])).rows[0];
  if(count(purchase.invalid)>0)throw new CashSessionError("cash_invalid_data","Há compras vendidas sem valor válido neste caixa.");
  type Item = { kind: string; sold: boolean; admitted: boolean; online: boolean; tpvoucher: string; price: string | null; serviceId: string | null; description: string | null };
  const items = (await client.query<Item>(`SELECT v.tpvoucher,v.vlunicompra::text AS price,v.servico_id::text AS "serviceId",v.descricao AS description,
    (c.caixa_periodo_id=$1 AND c.stcompra='conc') IS TRUE AS sold,(v.validacao_periodo_id=$1 AND v.stusado='s') IS TRUE AS admitted,c.tpcompra='ponli' AS online,
    CASE WHEN v.parque_operacional IS NOT NULL AND v.parque_operacional<>$2 THEN 'unknown'
      WHEN v.idescola IS NOT NULL OR v.tpvoucher='escol' OR a.tpagenda IN ('escol','igrej','casam','melho','confr','ongs','grmix') THEN 'school'
      WHEN v.servico_id IS NOT NULL THEN 'service'
      WHEN v.tpvoucher IN ('norma','infan','isent','corte') AND a.tpagenda IN ('padra','promo') AND NOT EXISTS(SELECT 1 FROM agenda_extras ae WHERE ae.idagenda=a.idagenda) THEN 'admission'
      ELSE 'unknown' END AS kind
    FROM voucher v JOIN compra c ON c.idcompra=v.idcompra LEFT JOIN agenda a ON a.idagenda=v.idagenda
    WHERE c.caixa_periodo_id=$1 OR v.validacao_periodo_id=$1 ORDER BY v.idvoucher`,[session.id,session.park])).rows;
  const pending: string[] = [];
  const sales: CashSessionSnapshot["sales"] = {purchaseCount:count(purchase.quantity),ticketCount:0,serviceCount:0,courtesyCount:0,revenueCents:cents(purchase.revenue),serviceRevenueCents:0,discountCents:cents(purchase.discount)};
  const admissions: CashSessionSnapshot["admissions"] = {ticketCount:0,serviceCount:0,onlineTicketCount:0,schoolCount:0,unclassifiedCount:0};
  const services = new Map<string,CashSessionSnapshot["services"][number]>();
  for (const item of items) {
    if (item.sold) {
      if (item.price === null || cents(item.price) < 0) throw new CashSessionError("cash_invalid_data", "Há itens vendidos sem valor válido neste caixa.");
      if (item.kind === "service") {
        const amount = cents(item.price), serviceId = identity(Number(item.serviceId)), name = item.description || "Serviço sem descrição";
        const key = JSON.stringify([serviceId,name]), service = services.get(key) ?? {serviceId,name,quantity:0,revenueCents:0};
        service.quantity++;service.revenueCents=bounded(service.revenueCents+amount);services.set(key,service);
        sales.serviceCount++;sales.serviceRevenueCents=bounded(sales.serviceRevenueCents+amount);
      } else if (item.kind === "admission") { sales.ticketCount++;if(item.tpvoucher === "corte")sales.courtesyCount++; }
      else if (!pending.includes("unclassified_sales")) pending.push("unclassified_sales");
    }
    if (item.admitted) {
      if (item.kind === "admission") { admissions.ticketCount++;if(item.online)admissions.onlineTicketCount++; }
      else if (item.kind === "service") admissions.serviceCount++;
      else if (item.kind === "school") admissions.schoolCount++;
      else admissions.unclassifiedCount++;
    }
  }
  if(admissions.unclassifiedCount)pending.push("unclassified_admissions");
  const sumMovement = (type: CashSessionMovement["type"]) => bounded(movements.filter((movement)=>movement.type===type).reduce((sum,movement)=>bounded(sum+movement.amountCents),0));
  const cashReceivedCents=bounded(payments.filter((payment)=>payment.method==="dinhe").reduce((sum,payment)=>bounded(sum+payment.amountCents),0));
  const fundsCents=sumMovement("fundo"),withdrawalsCents=sumMovement("sangria"),expensesCents=sumMovement("despesa"),refundsCents=sumMovement("devolucao");
  const expectedCashCents=bounded(session.openingCashCents+fundsCents+cashReceivedCents-withdrawalsCents-expensesCents-refundsCents);
  if(expectedCashCents<0)pending.push("negative_cash_balance");
  const receiptTimes=paymentRows.flatMap((row)=>row.last?[instant(row.last)]:[]).sort();
  const generatedAt=instant((await client.query<{now:string}>("SELECT clock_timestamp()::text AS now")).rows[0].now);
  return {schemaVersion:1,periodId:session.id,park:session.park,date:session.date,locationId:session.locationId,locationName:session.locationName,type:session.type,
    generatedAt,closedAt:null,openingCashCents:session.openingCashCents,payments,receiptsCount:paymentRows.reduce((sum,row)=>sum+count(row.quantity),0),lastReceiptAt:receiptTimes.at(-1)??null,
    cashReceivedCents,fundsCents,withdrawalsCents,expensesCents,refundsCents,expectedCashCents,countedCashCents:null,differenceCents:null,
    sales,admissions,services:[...services.values()],movements,pending};
}
async function detail(client: PoolClient, session: CashSession): Promise<CashSessionDetail> { return {...session,snapshot:await readCashSessionSnapshot(client,session)}; }

export async function listCashSessions(date: string, client?: Pick<PoolClient, "query">): Promise<CashSession[]> {
  civilDate(date);
  return (await (client ?? getOperationalCatalogPool()).query<SessionRow>(`SELECT ${sessionColumns} FROM caixa_periodos WHERE parque=$1 AND data_operacional=$2::date ORDER BY id`,[getOperationalParkId(),date])).rows.map(mapSession);
}
export async function getCashSession(periodId: number): Promise<CashSessionDetail> {
  identity(periodId);return transaction(async(client)=>detail(client,await sessionRow(client,periodId)),true);
}
export async function openCashSession(input: {date:string;locationId:number;openingCashCents:number;idempotencyKey:string}, actor: CatalogActor): Promise<CashSessionDetail> {
  const payload={date:civilDate(input.date),locationId:identity(input.locationId),openingCashCents:inputCents(input.openingCashCents)};
  const key=text(input.idempotencyKey,100), trustedActor=actorInput(actor), park=getOperationalParkId();
  return transaction((client)=>withCashSessionCommand(client,{action:"open",key,payload,periodId:null},async()=>{
    await lockDay(client,park,payload.date);
    if(payload.date!==await today(client))throw new CashSessionError("cash_date_not_today","Abra o caixa somente na data de hoje.");
    if((await client.query("SELECT id FROM caixa_periodos WHERE parque IS NULL AND fechado_em IS NULL LIMIT 1")).rows.length)throw new CashSessionError("legacy_cash_open","Feche e confira o caixa legado antes de abrir caixas por local.");
    const location=(await client.query<{nome:string;tipo:CashSessionType}>("SELECT nome,tipo FROM caixa_locais WHERE id=$1 AND parque=$2 AND ativo=TRUE FOR SHARE",[payload.locationId,park])).rows[0];
    if(!location)throw new CashSessionError("cash_location_unavailable","Local de caixa indisponível neste parque.");
    if((await client.query("SELECT id FROM caixa_periodos WHERE parque=$1 AND data_operacional=$2::date AND local_id=$3 AND fechado_em IS NULL",[park,payload.date,payload.locationId])).rows.length)throw new CashSessionError("cash_location_already_open","Já existe um caixa aberto neste local e data.");
    if(payload.date!==await today(client))throw new CashSessionError("cash_date_not_today","A data terminou durante a abertura. Atualize a tela.");
    const row=(await client.query<SessionRow>(`INSERT INTO caixa_periodos(parque,data_operacional,local_id,local_nome,tipo,troco_inicial,operador,aberto_por_cpf)
      VALUES($1,$2::date,$3,$4,$5,$6,$7,$8) RETURNING ${sessionColumns}`,[park,payload.date,payload.locationId,location.nome,location.tipo,money(payload.openingCashCents),trustedActor.name,trustedActor.cpf])).rows[0];
    const session=mapSession(row);await audit(client,session,"open","Abertura explícita do caixa.",trustedActor,{openingCashCents:payload.openingCashCents});
    return {periodId:session.id,response:await detail(client,session)};
  }));
}
export async function createCashSessionMovement(input:{periodId:number;type:"fundo"|"sangria";responsible:string;amountCents:number;reason:string;idempotencyKey:string},actor:CatalogActor):Promise<{movement:CashSessionMovement;session:CashSessionDetail}> {
  if(input.type!=="fundo"&&input.type!=="sangria")invalid("Informe fundo ou sangria.");
  const payload={periodId:identity(input.periodId),type:input.type,responsible:text(input.responsible,100),amountCents:inputCents(input.amountCents,true),reason:text(input.reason,2000)};
  const key=text(input.idempotencyKey,100),trustedActor=actorInput(actor);
  return transaction((client)=>withCashSessionCommand(client,{action:"movement",key,payload,periodId:payload.periodId},async()=>{
    const session=await lockOpenCashSession(client,{periodId:payload.periodId});
    const before=await readCashSessionSnapshot(client,session);
    if(payload.type==="sangria"&&payload.amountCents>before.expectedCashCents)throw new CashSessionError("cash_insufficient_balance","A sangria não pode exceder o dinheiro disponível no caixa.");
    bounded(before.expectedCashCents+(payload.type==="fundo"?payload.amountCents:-payload.amountCents));
    if(session.date!==await today(client))throw new CashSessionError("cash_date_not_today","A data do caixa terminou. Atualize a tela.");
    const id=(await client.query<{id:number}>(`INSERT INTO movimentacao_caixa(tipo,responsavel,valor,periodo_id,motivo,ator_nome,ator_cpf,created_at,data_hora)
      VALUES($1,$2,$3,$4,$5,$6,$7,clock_timestamp(),clock_timestamp() AT TIME ZONE 'America/Sao_Paulo') RETURNING id`,[payload.type,payload.responsible,money(payload.amountCents),session.id,payload.reason,trustedActor.name,trustedActor.cpf])).rows[0].id;
    const updated=await detail(client,session),movement=updated.snapshot.movements.find((entry)=>entry.id===id)!;
    await audit(client,session,payload.type,payload.reason,trustedActor,{beforeCashCents:before.expectedCashCents,afterCashCents:updated.snapshot.expectedCashCents,movement},id);
    return {periodId:session.id,response:{movement,session:updated}};
  }));
}

// For E9 only: caller holds the day lock and closes every period before storing the day's snapshot.
// This function rechecks/locks the period; no transaction or idempotency lock is opened here.
export async function closeLockedCashSession(client:PoolClient,session:CashSession,input:{countedCashCents:number|null;automatic:boolean;reason:string},actor:CatalogActor):Promise<CashSessionDetail> {
  const reason=text(input.reason,2000),trustedActor=actorInput(actor);
  if(input.countedCashCents!==null)inputCents(input.countedCashCents);
  const actual=await sessionRow(client,identity(session.id),true);
  if(actual.park!==session.park||actual.date!==session.date)throw new CashSessionError("cash_session_changed","O caixa mudou durante o fechamento.");
  if(actual.closedAt)return detail(client,actual);
  if(input.automatic&&actual.date>=await today(client))throw new CashSessionError("cash_not_expired","O caixa ainda não venceu para fechamento automático.");
  const snapshot=await readCashSessionSnapshot(client,actual);
  const closedAt=instant((await client.query<{closed:string}>(input.automatic?"SELECT (($1::date+1)::timestamp AT TIME ZONE 'America/Sao_Paulo')::text AS closed":"SELECT clock_timestamp()::text AS closed",input.automatic?[actual.date]:[])).rows[0].closed);
  snapshot.closedAt=closedAt;snapshot.countedCashCents=input.countedCashCents;snapshot.differenceCents=input.countedCashCents===null?null:bounded(input.countedCashCents-snapshot.expectedCashCents);
  if(input.countedCashCents===null)snapshot.pending.push("cash_count_missing");
  const closureId=(await client.query<{id:number}>(`INSERT INTO caixa_fechamentos(periodo_id,modelo_operacional,snapshot_json,totals_dinheiro,totals_fundo,totals_geral)
    VALUES($1,TRUE,$2::jsonb,$3,$4,$5) RETURNING id`,[actual.id,JSON.stringify(snapshot),money(snapshot.cashReceivedCents),money(bounded(snapshot.openingCashCents+snapshot.fundsCents)),money(snapshot.expectedCashCents)])).rows[0].id;
  await client.query("UPDATE caixa_periodos SET fechado_em=$2,folha_id=$3,contado=$4,fechado_por_nome=$5,fechado_por_cpf=$6,fechamento_auto=$7 WHERE id=$1",[actual.id,closedAt,closureId,input.countedCashCents===null?null:money(input.countedCashCents),trustedActor.name,trustedActor.cpf,input.automatic]);
  const closed:CashSessionDetail={...actual,closedAt,closureId,countedCashCents:input.countedCashCents,closedBy:trustedActor,automatic:input.automatic,snapshot};
  await audit(client,closed,input.automatic?"auto_close":"close",reason,trustedActor,{expectedCashCents:snapshot.expectedCashCents,countedCashCents:input.countedCashCents,differenceCents:snapshot.differenceCents});
  await client.query("UPDATE edicoes_log SET folha_id=$2 WHERE periodo_id=$1 AND folha_id IS NULL",[actual.id,closureId]);
  return closed;
}
export async function closeCashSession(input:{periodId:number;countedCashCents:number;idempotencyKey:string;reason:string},actor:CatalogActor):Promise<CashSessionDetail> {
  const payload={periodId:identity(input.periodId),countedCashCents:inputCents(input.countedCashCents),reason:text(input.reason,2000)};
  const key=text(input.idempotencyKey,100),trustedActor=actorInput(actor);
  return transaction((client)=>withCashSessionCommand(client,{action:"close",key,payload,periodId:payload.periodId},async()=>{
    const session=await lockOpenCashSession(client,{periodId:payload.periodId});
    return {periodId:session.id,response:await closeLockedCashSession(client,session,{...payload,automatic:false},trustedActor)};
  }));
}
export async function autoCloseExpiredCashSessions(actor:CatalogActor):Promise<{closedCount:number;closedPeriodIds:number[]}> {
  const trustedActor=actorInput(actor),park=getOperationalParkId();
  const candidates=(await getOperationalCatalogPool().query<{id:number}>("SELECT id FROM caixa_periodos WHERE parque=$1 AND fechado_em IS NULL AND data_operacional<(clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date ORDER BY data_operacional,id",[park])).rows;
  const closedPeriodIds:number[]=[];
  for(const {id} of candidates) {
    const closed=await transaction((client)=>withCashSessionCommand(client,{action:"auto_close",key:`expired:${id}`,payload:{periodId:id},periodId:id},async()=>{
      const discovered=await sessionRow(client,id);await lockDay(client,park,discovered.date,true);
      const session=await sessionRow(client,id,true);
      if(session.date!==discovered.date)throw new CashSessionError("cash_session_changed","O caixa mudou durante o fechamento.");
      if(session.closedAt)return {periodId:id,response:{closed:false}};
      await closeLockedCashSession(client,session,{countedCashCents:null,automatic:true,reason:"Fechamento automático após o término da data operacional."},trustedActor);
      return {periodId:id,response:{closed:true}};
    }));
    if(closed.closed)closedPeriodIds.push(id);
  }
  return {closedCount:closedPeriodIds.length,closedPeriodIds};
}
