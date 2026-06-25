import { getIngressoDbPool } from "@/lib/ingresso-db";
import { getNativeCieloCheckoutStatus, isCieloEcommerceConfigured } from "@/lib/cielo-ecommerce";
import { registerOpsAuditLog } from "@/lib/ops-audit-log";
import { queuePurchaseConfirmationEmail } from "@/lib/purchase-confirmation-email";
import { sendPurchaseTicketsWhatsApp } from "@/lib/ticket-service";
import { mapCheckoutStatusPayload } from "@/lib/checkout-status";
import {
  generateVoucherQrcodes,
  TicketApiError,
} from "@/lib/ticket-api";

type BilheteriaActor = {
  name?: string | null;
  cpf?: string | null;
};

type PurchaseHistoryRow = {
  idcompra: number;
  dtcompra: string | null;
  cpf: string | null;
  formapag: string | null;
  tpcompra: string | null;
  stcompra: string | null;
  dtpagamento: string | null;
  total_venda: string | null;
  total_venda_cancelada: string | null;
};

type PurchasePaymentMethodRow = {
  idcompra: number;
  forma: string | null;
};

type PurchaseDetailRow = {
  idcompra: number;
  dtcompra: string | null;
  cpf: string | null;
  tpcompra: string | null;
  stcompra: string | null;
  formapag: string | null;
  vltotcompra: string | null;
  dtpagamento: string | null;
  hrpagamento: string | null;
};

type PurchaseVoucherRow = {
  idvoucher: number;
  idcompra?: number | null;
  idagenda?: number | null;
  numvoucher: string | null;
  tpvoucher: string | null;
  stusado: string | null;
  dtuso?: string | null;
  vlunicompra: string | null;
  desconto_id: number | null;
  descricao: string | null;
  agenda_data: string | null;
  dtvalidade: string | null;
  cpf?: string | null;
  tpcompra?: string | null;
  dtcompra?: string | null;
};

type PurchasePaymentRow = {
  forma_pagamento: string | null;
  valor: string | null;
};

type PurchaseGatewayLedgerRow = {
  payment_id: string | null;
  reference: string | null;
  gateway_status: string | null;
  date: string | null;
  last_event_date: string | null;
};

type PurchaseDiscountRow = {
  id: number;
  nome: string | null;
  tipo_aplicacao: string | null;
  valor: string | null;
  tipo_desc: string | null;
};

export type PainelBilheteriaIndicators = {
  date: string;
  plannedReservations: number;
  plannedOnlinePurchases: number;
  plannedTotal: number;
  confirmedEntries: number;
  walkInEntries: number;
  totalEntries: number;
};

export type PainelBilheteriaHistoryFilters = {
  purchaseId?: string | null;
  cpf?: string | null;
  value?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  type?: "bilhe" | "reser" | null;
};

export type PainelBilheteriaHistoryItem = {
  purchaseId: number;
  purchaseDate: string | null;
  cpf: string | null;
  type: string;
  typeLabel: string;
  status: string;
  statusLabel: string;
  totalValue: string;
  paymentCodes: string[];
  paymentLabels: string[];
  paidAt: string | null;
};

export type PainelBilheteriaHistoryPage = {
  items: PainelBilheteriaHistoryItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  filters: Required<PainelBilheteriaHistoryFilters>;
};

export type PainelBilheteriaPurchaseVoucher = {
  voucherId: number;
  voucherNumber: string | null;
  voucherType: string | null;
  voucherTypeLabel: string;
  baseVoucherTypeLabel: string;
  status: string;
  statusLabel: string;
  unitValue: string;
  baseUnitValue: string;
  discountId: number | null;
  discountEditable: boolean;
  description: string | null;
  visitDate: string | null;
};

export type PainelBilheteriaDiscountOption = {
  id: number;
  name: string;
  applicationType: string | null;
  value: string;
  typeDescription: string | null;
};

export type PainelBilheteriaPurchasePayment = {
  method: string;
  methodLabel: string;
  value: string;
};

export type PainelBilheteriaPurchaseDetail = {
  purchaseId: number;
  purchaseDate: string | null;
  cpf: string | null;
  type: string;
  typeLabel: string;
  status: string;
  statusLabel: string;
  paymentMethod: string | null;
  paymentMethodLabel: string | null;
  totalValue: string;
  paidAt: string | null;
  vouchers: PainelBilheteriaPurchaseVoucher[];
  payments: PainelBilheteriaPurchasePayment[];
  discountOptions: PainelBilheteriaDiscountOption[];
  payableReservation: boolean;
};

export type PainelBilheteriaPaymentMethodOption = {
  value: string;
  label: string;
};

export type PayPainelReservationInput = {
  purchaseId: number;
  payments: Array<{
    method: string;
    value: string | number;
  }>;
  actor?: BilheteriaActor | null;
};

export type SendPainelBilheteriaVoucherWhatsappInput = {
  purchaseId: number;
  voucherId: number;
  phoneNumber: string;
  actor?: BilheteriaActor | null;
};

export type PayPainelReservationSuccess = {
  purchaseId: number;
  status: "conc";
  totalValue: string;
  paymentMethods: string[];
  message: string;
  alreadyPaid: boolean;
  auditLogId: number | null;
};

export type PainelBilheteriaGatewayStatus = {
  purchaseId: number;
  configured: boolean;
  paymentId: string | null;
  reference: string | null;
  ledgerStatus: number | null;
  ledgerStatusLabel: string;
  ledgerUpdatedAt: string | null;
  consultResult: "ok" | "not_found" | "not_configured" | "no_transaction";
  gatewayStatus: number | null;
  gatewayStatusLabel: string;
  purchaseStatus: "conc" | "pend" | "canc" | "unknown" | null;
  message: string;
};

export type PainelBilheteriaVoucherPrintModel = {
  purchaseId: number;
  voucherId: number;
  voucherCode: string;
  voucherNumber: string | null;
  cpf: string | null;
  type: string | null;
  typeLabel: string;
  description: string | null;
  purchaseLocation: string;
  purchaseDate: string | null;
  price: string;
  tpcompra: string | null;
  visitDate: string | null;
  validUntil: string;
  qrCodeUrl: string | null;
};

