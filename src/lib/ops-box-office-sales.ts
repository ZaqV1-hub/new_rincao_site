import { randomInt } from "node:crypto";
import type { PoolClient } from "pg";
import { getIngressoDbPool } from "@/lib/ingresso-db";
import {
  ensureOpsAuditLogTable,
  registerOpsAuditLog,
} from "@/lib/ops-audit-log";
import { getOrCreateOpenCashPeriod } from "@/lib/ops-cash-management";
import { processConfirmedPurchaseTickets } from "@/lib/ticket-service";

type BoxOfficeActor = {
  name?: string | null;
  cpf?: string | null;
};

type BoxOfficeAgendaRow = {
  idagenda: number;
  dtagenda: string | null;
  tpagenda: string | null;
  stagenda: string | null;
  vlnormalbil: string | null;
  vlinfantbil: string | null;
};

type BoxOfficeDiscountRow = {
  id: number;
  nome: string | null;
  tipo_aplicacao: string | null;
  valor: string | null;
};

type BoxOfficeCourtesyAuthorRow = {
  id: number;
  nome: string | null;
};

type PurchaseInsertRow = {
  idcompra: number;
};

type CommittedBoxOfficeSale = {
  purchaseId: number;
  agendaId: number;
  totalValue: number;
  paymentMethods: string[];
  voucherIds: number[];
  auditLogId: number | null;
  replayed: boolean;
};

type IdempotentSaleRow = {
  audit_log_id: number;
  purchase_id: number;
  total_value: string | null;
  payment_method: string | null;
  voucher_ids: number[] | string | null;
  detalhes_json: string | null;
};

export type BoxOfficeSaleItemInput = {
  type: "norma" | "infan" | "isent" | string;
  quantity: number;
  discountId?: number | null;
  label?: string | null;
};

export type BoxOfficeSaleCourtesyInput = {
  authorId: number;
  authorizedById?: number | null;
  quantity: number;
  identification?: string | null;
  note?: string | null;
};

export type BoxOfficeSalePaymentInput = {
  method: string;
  value: string | number;
};

export type CreateBoxOfficeSaleInput = {
  agendaId: number;
  cpf?: string | null;
  items?: BoxOfficeSaleItemInput[];
  purchaseDiscountId?: number | null;
  courtesies?: BoxOfficeSaleCourtesyInput[];
  payments?: BoxOfficeSalePaymentInput[];
  reason?: string | null;
  actor?: BoxOfficeActor | null;
  idempotencyKey?: string | null;
};

type NormalizedSaleItem = {
  type: "norma" | "infan" | "isent";
  label: string;
  quantity: number;
  legacyDiscountId: number | null;
};

type NormalizedCourtesy = {
  authorId: number;
  quantity: number;
  identification: string;
  note: string;
};

type NormalizedPayment = {
  method: string;
  value: number;
};

type VoucherDraft = {
  type: "norma" | "infan" | "isent" | "corte";
  prefix: string;
  value: number;
  discountId: number | null;
  discountFlag: "s" | "n";
  description: string;
  identification: string | null;
  courtesyAuthorId: number | null;
};

export type BoxOfficeSaleSuccess = {
  action: "create";
  purchaseId: number;
  agendaId: number;
  totalValue: string;
  paymentMethods: string[];
  voucherIds: number[];
  voucherCount: number;
  auditLogId: number | null;
  warnings: string[];
  message: string;
};

class BoxOfficeSaleError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "BoxOfficeSaleError";
    this.code = code;
    this.status = status;
  }
}

export function asBoxOfficeSaleError(error: unknown) {
  if (error instanceof BoxOfficeSaleError) {
    return error;
  }

  return new BoxOfficeSaleError(
    "box_office_sale_unavailable",
    "Nao foi possivel registrar a venda de bilheteria agora.",
    502,
  );
}

function normalizeText(value: string | null | undefined) {
  return String(value ?? "").trim();
}

function normalizeCpf(value: string | null | undefined) {
  const digits = String(value ?? "").replace(/\D+/g, "");
  return digits.length === 11 ? digits : null;
}

