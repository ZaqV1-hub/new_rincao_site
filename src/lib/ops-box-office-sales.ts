import { randomInt } from "node:crypto";
import type { PoolClient } from "pg";
import { ensureOpsAuditLogTable, registerOpsAuditLog } from "@/lib/ops-audit-log";
import { getOperationalCatalogPool } from "@/lib/painel-operational-catalog";
import { CashSessionError, lockOpenCashSession, withCashSessionCommand } from "@/lib/operational-cash-session";
import { isValidCpf, sanitizeCpf } from "@/lib/cpf";
import { voucherValidityRange, type OperationalValidity } from "@/lib/operational-date";
import { processConfirmedPurchaseTickets } from "@/lib/ticket-service";

type BoxOfficeActor = { name?: string | null; cpf?: string | null };
export type BoxOfficeSaleItemInput = { type: string; quantity: number; discountId?: number | null; label?: string | null };
export type BoxOfficeSaleCourtesyInput = { authorId: number; authorizedById?: number | null; quantity: number; identification?: string | null; note?: string | null };
export type BoxOfficeSalePaymentInput = { method: string; value: string | number };
export type CashPayment = { method: string; amountCents: number };
export type CashPaymentSettlement = { totalCents: number; receivedCents: number; changeCents: number; netPayments: CashPayment[] };
export type CreateBoxOfficeSaleInput = {
  agendaId: number; periodId: number; cpf?: string | null; items?: BoxOfficeSaleItemInput[];
  services?: { serviceId: number; quantity: number }[]; courtesies?: BoxOfficeSaleCourtesyInput[];
  payments?: BoxOfficeSalePaymentInput[]; reason?: string | null; actor?: BoxOfficeActor | null; idempotencyKey: string;
};
export type BoxOfficeSaleSuccess = CashPaymentSettlement & {
  action: "create"; purchaseId: number; agendaId: number; periodId: number; totalValue: string;
  paymentMethods: string[]; voucherIds: number[]; voucherCount: number; auditLogId: number | null; warnings: string[]; message: string;
};
type AgendaRow = { idagenda: number; dtagenda: string; vlnormalbil: string | null; vlinfantbil: string | null; validity: OperationalValidity; ticketTypes: string[] };
type Discount = { id: number; nome: string | null; tipo_aplicacao: string; valor: string };
type VoucherDraft = { type: string; prefix: string; amountCents: number; discountId: number | null; description: string; identification: string | null; courtesyAuthorId: number | null; serviceId: number | null; discountCents: number };
class BoxOfficeSaleError extends Error {
  constructor(readonly code: string, message: string, readonly status: number) { super(message); this.name = "BoxOfficeSaleError"; }
}
export function asBoxOfficeSaleError(error: unknown) {
  if (error instanceof BoxOfficeSaleError || error instanceof CashSessionError) return error;
  return new BoxOfficeSaleError("box_office_sale_unavailable", "Não foi possível registrar a venda de bilheteria agora.", 502);
}
function invalid(message = "Dados da venda inválidos."): never { throw new BoxOfficeSaleError("invalid_box_office_payload", message, 400); }
function id(value: unknown, max = 2147483647): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1 || value > max) invalid("Informe identificadores válidos de agenda e caixa.");
  return value;
}
function boundedText(value: unknown, max: number): string {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string" || value.length > max || value.includes("\0")) invalid();
  return value.trim();
}
function quantity(value: unknown): number { const result = id(value); if (result > 500) invalid("A venda permite no máximo 500 unidades."); return result; }
function list<T>(value: T[] | undefined): T[] { if (value === undefined) return []; if (!Array.isArray(value) || value.length > 500 || value.some((item) => !item || typeof item !== "object")) invalid(); return value; }
export function readCashAmountCents(value: unknown): number {
  if (typeof value !== "number" && typeof value !== "string") invalid("Informe valores em reais com até duas casas decimais.");
  const raw = String(value).trim().replace(/^R\$\s*/i, "");
  if (raw.includes(",") && !/^(?:\d+|\d{1,3}(?:\.\d{3})+),\d{1,2}$/.test(raw)) invalid("Valor monetário inválido.");
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) invalid("Informe valores não negativos com até duas casas decimais.");
  const [whole, fraction = ""] = normalized.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents > 9999999999) invalid("Valor fora do intervalo permitido.");
  return cents;
}
export function cashCentsValue(cents: number): string { return (cents / 100).toFixed(2); }
export function readCashPayments(value: BoxOfficeSalePaymentInput[] | undefined): CashPayment[] {
  const payments = list(value); if (payments.length > 20) invalid("Informe até 20 pagamentos.");
  const grouped = new Map<string, number>();
  for (const item of payments) {
    if (!["dinhe", "pix", "credi", "debit"].includes(item.method)) invalid("Selecione dinheiro, Pix, crédito ou débito.");
    const cents = readCashAmountCents(item.value);
    if (cents === 0) invalid("Não informe pagamento de valor zero.");
    grouped.set(item.method, (grouped.get(item.method) ?? 0) + cents);
  }
  return [...grouped].map(([method, amountCents]) => ({ method, amountCents }));
}
export function settleCashPayments(totalCents: number, payments: CashPayment[]): CashPaymentSettlement {
  const receivedCents = payments.reduce((sum, payment) => sum + payment.amountCents, 0);
  const changeCents = receivedCents - totalCents;
  if (!Number.isSafeInteger(totalCents) || totalCents < 0 || totalCents > 9999999999 || !Number.isSafeInteger(receivedCents) || receivedCents > 9999999999) invalid("Total fora do intervalo permitido.");
  if (changeCents < 0 || changeCents > (payments.find((payment) => payment.method === "dinhe")?.amountCents ?? 0)) {
    throw new BoxOfficeSaleError("box_office_payment_mismatch", "O valor entregue deve cobrir o total; troco só pode sair do dinheiro entregue.", 409);
  }
  return { totalCents, receivedCents, changeCents, netPayments: payments.map((payment) => ({ ...payment, amountCents: payment.amountCents - (payment.method === "dinhe" ? changeCents : 0) })).filter((payment) => payment.amountCents > 0) };
}
function discountedPrice(cents: number, discount?: Discount): number {
  if (!discount) return cents;
  const value = readCashAmountCents(discount.valor);
  if (discount.tipo_aplicacao === "valor_fixo") return Math.max(0, cents - value);
  if (discount.tipo_aplicacao === "percentual") return Number((BigInt(cents) * BigInt(Math.max(0, 10000 - value)) + BigInt(5000)) / BigInt(10000));
  throw new BoxOfficeSaleError("invalid_discount_application", "Tipo de desconto inválido.", 409);
}