export type PainelBilheteriaPurchasePrintModel = {
  purchaseId: number;
  vouchers: PainelBilheteriaVoucherPrintModel[];
};

export type SendPainelBilheteriaVoucherWhatsappSuccess = {
  purchaseId: number;
  voucherId: number;
  phoneNumber: string;
  validUntil: string;
  message: string;
  auditLogId: number | null;
};

export class PainelBilheteriaError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "PainelBilheteriaError";
    this.code = code;
    this.status = status;
  }
}

const paymentMethodLabels: Record<string, string> = {
  dinhe: "Dinheiro",
  debit: "Debito",
  credi: "Credito",
  chequ: "Cheque",
  tranb: "Trans. Bancaria",
  corte: "Cortesia",
  pix: "Pix",
  pgseg: "Pagamento Online",
};

const purchaseStatusLabels: Record<string, string> = {
  pend: "Em processamento",
  conc: "Concluida",
  canc: "Cancelada",
};

const purchaseTypeLabels: Record<string, string> = {
  bilhe: "Bilheteria",
  reser: "Reserva",
  ponli: "Pagamento Online",
};

const voucherTypeLabels: Record<string, string> = {
  norma: "Passaporte",
  infan: "Passaporte Infantil",
  isent: "Isento",
  corte: "Cortesia",
  escol: "Escola",
};

const voucherStatusLabels: Record<string, string> = {
  n: "Nao usado",
  s: "Usado",
  inv: "Invalidado",
};

const gatewayStatusLabels: Record<number, string> = {
  1: "Aguardando pagamento",
  2: "Em analise",
  3: "Pago",
  4: "Disponivel",
  5: "Em disputa",
  6: "Devolvido",
  7: "Cancelado",
  8: "Chargeback debitado",
  9: "Em contestacao",
  12: "Pendente",
};

function normalizeCpf(value: string | null | undefined) {
  const digits = String(value ?? "").replace(/\D+/g, "");
  return digits.length === 11 ? digits : null;
}

function normalizePurchaseId(value: string | number | null | undefined) {
  const digits = String(value ?? "").replace(/\D+/g, "");
  return digits ? digits : "";
}

function getSaoPauloToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
}