function parseMoney(value: string | number | null | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const raw = String(value ?? "").trim().replace(/^R\$\s*/i, "");
  const normalized =
    raw.includes(",") && raw.includes(".")
      ? raw.replace(/\./g, "").replace(",", ".")
      : raw.includes(",")
        ? raw.replace(",", ".")
        : raw;
  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : null;
}

function money(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatMoney(value: number) {
  return money(value).toFixed(2);
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function resolveVoucherValidityDate(agenda: BoxOfficeAgendaRow, now = new Date()) {
  if (String(agenda.tpagenda ?? "").trim() === "promo" && agenda.dtagenda) {
    return String(agenda.dtagenda).slice(0, 10);
  }

  return addMonths(now, 6).toISOString().slice(0, 10);
}

function normalizeItemType(value: string) {
  const normalized = normalizeText(value);

  if (
    normalized === "norma" ||
    normalized === "adulto" ||
    normalized === "normal" ||
    normalized === "passaporte"
  ) {
    return "norma";
  }

  if (
    normalized === "infan" ||
    normalized === "crianca" ||
    normalized === "infantil" ||
    normalized === "passaporte infantil"
  ) {
    return "infan";
  }

  if (normalized === "isent" || normalized === "isento") {
    return "isent";
  }

  return null;
}

function labelForItemType(type: NormalizedSaleItem["type"]) {
  if (type === "norma") {
    return "Passaporte";
  }

  if (type === "infan") {
    return "Passaporte Infantil";
  }

  return "Isento";
}

function prefixForVoucherType(type: VoucherDraft["type"]) {
  if (type === "infan") {
    return "C";
  }

  if (type === "isent") {
    return "I";
  }

  return "A";
}

function normalizeItems(items: BoxOfficeSaleItemInput[] | undefined) {
  return (items ?? []).flatMap<NormalizedSaleItem>((item) => {
    const type = normalizeItemType(String(item.type ?? ""));
    const quantity = Number(item.quantity);
    const label = normalizeText(item.label);

    if (!type || !Number.isInteger(quantity) || quantity <= 0) {
      return [];
    }

    return [
      {
        type,
        label: label || labelForItemType(type),
        quantity,
        legacyDiscountId:
          Number.isInteger(Number(item.discountId)) && Number(item.discountId) > 0
            ? Number(item.discountId)
            : null,
      },
    ];
  });
}

function normalizeCourtesies(courtesies: BoxOfficeSaleCourtesyInput[] | undefined) {
  return (courtesies ?? []).flatMap<NormalizedCourtesy>((courtesy) => {
    const authorId = Number(courtesy.authorId ?? courtesy.authorizedById);
    const quantity = Number(courtesy.quantity);

    if (!Number.isInteger(authorId) || authorId <= 0 || !Number.isInteger(quantity) || quantity <= 0) {
      return [];
    }

    return [
      {
        authorId,
        quantity,
        identification: normalizeText(courtesy.identification),
        note: normalizeText(courtesy.note),
      },
    ];
  });
}

function normalizePayments(payments: BoxOfficeSalePaymentInput[] | undefined) {
  return (payments ?? []).flatMap<NormalizedPayment>((payment) => {
    const method = normalizeText(payment.method);
    const value = parseMoney(payment.value);

    if (!method || value === null || value <= 0) {
      return [];
    }

    return [
      {
        method,
        value: money(value),
      },
    ];
  });
}

function actorName(actor: BoxOfficeActor | null | undefined) {
  return normalizeText(actor?.name) || normalizeText(actor?.cpf) || null;
}

function normalizeIdempotencyKey(value: string | null | undefined) {
  const key = normalizeText(value);

  if (!key) {
    return null;
  }

  if (!/^[A-Za-z0-9._:-]{8,120}$/.test(key)) {
    throw new BoxOfficeSaleError(
      "invalid_box_office_idempotency_key",
      "Chave de idempotencia invalida para venda de bilheteria.",
      400,
    );
  }

  return key;
}

function parseAuditDetails(value: string | null) {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function normalizeVoucherIds(value: IdempotentSaleRow["voucher_ids"]) {
  if (Array.isArray(value)) {
    return value.map(Number).filter((id) => Number.isInteger(id) && id > 0);
  }

  return String(value ?? "")
    .replace(/[{}]/g, "")
    .split(",")
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0);
}

async function lockIdempotencyKey(client: PoolClient, idempotencyKey: string) {
  await client.query("SELECT pg_advisory_xact_lock(hashtext($1)::bigint)", [
    `ops-box-office-sale:${idempotencyKey}`,
  ]);
}

async function findIdempotentSale(
  client: PoolClient,
  idempotencyKey: string,
  fallbackAgendaId: number,
) {
  const result = await client.query<IdempotentSaleRow>(
    `
      SELECT
        edicoes_log.id AS audit_log_id,
        edicoes_log.compra_id AS purchase_id,
        compra.vltotcompra::text AS total_value,
        compra.formapag AS payment_method,
        NULLIF(edicoes_log.detalhes_json, '') AS detalhes_json,
        COALESCE(
          array_agg(voucher.idvoucher ORDER BY voucher.idvoucher)
            FILTER (WHERE voucher.idvoucher IS NOT NULL),
          '{}'::integer[]
        ) AS voucher_ids
      FROM edicoes_log
      JOIN compra ON compra.idcompra = edicoes_log.compra_id
      LEFT JOIN voucher ON voucher.idcompra = compra.idcompra
      WHERE edicoes_log.origem = 'ops-box-office'
        AND edicoes_log.acao = 'sale_create'
        AND NULLIF(edicoes_log.detalhes_json, '')::jsonb ->> 'idempotencyKey' = $1
      GROUP BY
        edicoes_log.id,
        edicoes_log.compra_id,
        compra.vltotcompra,
        compra.formapag,
        edicoes_log.detalhes_json
      ORDER BY edicoes_log.id DESC
      LIMIT 1
    `,
    [idempotencyKey],
  );
  const row = result.rows[0];

  if (!row?.purchase_id) {
    return null;
  }

  const details = parseAuditDetails(row.detalhes_json);
  const paymentMethods = Array.isArray(details.paymentMethods)
    ? details.paymentMethods.map(String).filter(Boolean)
    : row.payment_method
      ? [row.payment_method]
      : [];

  return {
    purchaseId: row.purchase_id,
    agendaId:
      Number.isInteger(Number(details.agendaId)) && Number(details.agendaId) > 0
        ? Number(details.agendaId)
        : fallbackAgendaId,
    totalValue: parseMoney(row.total_value) ?? 0,
    paymentMethods,
    voucherIds: normalizeVoucherIds(row.voucher_ids),
    auditLogId: row.audit_log_id,
    replayed: true,
  } satisfies CommittedBoxOfficeSale;
}

async function loadAgenda(client: PoolClient, agendaId: number) {
  const result = await client.query<BoxOfficeAgendaRow>(
    `
      SELECT
        agenda.idagenda,
        agenda.dtagenda::text AS dtagenda,
        agenda.tpagenda,
        agenda.stagenda,
        tabpreco.vlnormalbil::text AS vlnormalbil,
        tabpreco.vlinfantbil::text AS vlinfantbil
      FROM agenda
      JOIN tabpreco ON tabpreco.idtabpreco = agenda.idtabpreco
      WHERE agenda.idagenda = $1
        AND agenda.tpagenda IN ('padra', 'promo')
        AND agenda.stagenda IN ('abe', 'lot')
      LIMIT 1
    `,
    [agendaId],
  );

  return result.rows[0] ?? null;
}

async function loadDiscounts(client: PoolClient, discountIds: number[]) {
  if (discountIds.length === 0) {
    return new Map<number, BoxOfficeDiscountRow>();
  }

  const result = await client.query<BoxOfficeDiscountRow>(
    `
      SELECT
        descontos.id,
        descontos.nome,
        descontos.tipo_aplicacao,
        descontos.valor::text AS valor
      FROM descontos
      WHERE descontos.id = ANY($1::int[])
    `,
    [discountIds],
  );

  return new Map(result.rows.map((row) => [row.id, row]));
}

async function loadCourtesyAuthors(client: PoolClient, authorIds: number[]) {
  if (authorIds.length === 0) {
    return new Map<number, BoxOfficeCourtesyAuthorRow>();
  }

  const result = await client.query<BoxOfficeCourtesyAuthorRow>(
    `
      SELECT
        cortesias.id,
        cortesias.nome
      FROM cortesias
      WHERE cortesias.id = ANY($1::int[])
    `,
    [authorIds],
  );

  return new Map(result.rows.map((row) => [row.id, row]));
}

function calculateDiscountedUnitPrice(
  totalValue: number,
  discount: BoxOfficeDiscountRow | null,
) {
  if (!discount) {
    return totalValue;
  }

  const discountValue = parseMoney(discount.valor) ?? 0;
  const applicationType = normalizeText(discount.tipo_aplicacao);

  if (applicationType === "percentual") {
    return Math.max(0, money(totalValue - totalValue * (discountValue / 100)));
  }

  if (applicationType === "valor_fixo") {
    return Math.max(0, money(totalValue - Math.min(totalValue, discountValue)));
  }

  throw new BoxOfficeSaleError(
    "invalid_discount_application",
    "Tipo de aplicacao de desconto invalido.",
    409,
  );
}

function buildPaidVoucherDrafts(
  agenda: BoxOfficeAgendaRow,
  items: NormalizedSaleItem[],
  discounts: Map<number, BoxOfficeDiscountRow>,
  applyLegacyItemDiscounts: boolean,
) {
  const normalPrice = parseMoney(agenda.vlnormalbil);
  const childPrice = parseMoney(agenda.vlinfantbil);

  if (normalPrice === null || childPrice === null) {
    throw new BoxOfficeSaleError(
      "box_office_pricing_unavailable",
      "Tabela de preco da bilheteria indisponivel para esta data.",
      409,
    );
  }

  const drafts: VoucherDraft[] = [];

  for (const item of items) {
    const basePrice =
      item.type === "norma" ? normalPrice : item.type === "infan" ? childPrice : 0;
    const discount =
      applyLegacyItemDiscounts && item.legacyDiscountId
        ? discounts.get(item.legacyDiscountId) ?? null
        : null;

    if (applyLegacyItemDiscounts && item.legacyDiscountId && !discount) {
      throw new BoxOfficeSaleError(
        "discount_not_found",
        "Desconto informado nao foi encontrado.",
        404,
      );
    }

    if (item.type === "isent" && discount) {
      throw new BoxOfficeSaleError(
        "invalid_discount_for_exempt",
        "Ingresso isento nao aceita desconto.",
        400,
      );
    }

    const unitPrice =
      item.type === "isent" ? 0 : calculateDiscountedUnitPrice(basePrice, discount);
    const description = discount?.nome
      ? `${item.label} - ${normalizeText(discount.nome)}`
      : item.type === "isent"
        ? "Isento"
        : item.label;

    for (let index = 0; index < item.quantity; index += 1) {
      drafts.push({
        type: item.type,
        prefix: prefixForVoucherType(item.type),
        value: unitPrice,
        discountId: discount?.id ?? null,
        discountFlag: discount ? "s" : "n",
        description,
        identification: null,
        courtesyAuthorId: null,
      });
    }
  }

  return drafts;
}

function applyPurchaseDiscountToDrafts(
  drafts: VoucherDraft[],
  discount: BoxOfficeDiscountRow | null,
) {
  if (!discount) {
    return {
      drafts,
      totalDiscount: 0,
    };
  }

  const subtotal = money(drafts.reduce((total, draft) => total + draft.value, 0));

  if (subtotal <= 0) {
    return {
      drafts,
      totalDiscount: 0,
    };
  }

  const discountedTotal = calculateDiscountedUnitPrice(subtotal, discount);
  const totalDiscount = money(subtotal - discountedTotal);

  if (totalDiscount <= 0) {
    return {
      drafts,
      totalDiscount: 0,
    };
  }

  const nextDrafts = drafts.map((draft) => ({ ...draft }));
  let remainingDiscount = totalDiscount;
  let remainingBase = subtotal;

  for (let index = 0; index < nextDrafts.length; index += 1) {
    const draft = nextDrafts[index];

    if (index === nextDrafts.length - 1) {
      draft.value = money(Math.max(0, draft.value - remainingDiscount));
      draft.discountFlag = remainingDiscount > 0 ? "s" : "n";
      break;
    }

    const proportionalDiscount = money(
      remainingBase > 0 ? (remainingDiscount * draft.value) / remainingBase : 0,
    );
    const appliedDiscount = Math.min(draft.value, proportionalDiscount);

    draft.value = money(Math.max(0, draft.value - appliedDiscount));
    draft.discountFlag = appliedDiscount > 0 ? "s" : "n";
    remainingDiscount = money(remainingDiscount - appliedDiscount);
    remainingBase = money(remainingBase - (draft.value + appliedDiscount));
  }

  return {
    drafts: nextDrafts,
    totalDiscount,
  };
}

function buildCourtesyVoucherDrafts(
  courtesies: NormalizedCourtesy[],
  authors: Map<number, BoxOfficeCourtesyAuthorRow>,
) {
  const drafts: VoucherDraft[] = [];

  for (const courtesy of courtesies) {
    const author = authors.get(courtesy.authorId);

    if (!author) {
      throw new BoxOfficeSaleError(
        "courtesy_author_not_found",
        "Autorizador de cortesia nao encontrado.",
        404,
      );
    }

    let description = `Cortesia - ${normalizeText(author.nome) || "Autorizador"}`;

    if (courtesy.identification) {
      description += ` - ${courtesy.identification}`;
    }

    if (courtesy.note) {
      description += ` (${courtesy.note})`;
    }

    for (let index = 0; index < courtesy.quantity; index += 1) {
      drafts.push({
        type: "corte",
        prefix: "A",
        value: 0,
        discountId: null,
        discountFlag: "n",
        description,
        identification: courtesy.identification || null,
        courtesyAuthorId: courtesy.authorId,
      });
    }
  }

  return drafts;
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

async function insertVouchers(
  client: PoolClient,
  purchaseId: number,
  agendaId: number,
  validityDate: string,
  drafts: VoucherDraft[],
  voucherNumbers: string[],
) {
  if (drafts.length === 0) {
    return [];
  }

  const values: Array<string | number | null> = [];
  const placeholders = drafts.map((draft, index) => {
    const offset = index * 12;

    values.push(
      purchaseId,
      voucherNumbers[index],
      agendaId,
      draft.type,
      formatMoney(draft.value),
      draft.discountFlag,
      validityDate,
      draft.discountId,
      draft.description,
      draft.identification,
      draft.courtesyAuthorId,
      "n",
    );

    return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11}, $${offset + 12})`;
  });

  const result = await client.query<{ idvoucher: number }>(
    `
      INSERT INTO voucher (
        idcompra,
        numvoucher,
        idagenda,
        tpvoucher,
        vlunicompra,
        fldesconto,
        dtvalidade,
        desconto_id,
        descricao,
        identificacao,
        autorizado_por_id,
        stusado
      ) VALUES ${placeholders.join(", ")}
      RETURNING idvoucher
    `,
    values,
  );

  return result.rows.map((row) => row.idvoucher);
}

async function insertPayments(
  client: PoolClient,
  purchaseId: number,
  payments: NormalizedPayment[],
) {
  if (payments.length === 0) {
    return;
  }

  const values: Array<string | number> = [];
  const placeholders = payments.map((payment, index) => {
    const offset = index * 3;

    values.push(purchaseId, payment.method, formatMoney(payment.value));

    return `($${offset + 1}, $${offset + 2}, $${offset + 3}, CURRENT_TIMESTAMP)`;
  });

  await client.query(
    `
      INSERT INTO compra_pagamentos (
        idcompra,
        forma_pagamento,
        valor,
        created_at
      ) VALUES ${placeholders.join(", ")}
    `,
    values,
  );
}

export async function createOperationalBoxOfficeSale(
  input: CreateBoxOfficeSaleInput,
): Promise<BoxOfficeSaleSuccess> {
  const agendaId = Number(input.agendaId);

  if (!Number.isInteger(agendaId) || agendaId <= 0) {
    throw new BoxOfficeSaleError(
      "invalid_box_office_payload",
      "Informe uma agenda valida para a venda de bilheteria.",
      400,
    );
  }

  const items = normalizeItems(input.items);
  const courtesies = normalizeCourtesies(input.courtesies);
  const payments = normalizePayments(input.payments);
  const idempotencyKey = normalizeIdempotencyKey(input.idempotencyKey);

  if (items.length === 0 && courtesies.length === 0) {
    throw new BoxOfficeSaleError(
      "invalid_box_office_payload",
      "Informe ao menos um ingresso ou cortesia.",
      400,
    );
  }

  const pool = getIngressoDbPool();
  const client = await pool.connect();
  let committedSale: CommittedBoxOfficeSale | null = null;

  try {
    await client.query("BEGIN");

    if (idempotencyKey) {
      await ensureOpsAuditLogTable(client);
      await lockIdempotencyKey(client, idempotencyKey);
      committedSale = await findIdempotentSale(
        client,
        idempotencyKey,
        agendaId,
      );
    }

    if (!committedSale) {
    const cashPeriod = await getOrCreateOpenCashPeriod(client);

    const agenda = await loadAgenda(client, agendaId);

    if (!agenda) {
      throw new BoxOfficeSaleError(
        "agenda_not_found",
        "Agenda indisponivel para venda de bilheteria.",
        404,
      );
    }

    const explicitPurchaseDiscountId =
      Number.isInteger(Number(input.purchaseDiscountId)) && Number(input.purchaseDiscountId) > 0
        ? Number(input.purchaseDiscountId)
        : null;
    const legacyDiscountIds = Array.from(
      new Set(items.map((item) => item.legacyDiscountId).filter((id): id is number => id !== null)),
    );
    const discountIds = explicitPurchaseDiscountId
      ? [explicitPurchaseDiscountId]
      : legacyDiscountIds;
    const courtesyAuthorIds = Array.from(
      new Set(courtesies.map((courtesy) => courtesy.authorId)),
    );
    const discounts = await loadDiscounts(client, discountIds);
    const courtesyAuthors = await loadCourtesyAuthors(client, courtesyAuthorIds);
    const purchaseDiscount =
      explicitPurchaseDiscountId && discountIds.length > 0
        ? discounts.get(discountIds[0]) ?? null
        : null;

    if (explicitPurchaseDiscountId && !purchaseDiscount) {
      throw new BoxOfficeSaleError(
        "discount_not_found",
        "Desconto informado nao foi encontrado.",
        404,
      );
    }

    const basePaidDrafts = buildPaidVoucherDrafts(
      agenda,
      items,
      discounts,
      explicitPurchaseDiscountId === null,
    );
    const { drafts: paidDrafts, totalDiscount } = explicitPurchaseDiscountId
      ? applyPurchaseDiscountToDrafts(basePaidDrafts, purchaseDiscount)
      : {
          drafts: basePaidDrafts,
          totalDiscount: 0,
        };
    const courtesyDrafts = buildCourtesyVoucherDrafts(courtesies, courtesyAuthors);
    const voucherDrafts = [...paidDrafts, ...courtesyDrafts];
    const totalValue = money(paidDrafts.reduce((total, draft) => total + draft.value, 0));
    const paymentTotal = money(payments.reduce((total, payment) => total + payment.value, 0));

    if (totalValue > 0 && payments.length === 0) {
      throw new BoxOfficeSaleError(
        "box_office_payment_required",
        "Informe pagamento para venda com valor maior que zero.",
        400,
      );
    }

    if (Math.abs(totalValue - paymentTotal) > 0.01) {
      throw new BoxOfficeSaleError(
        "box_office_payment_mismatch",
        "Total dos pagamentos nao confere com o total da venda.",
        409,
      );
    }

    const purchase = totalDiscount > 0
      ? await client.query<PurchaseInsertRow>(
          `
            INSERT INTO compra (
              cpf,
              tpcompra,
              dtcompra,
              hrcompra,
              formapag,
              vltotcompra,
              vltotdesc,
              stcompra,
              flenvio
            ) VALUES ($1, 'bilhe', CURRENT_DATE, CURRENT_TIME, $2, $3, $4, 'conc', '')
            RETURNING idcompra
          `,
          [
            normalizeCpf(input.cpf),
            payments[0]?.method ?? "corte",
            formatMoney(totalValue),
            formatMoney(totalDiscount),
          ],
        )
      : await client.query<PurchaseInsertRow>(
          `
            INSERT INTO compra (
              cpf,
              tpcompra,
              dtcompra,
              hrcompra,
              formapag,
              vltotcompra,
              stcompra,
              flenvio
            ) VALUES ($1, 'bilhe', CURRENT_DATE, CURRENT_TIME, $2, $3, 'conc', '')
            RETURNING idcompra
          `,
          [
            normalizeCpf(input.cpf),
            payments[0]?.method ?? "corte",
            formatMoney(totalValue),
          ],
        );
    const purchaseId = purchase.rows[0]?.idcompra;

    if (!purchaseId) {
      throw new BoxOfficeSaleError(
        "box_office_purchase_failed",
        "Nao foi possivel criar a compra de bilheteria.",
        502,
      );
    }

    const voucherNumbers = await generateVoucherNumbers(client, voucherDrafts);
    const voucherIds = await insertVouchers(
      client,
      purchaseId,
      agendaId,
      resolveVoucherValidityDate(agenda),
      voucherDrafts,
      voucherNumbers,
    );

    await insertPayments(client, purchaseId, payments);

    const auditLogId = await registerOpsAuditLog(client, {
      origem: "ops-box-office",
      acao: "sale_create",
      compraId: purchaseId,
      periodoId: cashPeriod.id,
      descricao: `Venda de bilheteria #${purchaseId} registrada no BFF.`,
      motivo: normalizeText(input.reason) || "Venda presencial registrada no BFF",
      usuarioNome: actorName(input.actor),
      detalhes: {
        agendaId,
        totalValue: formatMoney(totalValue),
        paymentMethods: payments.map((payment) => payment.method),
        voucherCount: voucherIds.length,
        voucherIds,
        discountIds,
        purchaseDiscountName: normalizeText(purchaseDiscount?.nome),
        totalDiscount: totalDiscount > 0 ? formatMoney(totalDiscount) : "0.00",
        courtesyAuthorIds,
        idempotencyKey,
      },
    });

    await client.query("COMMIT");
    committedSale = {
      purchaseId,
      agendaId,
      totalValue,
      paymentMethods: payments.map((payment) => payment.method),
      voucherIds,
      auditLogId,
      replayed: false,
    };
    } else {
      await client.query("COMMIT");
    }
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }

  const warnings: string[] = [];

  if (committedSale.replayed) {
    warnings.push("idempotent_replay");
  }

  try {
    const ticketResult = await processConfirmedPurchaseTickets(
      committedSale.purchaseId,
    );

    if (ticketResult.status === "skipped") {
      warnings.push(ticketResult.skippedReason ?? "ticket_service_skipped");
    }
  } catch {
    warnings.push("ticket_service_failed");
  }

  return {
    action: "create",
    purchaseId: committedSale.purchaseId,
    agendaId: committedSale.agendaId,
    totalValue: formatMoney(committedSale.totalValue),
    paymentMethods: committedSale.paymentMethods,
    voucherIds: committedSale.voucherIds,
    voucherCount: committedSale.voucherIds.length,
    auditLogId: committedSale.auditLogId,
    warnings,
    message: "Venda de bilheteria registrada com sucesso.",
  };
}