function voucherAlphabetCode(prefix: string) {
  const alphabet = "123456789ABCDEFGHJKMNPQRSTWXYZ";
  let code = prefix;

  for (let index = 0; index < 4; index += 1) {
    code += alphabet[randomInt(0, alphabet.length)];
  }

  return code;
}

async function generateVoucherNumbers(client: PoolClient, drafts: VoucherDraft[]) {
  const codes: string[] = [];
  const used = new Set<string>();

  while (codes.length < drafts.length) {
    const candidates = drafts
      .slice(codes.length)
      .map((draft) => voucherAlphabetCode(draft.prefix))
      .filter((code) => {
        if (used.has(code)) {
          return false;
        }

        used.add(code);
        return true;
      });

    if (candidates.length === 0) {
      continue;
    }

    const existing = await client.query<{ numvoucher: string }>(
      `
        SELECT numvoucher
        FROM voucher
        WHERE numvoucher = ANY($1::text[])
      `,
      [candidates],
    );
    const existingCodes = new Set(existing.rows.map((row) => String(row.numvoucher)));

    for (const candidate of candidates) {
      if (!existingCodes.has(candidate)) {
        codes.push(candidate);
      }

      if (codes.length === drafts.length) {
        break;
      }
    }
  }

  return codes;
}


async function insertVouchers(client: PoolClient, purchaseId: number, agendaId: number, park: string, validity: { validFrom: string; validUntil: string }, drafts: VoucherDraft[], numbers: string[]) {
  const values: (string | number | null)[] = [];
  const placeholders = drafts.map((draft, index) => {
    values.push(purchaseId, numbers[index], agendaId, draft.type, cashCentsValue(draft.amountCents), draft.discountCents > 0 ? "s" : "n", validity.validUntil,
      draft.discountId, draft.description, draft.identification, draft.courtesyAuthorId, "n", validity.validFrom, park, draft.serviceId);
    return `(${Array.from({ length: 15 }, (_, column) => `$${index * 15 + column + 1}`).join(",")})`;
  });
  return (await client.query<{ idvoucher: number }>(`INSERT INTO voucher (idcompra,numvoucher,idagenda,tpvoucher,vlunicompra,fldesconto,dtvalidade,desconto_id,descricao,identificacao,autorizado_por_id,stusado,dtinicio_validade,parque_operacional,servico_id)
    VALUES ${placeholders.join(",")} RETURNING idvoucher`, values)).rows.map((row) => row.idvoucher);
}
export async function assertCashSessionDate(client: PoolClient, date: string) {
  const current = (await client.query<{ isCurrentCashDate: boolean }>(`SELECT (clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date=$1::date AS "isCurrentCashDate"`, [date])).rows[0];
  if (!current?.isCurrentCashDate) throw new CashSessionError("cash_date_not_today", "A data do caixa terminou. Atualize a tela antes de registrar outra operação.", 409);
}
export async function insertCashPurchasePayments(client: PoolClient, purchaseId: number, periodId: number, payments: CashPayment[]) {
  if (!payments.length) return;
  const values: (string | number)[] = [];
  const placeholders = payments.map((payment, index) => {
    values.push(purchaseId, payment.method, cashCentsValue(payment.amountCents), periodId);
    const offset = index * 4; return `($${offset + 1},$${offset + 2},$${offset + 3},$${offset + 4},clock_timestamp(),(clock_timestamp() AT TIME ZONE 'America/Sao_Paulo'))`;
  });
  await client.query(`INSERT INTO compra_pagamentos (idcompra,forma_pagamento,valor,periodo_id,recebido_em,created_at) VALUES ${placeholders.join(",")}`, values);
}
export async function createOperationalBoxOfficeSale(input: CreateBoxOfficeSaleInput): Promise<BoxOfficeSaleSuccess> {
  const agendaId = id(input.agendaId); const periodId = id(input.periodId);
  if (typeof input.cpf !== "string" || !isValidCpf(input.cpf)) invalid("Informe um CPF válido para a venda.");
  const cpf = sanitizeCpf(input.cpf);
  const key = boundedText(input.idempotencyKey, 100); if (!/^[A-Za-z0-9._:-]{8,100}$/.test(key)) invalid("Informe uma chave de idempotência válida.");
  const reason = boundedText(input.reason, 1000);
  const items = list(input.items).map((item) => {
    const aliases: Record<string, string> = { adulto: "norma", normal: "norma", passaporte: "norma", crianca: "infan", infantil: "infan", "passaporte infantil": "infan", isento: "isent" };
    const type = aliases[item.type] ?? item.type;
    if (!["norma", "infan", "isent"].includes(type)) invalid("Tipo de ingresso inválido.");
    const discountId = item.discountId === null || item.discountId === undefined ? null : id(item.discountId);
    if (type === "isent" && discountId !== null) invalid("Ingresso isento não aceita desconto.");
    return { type, quantity: quantity(item.quantity), discountId, label: boundedText(item.label, 100) || (type === "norma" ? "Adulto" : type === "infan" ? "Infantil" : "Isento") };
  });
  const courtesies = list(input.courtesies).map((item) => ({ authorId: id(item.authorId ?? item.authorizedById), quantity: quantity(item.quantity), identification: boundedText(item.identification, 80), note: boundedText(item.note, 100) }));
  const services = list(input.services).map((item) => {
    if (Object.keys(item).some((key) => !["serviceId", "quantity"].includes(key))) invalid("Serviços não aceitam desconto ou cortesia.");
    return { serviceId: id(item.serviceId, Number.MAX_SAFE_INTEGER), quantity: quantity(item.quantity) };
  });
  const units = [...items, ...courtesies, ...services].reduce((total, item) => total + item.quantity, 0);
  if (units < 1 || units > 500) invalid("Selecione entre 1 e 500 unidades.");
  const payments = readCashPayments(input.payments);
  const actor = { name: boundedText(input.actor?.name, 120) || null, cpf: boundedText(input.actor?.cpf, 11) || null };
  const client = await getOperationalCatalogPool().connect(); let discard = false; let created = false; let result: BoxOfficeSaleSuccess;
  try {
    await ensureOpsAuditLogTable(client, "postgres"); await client.query("BEGIN");
    try {
      result = await withCashSessionCommand(client, { action: "sale", key, periodId, payload: { agendaId, periodId, cpf, items, courtesies, services, payments, reason } }, async () => {
        const session = await lockOpenCashSession(client, { periodId, expectedType: "sales" });
        const agenda = (await client.query<AgendaRow>(`SELECT a.idagenda,a.dtagenda::text AS dtagenda,t.vlnormalbil::text AS vlnormalbil,t.vlinfantbil::text AS vlinfantbil,d.validade AS validity,d.tipos_ingresso AS "ticketTypes"
          FROM agenda a JOIN tabpreco t ON t.idtabpreco=a.idtabpreco JOIN operacao_dias d ON d.parque=$2 AND d.data=a.dtagenda AND d.day_use_agenda_id=a.idagenda
          WHERE a.idagenda=$1 AND a.dtagenda=$3::date AND a.tpagenda IN ('padra','promo') AND a.stagenda IN ('abe','lot') FOR SHARE OF a,t`, [agendaId, session.park, session.date])).rows[0];
        if (!agenda) throw new BoxOfficeSaleError("agenda_not_found", "Agenda indisponível para venda neste caixa.", 409);
        const discountIds = [...new Set(items.flatMap((item) => item.discountId === null ? [] : [item.discountId]))];
        const discounts = discountIds.length ? (await client.query<Discount>("SELECT id,nome,tipo_aplicacao,valor::text AS valor FROM descontos WHERE id=ANY($1::int[]) FOR SHARE", [discountIds])).rows : [];
        const authorIds = [...new Set(courtesies.map((item) => item.authorId))];
        const authors = authorIds.length ? (await client.query<{ id: number; nome: string }>("SELECT id,nome FROM cortesias WHERE id=ANY($1::int[]) FOR SHARE", [authorIds])).rows : [];
        const serviceIds = [...new Set(services.map((item) => item.serviceId))];
        const catalog = serviceIds.length ? (await client.query<{ id: string; name: string; price: string }>(`SELECT s.id::text,s.nome AS name,s.preco_bilheteria::text AS price FROM servicos_adicionais s
          JOIN servico_datas sd ON sd.parque=s.parque AND sd.servico_id=s.id WHERE s.parque=$1 AND sd.data=$2::date AND s.id=ANY($3::bigint[]) AND s.ativo=TRUE FOR SHARE OF s,sd`, [session.park, session.date, serviceIds])).rows : [];
        const drafts: VoucherDraft[] = [];
        for (const item of items) {
          if (!agenda.ticketTypes.includes(item.type)) throw new BoxOfficeSaleError("ticket_type_disabled", "Este tipo de ingresso não está habilitado na data.", 409);
          const base = item.type === "isent" ? 0 : readCashAmountCents(item.type === "norma" ? agenda.vlnormalbil : agenda.vlinfantbil);
          const discount = discounts.find((entry) => entry.id === item.discountId);
          if (item.discountId !== null && !discount) throw new BoxOfficeSaleError("discount_not_found", "Desconto informado não encontrado.", 409);
          const amountCents = discountedPrice(base, discount);
          const description = `${item.label}${discount?.nome ? ` - ${discount.nome}` : ""}`;
          for (let i = 0; i < item.quantity; i++) drafts.push({ type: item.type, prefix: item.type === "infan" ? "C" : item.type === "isent" ? "I" : "A", amountCents, discountId: item.discountId, discountCents: base - amountCents, description, identification: null, courtesyAuthorId: null, serviceId: null });
        }
        for (const item of courtesies) {
          const author = authors.find((entry) => entry.id === item.authorId);
          if (!author) throw new BoxOfficeSaleError("courtesy_author_not_found", "Autorizador de cortesia não encontrado.", 409);
          const description = `Cortesia - ${author.nome}${item.identification ? ` - ${item.identification}` : ""}${item.note ? ` (${item.note})` : ""}`;
          for (let i = 0; i < item.quantity; i++) drafts.push({ type: "corte", prefix: "A", amountCents: 0, discountId: null, discountCents: 0, description, identification: item.identification || null, courtesyAuthorId: item.authorId, serviceId: null });
        }
        for (const item of services) {
          const service = catalog.find((entry) => Number(entry.id) === item.serviceId);
          if (!service) throw new BoxOfficeSaleError("service_unavailable", "Serviço indisponível para esta data ou parque.", 409);
          for (let i = 0; i < item.quantity; i++) drafts.push({ type: "espec", prefix: "S", amountCents: readCashAmountCents(service.price), discountId: null, discountCents: 0, description: service.name, identification: null, courtesyAuthorId: null, serviceId: item.serviceId });
        }
        if (drafts.some((draft) => draft.amountCents > 99999999)) throw new BoxOfficeSaleError("box_office_price_out_of_range", "O valor unitário excede o limite permitido para um voucher. Corrija o preço antes de vender.", 409);
        const settlement = settleCashPayments(drafts.reduce((sum, draft) => sum + draft.amountCents, 0), payments);
        const discountCents = drafts.reduce((sum, draft) => sum + draft.discountCents, 0);
        if (!Number.isSafeInteger(discountCents) || discountCents > 9999999999) invalid("Total de descontos fora do intervalo permitido.");
        await assertCashSessionDate(client, session.date);
        const purchaseId = (await client.query<{ idcompra: number }>(`INSERT INTO compra (cpf,tpcompra,dtcompra,hrcompra,dtpagamento,hrpagamento,formapag,vltotcompra,vltotdesc,stcompra,flenvio,caixa_periodo_id)
          VALUES ($1,'bilhe',(clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date,(clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::time,
            (clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date,(clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::time,$2,$3,$4,'conc','',$5) RETURNING idcompra`,
        [cpf, settlement.netPayments[0]?.method ?? "corte", cashCentsValue(settlement.totalCents), cashCentsValue(discountCents), periodId])).rows[0]?.idcompra;
        if (!purchaseId) throw new BoxOfficeSaleError("box_office_purchase_failed", "Não foi possível criar a compra.", 502);
        const voucherIds = await insertVouchers(client, purchaseId, agendaId, session.park, voucherValidityRange(session.date, agenda.validity), drafts, await generateVoucherNumbers(client, drafts));
        await insertCashPurchasePayments(client, purchaseId, periodId, settlement.netPayments);
        const auditLogId = await registerOpsAuditLog(client, { origem: "ops-box-office", acao: "sale_create", compraId: purchaseId, periodoId: periodId, descricao: `Venda de bilheteria #${purchaseId}.`, motivo: reason || "Venda presencial", usuarioNome: actor.name,
          detalhes: { park: session.park, date: session.date, actorCpf: actor.cpf, agendaId, periodId, ...settlement, deliveredPayments: payments, discountCents, voucherIds, idempotencyKey: key } }, "postgres");
        await assertCashSessionDate(client, session.date);
        created = true;
        return { periodId, response: { action: "create" as const, purchaseId, agendaId, periodId, totalValue: cashCentsValue(settlement.totalCents), ...settlement,
          paymentMethods: settlement.netPayments.map((payment) => payment.method), voucherIds, voucherCount: voucherIds.length, auditLogId, warnings: [], message: "Venda de bilheteria registrada com sucesso." } };
      });
      await client.query("COMMIT");
    } catch (error) { try { await client.query("ROLLBACK"); } catch { discard = true; } throw error; }
  } finally { client.release(discard); }
  if (created) await processConfirmedPurchaseTickets(result.purchaseId).catch(() => undefined);
  return result;
}