function parseDateInput(value: string | null | undefined) {
  const trimmed = String(value ?? "").trim();

  if (!trimmed) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const match = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (!match) {
    return null;
  }

  return `${match[3]}-${match[2]}-${match[1]}`;
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

  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : null;
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatMoney(value: string | number | null | undefined) {
  const numeric =
    typeof value === "number" ? value : value != null ? Number(value) : null;

  if (numeric == null || !Number.isFinite(numeric)) {
    return "0.00";
  }

  return roundMoney(numeric).toFixed(2);
}

function formatDateTime(date: string | null | undefined, time?: string | null | undefined) {
  const dateValue = String(date ?? "").slice(0, 10);

  if (!dateValue) {
    return null;
  }

  return time ? `${dateValue} ${String(time).slice(0, 8)}` : dateValue;
}

function formatPaymentMethodLabel(code: string | null | undefined) {
  const normalized = String(code ?? "").trim();
  return normalized ? paymentMethodLabels[normalized] ?? normalized : "-";
}

function formatPurchaseStatusLabel(code: string | null | undefined) {
  const normalized = String(code ?? "").trim();
  return normalized ? purchaseStatusLabels[normalized] ?? normalized : "-";
}

function formatPurchaseTypeLabel(code: string | null | undefined) {
  const normalized = String(code ?? "").trim();
  return normalized ? purchaseTypeLabels[normalized] ?? normalized : "-";
}

function formatVoucherTypeLabel(code: string | null | undefined) {
  const normalized = String(code ?? "").trim();
  return normalized ? voucherTypeLabels[normalized] ?? normalized : "-";
}

function resolveVoucherDisplayLabel(
  voucher: Pick<PurchaseVoucherRow, "descricao" | "tpvoucher">,
) {
  const description = String(voucher.descricao ?? "").trim();
  return description || formatVoucherTypeLabel(voucher.tpvoucher);
}

function formatVoucherStatusLabel(code: string | null | undefined) {
  const normalized = String(code ?? "").trim();
  return normalized ? voucherStatusLabels[normalized] ?? normalized : "-";
}

function formatGatewayStatusLabel(status: number | null | undefined) {
  if (!Number.isInteger(status)) {
    return "Indisponivel";
  }

  return gatewayStatusLabels[Number(status)] ?? String(status);
}

function isVoucherDiscountEditable(code: string | null | undefined) {
  const normalized = String(code ?? "").trim();
  return normalized === "norma" || normalized === "infan";
}

function resolveVoucherBaseValue(
  voucher: Pick<PurchaseVoucherRow, "vlunicompra" | "tpvoucher" | "desconto_id">,
  discounts: Map<number, PainelBilheteriaDiscountOption>,
) {
  const currentValue = Number(voucher.vlunicompra ?? 0);
  const discountId =
    voucher.desconto_id && Number(voucher.desconto_id) > 0
      ? Number(voucher.desconto_id)
      : null;

  if (!isVoucherDiscountEditable(voucher.tpvoucher) || !discountId) {
    return roundMoney(currentValue);
  }

  const discount = discounts.get(discountId);

  if (!discount) {
    return roundMoney(currentValue);
  }

  const discountValue = Number(discount.value ?? 0);

  if (discount.applicationType === "percentual") {
    const factor = 1 - discountValue / 100;
    return factor > 0.0001 ? roundMoney(currentValue / factor) : roundMoney(currentValue);
  }

  if (discount.applicationType === "valor_fixo") {
    return roundMoney(currentValue + discountValue);
  }

  return roundMoney(currentValue);
}

function normalizeFilters(input: PainelBilheteriaHistoryFilters | null | undefined) {
  return {
    purchaseId: normalizePurchaseId(input?.purchaseId),
    cpf: normalizeCpf(input?.cpf ?? "") ?? "",
    value: String(input?.value ?? "").trim(),
    dateFrom: parseDateInput(input?.dateFrom ?? "") ?? "",
    dateTo: parseDateInput(input?.dateTo ?? "") ?? "",
    type:
      input?.type === "bilhe" || input?.type === "reser"
        ? input.type
        : null,
  };
}

function buildHistoryConditions(filters: Required<PainelBilheteriaHistoryFilters>) {
  const conditions = ["c.tpcompra IN ('bilhe','reser')"];
  const params: Array<string | number> = [];

  if (filters.type) {
    params.push(filters.type);
    conditions.push(`c.tpcompra = $${params.length}`);
  }

  if (filters.purchaseId) {
    params.push(Number(filters.purchaseId));
    conditions.push(`c.idcompra = $${params.length}`);
  }

  if (filters.cpf) {
    params.push(filters.cpf);
    conditions.push(`c.cpf = $${params.length}`);
  }

  if (filters.dateFrom) {
    params.push(filters.dateFrom);
    conditions.push(`c.dtcompra >= $${params.length}::date`);
  }

  if (filters.dateTo) {
    params.push(filters.dateTo);
    conditions.push(`c.dtcompra <= $${params.length}::date`);
  }

  return {
    conditions,
    params,
    valueFilter: parseMoney(filters.value),
  };
}

function mapPaymentCodes(
  purchase: PurchaseHistoryRow,
  codes: string[] | undefined,
  totalValue: string,
) {
  if (codes && codes.length > 0) {
    return codes;
  }

  const fallback = String(purchase.formapag ?? "").trim();

  if (fallback && fallback.toUpperCase() !== "N/A") {
    return [fallback];
  }

  if (Number(totalValue) === 0) {
    return ["corte"];
  }

  return [];
}

export function getPainelBilheteriaPaymentOptions(): PainelBilheteriaPaymentMethodOption[] {
  return Object.entries(paymentMethodLabels).map(([value, label]) => ({
    value,
    label,
  }));
}

export async function getPainelBilheteriaIndicators(dateInput: string | null | undefined) {
  const date = parseDateInput(dateInput) ?? getSaoPauloToday();
  const pool = getIngressoDbPool();
  const result = await pool.query<{
    compranaousado: string | null;
    comprausado: string | null;
    compradoforadata: string | null;
    reservanaousado: string | null;
  }>(
    `
      SELECT
        SUM(CASE WHEN compra.tpcompra = 'ponli'
                  AND voucher.stusado = 'n'
                  AND compra.stcompra = 'conc'
                  AND agenda.dtagenda = $1::date
                  AND (pagpagseguro.status = 3 OR pagpagseguro.status = 4)
             THEN 1 ELSE 0 END)::text AS compranaousado,
        SUM(CASE WHEN compra.tpcompra = 'ponli'
                  AND voucher.stusado = 's'
                  AND compra.stcompra = 'conc'
                  AND agenda.dtagenda = $1::date
                  AND voucher.dtuso = $1::date
                  AND (pagpagseguro.status = 3 OR pagpagseguro.status = 4)
             THEN 1 ELSE 0 END)::text AS comprausado,
        SUM(CASE WHEN compra.tpcompra = 'ponli'
                  AND voucher.stusado = 's'
                  AND compra.stcompra = 'conc'
                  AND agenda.dtagenda <> $1::date
                  AND voucher.dtuso = $1::date
             THEN 1 ELSE 0 END)::text AS compradoforadata,
        SUM(CASE WHEN compra.tpcompra = 'reser'
                  AND voucher.stusado = 'n'
                  AND compra.stcompra = 'conc'
                  AND agenda.dtagenda = $1::date
             THEN 1 ELSE 0 END)::text AS reservanaousado
      FROM voucher
      JOIN compra ON compra.idcompra = voucher.idcompra
      JOIN agenda ON agenda.idagenda = voucher.idagenda
      LEFT JOIN pagpagseguro ON pagpagseguro.idcompra = compra.idcompra
    `,
    [date],
  );

  const row = result.rows[0] ?? {
    compranaousado: "0",
    comprausado: "0",
    compradoforadata: "0",
    reservanaousado: "0",
  };
  const plannedReservations = Number(row.reservanaousado ?? 0);
  const plannedOnlinePurchases = Number(row.compranaousado ?? 0);
  const confirmedEntries = Number(row.comprausado ?? 0);
  const walkInEntries = Number(row.compradoforadata ?? 0);

  return {
    date,
    plannedReservations,
    plannedOnlinePurchases,
    plannedTotal: plannedReservations + plannedOnlinePurchases,
    confirmedEntries,
    walkInEntries,
    totalEntries: confirmedEntries + walkInEntries,
  } satisfies PainelBilheteriaIndicators;
}

export async function listPainelBilheteriaHistory(
  input: PainelBilheteriaHistoryFilters & {
    page?: string | number | null;
    pageSize?: string | number | null;
  },
) {
  const filters = normalizeFilters(input);
  const page = Math.max(1, Number(input.page ?? 1) || 1);
  const pageSize = Math.min(200, Math.max(1, Number(input.pageSize ?? 30) || 30));
  const offset = (page - 1) * pageSize;
  const { conditions, params, valueFilter } = buildHistoryConditions(filters);
  const whereClause = conditions.join(" AND ");
  const havingClause =
    valueFilter == null
      ? ""
      : `HAVING ROUND((CASE WHEN c.stcompra = 'canc'
              THEN COALESCE(c.vltotcompra,0)
              ELSE COALESCE(SUM(CASE WHEN v.stusado <> 'inv' THEN v.vlunicompra ELSE 0 END),0)
            END)::numeric,2) = $${params.length + 1}`;
  const paramsWithValue = valueFilter == null ? params : [...params, valueFilter];
  const pool = getIngressoDbPool();

  const rowsResult = await pool.query<PurchaseHistoryRow>(
    `
      SELECT
        c.idcompra,
        c.dtcompra::text AS dtcompra,
        c.cpf,
        c.formapag,
        c.tpcompra,
        c.stcompra,
        c.dtpagamento::text AS dtpagamento,
        COALESCE(SUM(CASE WHEN v.stusado <> 'inv' THEN v.vlunicompra ELSE 0 END),0)::text AS total_venda,
        COALESCE(c.vltotcompra,0)::text AS total_venda_cancelada
      FROM compra c
      LEFT JOIN voucher v ON v.idcompra = c.idcompra
      WHERE ${whereClause}
      GROUP BY c.idcompra, c.dtcompra, c.cpf, c.formapag, c.tpcompra, c.stcompra, c.vltotcompra, c.dtpagamento
      ${havingClause}
      ORDER BY c.dtcompra DESC, c.idcompra DESC
      LIMIT $${paramsWithValue.length + 1}
      OFFSET $${paramsWithValue.length + 2}
    `,
    [...paramsWithValue, pageSize, offset],
  );

  const countResult = await pool.query<{ total: string }>(
    `
      SELECT COUNT(*)::text AS total
      FROM (
        SELECT c.idcompra
        FROM compra c
        LEFT JOIN voucher v ON v.idcompra = c.idcompra
        WHERE ${whereClause}
        GROUP BY c.idcompra, c.dtcompra, c.cpf, c.formapag, c.tpcompra, c.stcompra, c.vltotcompra, c.dtpagamento
        ${havingClause}
      ) t
    `,
    paramsWithValue,
  );

  const purchaseIds = rowsResult.rows.map((row) => row.idcompra);
  const paymentCodesByPurchaseId = new Map<number, string[]>();

  if (purchaseIds.length > 0) {
    const paymentRows = await pool.query<PurchasePaymentMethodRow>(
      `
        SELECT
          cp.idcompra,
          TRIM(cp.forma_pagamento) AS forma
        FROM compra_pagamentos cp
        WHERE cp.idcompra = ANY($1::int[])
        GROUP BY cp.idcompra, TRIM(cp.forma_pagamento)
        ORDER BY cp.idcompra ASC, TRIM(cp.forma_pagamento) ASC
      `,
      [purchaseIds],
    );

    for (const row of paymentRows.rows) {
      const current = paymentCodesByPurchaseId.get(row.idcompra) ?? [];
      if (row.forma) {
        current.push(row.forma);
      }
      paymentCodesByPurchaseId.set(row.idcompra, current);
    }
  }

  const items = rowsResult.rows.map((row) => {
    const totalValue =
      row.stcompra === "canc"
        ? formatMoney(row.total_venda_cancelada)
        : formatMoney(row.total_venda);
    const paymentCodes = mapPaymentCodes(
      row,
      paymentCodesByPurchaseId.get(row.idcompra),
      totalValue,
    );

    return {
      purchaseId: row.idcompra,
      purchaseDate: row.dtcompra ? row.dtcompra.slice(0, 10) : null,
      cpf: row.cpf,
      type: String(row.tpcompra ?? "").trim(),
      typeLabel: formatPurchaseTypeLabel(row.tpcompra),
      status: String(row.stcompra ?? "").trim(),
      statusLabel: formatPurchaseStatusLabel(row.stcompra),
      totalValue,
      paymentCodes,
      paymentLabels: paymentCodes.map(formatPaymentMethodLabel),
      paidAt: row.dtpagamento ? row.dtpagamento.slice(0, 10) : null,
    } satisfies PainelBilheteriaHistoryItem;
  });

  const total = Number(countResult.rows[0]?.total ?? 0);

  return {
    items,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    filters,
  } satisfies PainelBilheteriaHistoryPage;
}

export async function getPainelBilheteriaPurchaseDetail(purchaseId: number) {
  if (!Number.isInteger(purchaseId) || purchaseId <= 0) {
    throw new PainelBilheteriaError(
      "invalid_purchase_id",
      "Compra invalida.",
      400,
    );
  }

  const pool = getIngressoDbPool();
  const purchaseResult = await pool.query<PurchaseDetailRow>(
    `
      SELECT
        compra.idcompra,
        compra.dtcompra::text AS dtcompra,
        compra.cpf,
        compra.tpcompra,
        compra.stcompra,
        compra.formapag,
        compra.vltotcompra::text AS vltotcompra,
        compra.dtpagamento::text AS dtpagamento,
        compra.hrpagamento::text AS hrpagamento
      FROM compra
      WHERE compra.idcompra = $1
        AND compra.tpcompra IN ('bilhe', 'reser')
      LIMIT 1
    `,
    [purchaseId],
  );
  const purchase = purchaseResult.rows[0] ?? null;

  if (!purchase) {
    throw new PainelBilheteriaError(
      "purchase_not_found",
      "Compra nao encontrada.",
      404,
    );
  }

  const [voucherResult, paymentsResult, discountsResult] = await Promise.all([
    pool.query<PurchaseVoucherRow>(
      `
      SELECT
        voucher.idvoucher,
        voucher.numvoucher,
        voucher.tpvoucher,
        voucher.stusado,
        voucher.vlunicompra::text AS vlunicompra,
        voucher.desconto_id,
        voucher.descricao,
        agenda.dtagenda::text AS agenda_data,
        voucher.dtvalidade::text AS dtvalidade
      FROM voucher
        LEFT JOIN agenda ON agenda.idagenda = voucher.idagenda
        WHERE voucher.idcompra = $1
        ORDER BY voucher.idvoucher ASC
      `,
      [purchaseId],
    ),
    pool.query<PurchasePaymentRow>(
      `
        SELECT
          forma_pagamento,
          valor::text AS valor
        FROM compra_pagamentos
        WHERE idcompra = $1
        ORDER BY id ASC
      `,
      [purchaseId],
    ),
    pool.query<PurchaseDiscountRow>(
      `
        SELECT
          descontos.id,
          descontos.nome,
          descontos.tipo_aplicacao,
          descontos.valor::text AS valor,
          descontos_tipos.descricao AS tipo_desc
        FROM descontos
        JOIN descontos_tipos ON descontos_tipos.id = descontos.tipo_id
        WHERE descontos.tipo_aplicacao IN ('percentual', 'valor_fixo')
        ORDER BY descontos.nome ASC, descontos.id ASC
      `,
    ),
  ]);

  const discountOptions = discountsResult.rows.map((discount) => ({
    id: discount.id,
    name: String(discount.nome ?? "").trim(),
    applicationType: String(discount.tipo_aplicacao ?? "").trim() || null,
    value: formatMoney(discount.valor),
    typeDescription: String(discount.tipo_desc ?? "").trim() || null,
  }));
  const discountsById = new Map(
    discountOptions.map((discount) => [discount.id, discount] as const),
  );

  let payments = paymentsResult.rows
    .map((row) => {
      const method = String(row.forma_pagamento ?? "").trim();
      const value = formatMoney(row.valor);

      return method
        ? {
            method,
            methodLabel: formatPaymentMethodLabel(method),
            value,
          }
        : null;
    })
    .filter((row): row is PainelBilheteriaPurchasePayment => row !== null);

  if (payments.length === 0) {
    const fallbackMethod = String(purchase.formapag ?? "").trim();

    if (fallbackMethod && fallbackMethod.toUpperCase() !== "N/A") {
      payments = [
        {
          method: fallbackMethod,
          methodLabel: formatPaymentMethodLabel(fallbackMethod),
          value: formatMoney(purchase.vltotcompra),
        },
      ];
    }
  }

  return {
    purchaseId: purchase.idcompra,
    purchaseDate: purchase.dtcompra ? purchase.dtcompra.slice(0, 10) : null,
    cpf: purchase.cpf,
    type: String(purchase.tpcompra ?? "").trim(),
    typeLabel: formatPurchaseTypeLabel(purchase.tpcompra),
    status: String(purchase.stcompra ?? "").trim(),
    statusLabel: formatPurchaseStatusLabel(purchase.stcompra),
    paymentMethod: purchase.formapag,
    paymentMethodLabel: purchase.formapag
      ? formatPaymentMethodLabel(purchase.formapag)
      : null,
    totalValue: formatMoney(purchase.vltotcompra),
    paidAt: formatDateTime(purchase.dtpagamento, purchase.hrpagamento),
    vouchers: voucherResult.rows.map((voucher) => ({
      voucherId: voucher.idvoucher,
      voucherNumber: voucher.numvoucher,
      voucherType: voucher.tpvoucher,
      voucherTypeLabel: resolveVoucherDisplayLabel(voucher),
      baseVoucherTypeLabel: formatVoucherTypeLabel(voucher.tpvoucher),
      status: String(voucher.stusado ?? "").trim(),
      statusLabel: formatVoucherStatusLabel(voucher.stusado),
      unitValue: formatMoney(voucher.vlunicompra),
      baseUnitValue: formatMoney(resolveVoucherBaseValue(voucher, discountsById)),
      discountId: voucher.desconto_id,
      discountEditable: isVoucherDiscountEditable(voucher.tpvoucher),
      description: voucher.descricao,
      visitDate: voucher.agenda_data ? voucher.agenda_data.slice(0, 10) : null,
    })),
    payments,
    discountOptions,
    payableReservation:
      String(purchase.tpcompra ?? "").trim() === "reser" &&
      !purchase.dtpagamento &&
      String(purchase.stcompra ?? "").trim() !== "canc",
  } satisfies PainelBilheteriaPurchaseDetail;
}

export async function sendPainelBilheteriaVoucherWhatsapp(
  input: SendPainelBilheteriaVoucherWhatsappInput,
): Promise<SendPainelBilheteriaVoucherWhatsappSuccess> {
  if (!Number.isInteger(input.purchaseId) || input.purchaseId <= 0) {
    throw new PainelBilheteriaError(
      "invalid_purchase_id",
      "Informe uma compra valida.",
      400,
    );
  }

  if (!Number.isInteger(input.voucherId) || input.voucherId <= 0) {
    throw new PainelBilheteriaError(
      "invalid_voucher_id",
      "Informe um voucher valido para envio.",
      400,
    );
  }

  const normalizedPhone = String(input.phoneNumber ?? "").replace(/\D+/g, "");

  if (normalizedPhone.length < 11) {
    throw new PainelBilheteriaError(
      "invalid_phone_number",
      "Informe um numero de WhatsApp valido com DDD.",
      400,
    );
  }

  const pool = getIngressoDbPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const purchaseResult = await client.query<PurchaseDetailRow>(
      `
        SELECT
          compra.idcompra,
          compra.dtcompra::text AS dtcompra,
          compra.cpf,
          compra.tpcompra,
          compra.stcompra,
          compra.formapag,
          compra.vltotcompra::text AS vltotcompra,
          compra.dtpagamento::text AS dtpagamento,
          compra.hrpagamento::text AS hrpagamento
        FROM compra
        WHERE compra.idcompra = $1
          AND compra.stcompra = 'conc'
        LIMIT 1
        FOR UPDATE
      `,
      [input.purchaseId],
    );
    const purchase = purchaseResult.rows[0] ?? null;

    if (!purchase) {
      throw new PainelBilheteriaError(
        "purchase_not_confirmed",
        "Compra nao encontrada ou ainda nao confirmada.",
        404,
      );
    }

    const voucherResult = await client.query<Pick<PurchaseVoucherRow, "idvoucher" | "stusado">>(
      `
        SELECT
          voucher.idvoucher,
          voucher.stusado
        FROM voucher
        WHERE voucher.idcompra = $1
          AND voucher.idvoucher = $2
        LIMIT 1
        FOR UPDATE
      `,
      [input.purchaseId, input.voucherId],
    );
    const voucher = voucherResult.rows[0] ?? null;

    if (!voucher) {
      throw new PainelBilheteriaError(
        "voucher_not_found",
        "Voucher nao encontrado para esta compra.",
        404,
      );
    }

    if (String(voucher.stusado ?? "").trim() === "s") {
      throw new PainelBilheteriaError(
        "voucher_already_used",
        "Voucher ja utilizado; nao e possivel reenviar por WhatsApp.",
        409,
      );
    }

    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 1);
    const validUntilText = validUntil.toISOString().slice(0, 10);

    await client.query(
      `
        UPDATE voucher
        SET dtvalidade = $2::date
        WHERE idvoucher = $1
      `,
      [input.voucherId, validUntilText],
    );

    const auditLogId = await registerOpsAuditLog(client, {
      origem: "compra",
      acao: "editar",
      compraId: input.purchaseId,
      descricao: `Envio operacional de voucher ${input.voucherId} por WhatsApp.`,
      motivo: "Reenvio de ingresso via WhatsApp no painel.",
      usuarioNome:
        [String(input.actor?.name ?? "").trim(), normalizeCpf(input.actor?.cpf ?? "")]
          .filter(Boolean)
          .join(" ") || null,
      detalhes: {
        via: "apps/web",
        voucherId: input.voucherId,
        phoneNumber: normalizedPhone,
        validUntil: validUntilText,
      },
    });

    await client.query("COMMIT");

    const result = await sendPurchaseTicketsWhatsApp(
      input.purchaseId,
      [input.voucherId],
      normalizedPhone,
    );

    if (result.status !== "sent") {
      const message =
        result.skippedReason === "phone_not_allowed_for_testing"
          ? "Numero nao autorizado para este ambiente."
          : "Nao foi possivel enviar o voucher por WhatsApp agora.";

      throw new PainelBilheteriaError("whatsapp_unavailable", message, 502);
    }

    return {
      purchaseId: input.purchaseId,
      voucherId: input.voucherId,
      phoneNumber: normalizedPhone,
      validUntil: validUntilText,
      message: "Solicitacao enviada para o WhatsApp.",
      auditLogId,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function getPainelBilheteriaVoucherPrintModel(
  voucherId: number,
  actor?: BilheteriaActor | null,
): Promise<PainelBilheteriaVoucherPrintModel> {
  if (!Number.isInteger(voucherId) || voucherId <= 0) {
    throw new PainelBilheteriaError(
      "invalid_voucher_id",
      "Voucher invalido.",
      400,
    );
  }

  const pool = getIngressoDbPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const voucherResult = await client.query<PurchaseVoucherRow>(
      `
        SELECT
          voucher.idvoucher,
          voucher.idcompra,
          voucher.idagenda,
          voucher.numvoucher,
          voucher.tpvoucher,
          voucher.stusado,
          voucher.dtuso::text AS dtuso,
          voucher.vlunicompra::text AS vlunicompra,
          voucher.desconto_id,
          voucher.descricao,
          voucher.dtvalidade::text AS dtvalidade,
          compra.cpf,
          compra.tpcompra,
          compra.dtcompra::text AS dtcompra
        FROM voucher
        JOIN compra ON compra.idcompra = voucher.idcompra
        WHERE voucher.idvoucher = $1
        LIMIT 1
        FOR UPDATE
      `,
      [voucherId],
    );
    const voucher = voucherResult.rows[0] ?? null;

    if (!voucher || !voucher.idcompra) {
      throw new PainelBilheteriaError(
        "voucher_not_found",
        "Voucher nao encontrado.",
        404,
      );
    }

    if (String(voucher.dtuso ?? "").trim()) {
      throw new PainelBilheteriaError(
        "voucher_already_used",
        "Voucher ja utilizado; nao e possivel reemitir/imprimir.",
        409,
      );
    }

    let agendaDate: string | null = null;

    if (voucher.idagenda && Number(voucher.idagenda) > 0) {
      const agendaResult = await client.query<{ dtagenda: string | null }>(
        `
          SELECT agenda.dtagenda::text AS dtagenda
          FROM agenda
          WHERE agenda.idagenda = $1
          LIMIT 1
        `,
        [voucher.idagenda],
      );
      agendaDate = agendaResult.rows[0]?.dtagenda ?? null;
    }

    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 1);
    const validUntilText = validUntil.toISOString().slice(0, 10);

    await client.query(
      `
        UPDATE voucher
        SET dtvalidade = $2::date
        WHERE idvoucher = $1
      `,
      [voucherId, validUntilText],
    );

    await registerOpsAuditLog(client, {
      origem: "compra",
      acao: "editar",
      compraId: voucher.idcompra,
      descricao: `Impressao operacional do voucher ${voucherId}.`,
      motivo: "Reemissao de QR individual no painel.",
      usuarioNome:
        [String(actor?.name ?? "").trim(), normalizeCpf(actor?.cpf ?? "")]
          .filter(Boolean)
          .join(" ") || null,
      detalhes: {
        via: "apps/web",
        voucherId,
        validUntil: validUntilText,
      },
    });

    await client.query("COMMIT");

    const qrCodeMap = await generateVoucherQrcodes([
      {
        purchaseId: voucher.idcompra,
        voucherId,
        cpf: String(voucher.cpf ?? "").trim(),
        type: voucher.tpvoucher,
        purchaseLocation: "Bilheteria",
        purchaseDate: voucher.dtcompra ? voucher.dtcompra.slice(0, 10) : null,
        price: Number(voucher.vlunicompra ?? 0),
        tpcompra: String(voucher.tpcompra ?? "").trim(),
      },
    ]);
    const qrCodeUrl = qrCodeMap[voucherId] ?? null;

    return {
      purchaseId: voucher.idcompra,
      voucherId,
      voucherCode: String(voucher.numvoucher ?? "").trim() || String(voucherId),
      voucherNumber: voucher.numvoucher,
      cpf: voucher.cpf ?? null,
      type: voucher.tpvoucher ?? null,
      typeLabel: resolveVoucherDisplayLabel(voucher),
      description: voucher.descricao,
      purchaseLocation: "Bilheteria",
      purchaseDate: voucher.dtcompra ? voucher.dtcompra.slice(0, 10) : null,
      price: formatMoney(voucher.vlunicompra),
      tpcompra: voucher.tpcompra ?? null,
      visitDate: agendaDate ? agendaDate.slice(0, 10) : null,
      validUntil: validUntilText,
      qrCodeUrl,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);

    if (error instanceof TicketApiError) {
      throw new PainelBilheteriaError(
        "voucher_print_unavailable",
        error.message,
        error.status,
      );
    }

    throw error;
  } finally {
    client.release();
  }
}

export async function getPainelBilheteriaPurchasePrintModel(
  purchaseId: number,
  actor?: BilheteriaActor | null,
): Promise<PainelBilheteriaPurchasePrintModel> {
  if (!Number.isInteger(purchaseId) || purchaseId <= 0) {
    throw new PainelBilheteriaError(
      "invalid_purchase_id",
      "Compra invalida.",
      400,
    );
  }

  const pool = getIngressoDbPool();
  const purchaseResult = await pool.query<{ idcompra: number }>(
    `
      SELECT compra.idcompra
      FROM compra
      WHERE compra.idcompra = $1
        AND compra.tpcompra IN ('bilhe', 'reser', 'ponli')
      LIMIT 1
    `,
    [purchaseId],
  );

  if (purchaseResult.rowCount === 0) {
    throw new PainelBilheteriaError(
      "purchase_not_found",
      "Compra nao encontrada.",
      404,
    );
  }

  const voucherResult = await pool.query<{ idvoucher: number }>(
    `
      SELECT voucher.idvoucher
      FROM voucher
      WHERE voucher.idcompra = $1
      ORDER BY voucher.idvoucher
    `,
    [purchaseId],
  );

  if (voucherResult.rowCount === 0) {
    throw new PainelBilheteriaError(
      "voucher_not_found",
      "Nenhum voucher encontrado para impressao.",
      404,
    );
  }

  const vouchers = await Promise.all(
    voucherResult.rows.map((row) =>
      getPainelBilheteriaVoucherPrintModel(row.idvoucher, actor),
    ),
  );

  return {
    purchaseId,
    vouchers,
  };
}

export async function getPainelBilheteriaGatewayStatus(
  purchaseId: number,
): Promise<PainelBilheteriaGatewayStatus> {
  if (!Number.isInteger(purchaseId) || purchaseId <= 0) {
    throw new PainelBilheteriaError(
      "invalid_purchase_id",
      "Compra invalida.",
      400,
    );
  }

  const pool = getIngressoDbPool();
  const [purchaseResult, ledgerResult] = await Promise.all([
    pool.query<PurchaseDetailRow>(
      `
        SELECT
          compra.idcompra,
          compra.dtcompra::text AS dtcompra,
          compra.cpf,
          compra.tpcompra,
          compra.stcompra,
          compra.formapag,
          compra.vltotcompra::text AS vltotcompra,
          compra.dtpagamento::text AS dtpagamento,
          compra.hrpagamento::text AS hrpagamento
        FROM compra
        WHERE compra.idcompra = $1
          AND compra.tpcompra IN ('bilhe', 'reser', 'ponli')
        LIMIT 1
      `,
      [purchaseId],
    ),
    pool.query<PurchaseGatewayLedgerRow>(
      `
        SELECT
          pagpagseguro.idpagseguro AS payment_id,
          pagpagseguro.reference,
          pagpagseguro.status::text AS gateway_status,
          pagpagseguro.date::text AS date,
          pagpagseguro."lastEventDate"::text AS last_event_date
        FROM pagpagseguro
        WHERE pagpagseguro.idcompra = $1
        ORDER BY pagpagseguro.date DESC NULLS LAST, pagpagseguro.idpagseguro DESC
        LIMIT 1
      `,
      [purchaseId],
    ),
  ]);

  const purchase = purchaseResult.rows[0] ?? null;

  if (!purchase) {
    throw new PainelBilheteriaError(
      "purchase_not_found",
      "Compra nao encontrada.",
      404,
    );
  }

  const ledger = ledgerResult.rows[0] ?? null;
  const paymentId = String(ledger?.payment_id ?? "").trim() || null;
  const reference = String(ledger?.reference ?? "").trim() || String(purchaseId);
  const ledgerStatus =
    ledger?.gateway_status != null ? Number(ledger.gateway_status) : null;
  const ledgerUpdatedAt = ledger?.last_event_date || ledger?.date || null;

  if (!ledger && String(purchase.formapag ?? "").trim() !== "pgseg") {
    return {
      purchaseId,
      configured: isCieloEcommerceConfigured(),
      paymentId: null,
      reference: null,
      ledgerStatus: null,
      ledgerStatusLabel: "Indisponivel",
      ledgerUpdatedAt: null,
      consultResult: "no_transaction",
      gatewayStatus: null,
      gatewayStatusLabel: "Indisponivel",
      purchaseStatus: null,
      message: "Compra sem transacao online registrada no gateway.",
    };
  }

  if (!isCieloEcommerceConfigured()) {
    return {
      purchaseId,
      configured: false,
      paymentId,
      reference,
      ledgerStatus,
      ledgerStatusLabel: formatGatewayStatusLabel(ledgerStatus),
      ledgerUpdatedAt,
      consultResult: "not_configured",
      gatewayStatus: null,
      gatewayStatusLabel: "Indisponivel",
      purchaseStatus: null,
      message: "Integracao Cielo nao configurada para consulta manual.",
    };
  }

  const payload = await getNativeCieloCheckoutStatus({
    paymentId,
    reference,
    purchaseId,
  });

  if (payload.status !== "00") {
    return {
      purchaseId,
      configured: true,
      paymentId,
      reference,
      ledgerStatus,
      ledgerStatusLabel: formatGatewayStatusLabel(ledgerStatus),
      ledgerUpdatedAt,
      consultResult: "not_found",
      gatewayStatus: null,
      gatewayStatusLabel: "Indisponivel",
      purchaseStatus: null,
      message: String(payload.msgRetorno ?? "Transacao nao encontrada."),
    };
  }

  const mapped = mapCheckoutStatusPayload(payload);

  return {
    purchaseId,
    configured: true,
    paymentId,
    reference,
    ledgerStatus,
    ledgerStatusLabel: formatGatewayStatusLabel(ledgerStatus),
    ledgerUpdatedAt,
    consultResult: "ok",
    gatewayStatus: mapped.gatewayStatus,
    gatewayStatusLabel: mapped.gatewayStatusLabel,
    purchaseStatus: mapped.purchaseStatus,
    message: "Consulta manual do gateway executada com sucesso.",
  };
}

export async function payPainelBilheteriaReservation(
  input: PayPainelReservationInput,
) {
  if (!Number.isInteger(input.purchaseId) || input.purchaseId <= 0) {
    throw new PainelBilheteriaError(
      "invalid_purchase_id",
      "Informe uma reserva valida.",
      400,
    );
  }

  const normalizedPayments = (Array.isArray(input.payments) ? input.payments : [])
    .map((payment) => ({
      method: String(payment.method ?? "").trim(),
      value: parseMoney(payment.value),
    }))
    .filter(
      (payment): payment is { method: string; value: number } =>
        payment.method !== "" && payment.value != null && payment.value > 0,
    );

  if (normalizedPayments.length === 0) {
    throw new PainelBilheteriaError(
      "reservation_payments_required",
      "Informe ao menos uma forma de pagamento.",
      400,
    );
  }

  const pool = getIngressoDbPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const purchaseResult = await client.query<PurchaseDetailRow>(
      `
        SELECT
          compra.idcompra,
          compra.dtcompra::text AS dtcompra,
          compra.cpf,
          compra.tpcompra,
          compra.stcompra,
          compra.formapag,
          compra.vltotcompra::text AS vltotcompra,
          compra.dtpagamento::text AS dtpagamento,
          compra.hrpagamento::text AS hrpagamento
        FROM compra
        WHERE compra.idcompra = $1
          AND compra.tpcompra = 'reser'
        LIMIT 1
        FOR UPDATE
      `,
      [input.purchaseId],
    );
    const purchase = purchaseResult.rows[0] ?? null;

    if (!purchase) {
      throw new PainelBilheteriaError(
        "reservation_not_found",
        "Reserva nao encontrada.",
        404,
      );
    }

    if (String(purchase.stcompra ?? "").trim() === "canc") {
      throw new PainelBilheteriaError(
        "reservation_cancelled",
        "Nao e possivel pagar uma reserva cancelada.",
        409,
      );
    }

    const totalValue = Number(purchase.vltotcompra ?? 0);
    const totalPayments = normalizedPayments.reduce(
      (sum, payment) => sum + payment.value,
      0,
    );

    if (Math.abs(totalPayments - totalValue) > 0.01) {
      throw new PainelBilheteriaError(
        "reservation_payments_total_mismatch",
        `Total informado (R$ ${roundMoney(totalPayments).toFixed(2)}) difere do valor da reserva (R$ ${roundMoney(totalValue).toFixed(2)}).`,
        409,
      );
    }

    if (purchase.dtpagamento) {
      await client.query("COMMIT");

      return {
        purchaseId: purchase.idcompra,
        status: "conc",
        totalValue: formatMoney(totalValue),
        paymentMethods: normalizedPayments.map((payment) => payment.method),
        message: "Reserva ja estava paga.",
        alreadyPaid: true,
        auditLogId: null,
      } satisfies PayPainelReservationSuccess;
    }

    await client.query(
      `
        UPDATE compra
        SET
          dtpagamento = CURRENT_DATE,
          hrpagamento = CURRENT_TIME,
          formapag = $2,
          stcompra = 'conc'
        WHERE idcompra = $1
      `,
      [input.purchaseId, normalizedPayments[0].method],
    );

    await client.query("DELETE FROM compra_pagamentos WHERE idcompra = $1", [
      input.purchaseId,
    ]);

    for (const payment of normalizedPayments) {
      await client.query(
        `
          INSERT INTO compra_pagamentos (
            idcompra,
            forma_pagamento,
            valor,
            created_at
          ) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
        `,
        [input.purchaseId, payment.method, payment.value.toFixed(2)],
      );
    }

    const auditLogId = await registerOpsAuditLog(client, {
      origem: "compra",
      acao: "editar",
      compraId: input.purchaseId,
      descricao: `Pagamento de reserva confirmado em ${normalizedPayments
        .map(
          (payment) =>
            `${formatPaymentMethodLabel(payment.method)} ${formatMoney(payment.value)}`,
        )
        .join("; ")}`,
      motivo: "Pagamento operacional da reserva no painel.",
      usuarioNome:
        [String(input.actor?.name ?? "").trim(), normalizeCpf(input.actor?.cpf ?? "")]
          .filter(Boolean)
          .join(" ") || null,
      detalhes: {
        via: "apps/web",
        paymentMethods: normalizedPayments.map((payment) => ({
          method: payment.method,
          value: payment.value.toFixed(2),
        })),
        actor: {
          name: String(input.actor?.name ?? "").trim() || null,
          cpf: normalizeCpf(input.actor?.cpf ?? "") || null,
        },
      },
    });

    await client.query("COMMIT");
    await queuePurchaseConfirmationEmail(input.purchaseId).catch(() => undefined);

    return {
      purchaseId: input.purchaseId,
      status: "conc",
      totalValue: formatMoney(totalValue),
      paymentMethods: normalizedPayments.map((payment) => payment.method),
      message: "Pagamento da reserva confirmado com sucesso.",
      alreadyPaid: false,
      auditLogId,
    } satisfies PayPainelReservationSuccess;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export function asPainelBilheteriaError(error: unknown) {
  if (error instanceof PainelBilheteriaError) {
    return error;
  }

  return new PainelBilheteriaError(
    "painel_bilheteria_unavailable",
    "Nao foi possivel carregar os dados da bilheteria agora.",
    502,
  );
}
