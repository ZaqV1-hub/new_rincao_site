import { Buffer } from "node:buffer";
import {
  getNativeCieloCheckoutStatus,
  isCieloEcommerceConfigured,
} from "@/lib/cielo-ecommerce";
import { getIngressoDbPool } from "@/lib/ingresso-db";
import { normalizePaymentReconciliationPayload } from "@/lib/payment-reconciliation";
import {
  normalizePainelCompraDateFilterValue,
  normalizePainelCompraScalarFilterValue,
} from "@/lib/painel-compras-format";

export type PainelPurchaseListFilters = {
  purchaseId: string | null;
  type: string | null;
  purchaseStatus: string | null;
  paymentMethod?: string | null;
  ticketPaymentMethod: string | null;
  gatewayPaymentMethod: string | null;
  gatewayStatus: string | null;
  cpf: string | null;
  userName: string | null;
  dateFrom: string | null;
  dateTo: string | null;
};

export type PainelPurchaseListItem = {
  purchaseId: number;
  purchaseDate: string | null;
  paymentDate: string | null;
  paymentTime: string | null;
  type: string;
  typeLabel: string;
  status: string;
  statusLabel: string;
  paymentMethodLabel: string;
  paymentLabel: string;
  cpf: string | null;
  userName: string | null;
  totalValue: string;
};

export type PainelPurchaseListResult = {
  items: PainelPurchaseListItem[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
  filters: PainelPurchaseListFilters;
};

export type PainelPurchaseDetailVoucher = {
  voucherId: number;
  voucherNumber: string | null;
  visitDate: string | null;
  voucherType: string;
  voucherTypeLabel: string;
  schoolName: string | null;
  className: string | null;
  periodName: string | null;
  unitValue: string;
  used: string;
  usedLabel: string;
  usedDate: string | null;
  usedTime: string | null;
  schoolTripHref: string | null;
};

export type PainelPurchaseDetail = {
  purchaseId: number;
  purchaseDate: string | null;
  type: string;
  typeLabel: string;
  status: string;
  statusLabel: string;
  paymentLabel: string;
  paymentMethodLabel: string;
  paymentDate: string | null;
  paymentTime: string | null;
  totalValue: string;
  cpf: string | null;
  userName: string | null;
  referralCode: string | null;
  gatewayPaymentId: string | null;
  gatewayStatusCode: string | null;
  gatewayStatusLabel: string | null;
  vouchers: PainelPurchaseDetailVoucher[];
};

export type PainelPurchaseGatewayConsultResult = {
  purchaseId: number;
  found: boolean;
  message: string;
  statusCode: number | null;
  statusLabel: string | null;
  paymentMethodType: number | null;
  paymentMethodLabel: string | null;
  grossAmount: string;
  feeAmount: string;
  netAmount: string;
  paymentDate: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  senderName: string | null;
  senderEmail: string | null;
  senderPhone: string | null;
};

export type PainelPurchaseVoucherListFilters = {
  voucherId: string | null;
  purchaseDateFrom: string | null;
  purchaseDateTo: string | null;
  usedDateFrom: string | null;
  usedDateTo: string | null;
  visitDateFrom: string | null;
  visitDateTo: string | null;
  voucherType: string | null;
  purchaseLocation: string | null;
  purchaseStatus: string | null;
  usedStatus: string | null;
};

export type PainelPurchaseVoucherListItem = {
  purchaseId: number;
  voucherId: number;
  voucherNumber: string | null;
  purchaseDate: string | null;
  visitDate: string | null;
  ticketTypeLabel: string;
  name: string | null;
  location: string;
  locationLabel: string;
  unitValue: string;
  purchaseStatusLabel: string;
  usedLabel: string;
  usedDate: string | null;
  usedTime: string | null;
  purchaseTypeLabel: string;
};

export type PainelPurchaseVoucherIndicators = {
  qtdnormal_site: number;
  vlnormal_site: string;
  qtdinfantil_site: number;
  vlinfantil_site: string;
  qtdnormal_parque: number;
  vlnormal_parque: string;
  qtdinfantil_parque: number;
  vlinfantil_parque: string;
  qtdescola: number;
  vlescola: string;
  qtdadulto_reserva: number;
  vladulto_reserva: string;
  qtdinfantil_reserva: number;
  vlinfantil_reserva: string;
  qtespecial: number;
  vlespecial: string;
  qtdcortesia: number;
  qtdisento: number;
  totalCount: number;
  totalValue: string;
};

export type PainelPurchaseVoucherListResult = {
  items: PainelPurchaseVoucherListItem[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
  filters: PainelPurchaseVoucherListFilters;
  indicators: PainelPurchaseVoucherIndicators;
};

export class PainelComprasError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "PainelComprasError";
    this.code = code;
    this.status = status;
  }
}

type LegacyDateRangeShape =
  | {
      de?: unknown;
      ate?: unknown;
    }
  | null
  | undefined;

type PainelPurchaseListFilterInput = Record<string, unknown> & {
  idcompra?: unknown;
  tpcompra?: unknown;
  stcompra?: unknown;
  payment?: unknown;
  formapag?: unknown;
  paymentmethodtype?: unknown;
  status?: unknown;
  cpf?: unknown;
  nmusuario?: unknown;
  "dtcompra[de]"?: unknown;
  "dtcompra[ate]"?: unknown;
  dtcompra?: LegacyDateRangeShape;
};

type PainelPurchaseVoucherFilterInput = Record<string, unknown> & {
  idvoucher?: unknown;
  tpvoucher?: unknown;
  tpcompra?: unknown;
  stcompra?: unknown;
  stusado?: unknown;
  "dtcompra[de]"?: unknown;
  "dtcompra[ate]"?: unknown;
  dtcompra?: LegacyDateRangeShape;
  "dtuso[de]"?: unknown;
  "dtuso[ate]"?: unknown;
  dtuso?: LegacyDateRangeShape;
  "dtagenda[de]"?: unknown;
  "dtagenda[ate]"?: unknown;
  dtagenda?: LegacyDateRangeShape;
};

type PainelPurchaseListWhereInput = Partial<PainelPurchaseListFilters>;

type PainelPurchaseListRow = {
  idcompra: number;
  dtcompra: string | null;
  tpcompra: string | null;
  stcompra: string | null;
  formapag: string | null;
  idpagseguro: number | null;
  paymentmethodtype: string | number | null;
  status: string | number | null;
  dtpagamento: string | null;
  hrpagamento: string | null;
  cpf: string | null;
  nmusuario: string | null;
  vltotcompra: string | number | null;
};

type PainelPurchaseDetailRow = {
  idcompra: number;
  dtcompra: string | null;
  tpcompra: string | null;
  stcompra: string | null;
  formapag: string | null;
  vltotcompra: string | number | null;
  dtpagamento: string | null;
  hrpagamento: string | null;
  cpf: string | null;
  nmusuario: string | null;
  codindica: string | null;
  idpagseguro: string | number | null;
  paymentmethodtype: string | number | null;
  status: string | number | null;
};

type PainelPurchaseDetailVoucherRow = {
  idvoucher: number;
  numvoucher: string | null;
  tpvoucher: string | null;
  descricao: string | null;
  dtagenda: string | null;
  idagenda: number | null;
  idescola: number | null;
  nmescola: string | null;
  turma: string | null;
  periodo: string | null;
  vlunicompra: string | number | null;
  stusado: string | null;
  dtuso: string | null;
  hruso: string | null;
};

type PainelPurchaseGatewayLedgerRow = {
  payment_id: string | null;
  reference: string | null;
};

type PainelPurchaseVoucherListRow = {
  idcompra: number;
  idvoucher: number;
  numvoucher: string | null;
  dtcompra: string | null;
  dtagenda: string | null;
  tpvoucher: string | null;
  descricao: string | null;
  identificacao: string | null;
  tpcompra: string | null;
  stcompra: string | null;
  vlunicompra: string | number | null;
  stusado: string | null;
  dtuso: string | null;
  hruso: string | null;
};

type PainelPurchaseVoucherIndicatorsRow = {
  qtdnormal_site: string | number | null;
  vlnormal_site: string | number | null;
  qtdinfantil_site: string | number | null;
  vlinfantil_site: string | number | null;
  qtdnormal_parque: string | number | null;
  vlnormal_parque: string | number | null;
  qtdinfantil_parque: string | number | null;
  vlinfantil_parque: string | number | null;
  qtdescola: string | number | null;
  vlescola: string | number | null;
  qtdadulto_reserva: string | number | null;
  vladulto_reserva: string | number | null;
  qtdinfantil_reserva: string | number | null;
  vlinfantil_reserva: string | number | null;
  qtespecial: string | number | null;
  vlespecial: string | number | null;
  qtdcortesia: string | number | null;
  qtdisento: string | number | null;
};

const purchaseTypeLabels: Record<string, string> = {
  bilhe: "Bilheteria",
  reser: "Reserva",
  ponli: "Compra",
};

const purchaseStatusLabels: Record<string, string> = {
  pend: "Em processamento",
  conc: "Concluida",
  canc: "Cancelada",
};

const ticketPaymentMethodLabels: Record<string, string> = {
  dinhe: "Dinheiro",
  debit: "Debito",
  credi: "Credito",
  chequ: "Cheque",
  tranb: "Trans. Bancaria",
  corte: "Cortesia",
  pix: "PIX",
  pgseg: "Pagamento online",
};

const gatewayPaymentMethodLabels: Record<string, string> = {
  "1": "Cartao de credito",
  "2": "Boleto",
  "11": "Pix",
};

const gatewayStatusLabels: Record<string, string> = {
  "1": "Aguardando pagamento",
  "2": "Em analise",
  "3": "Paga",
  "4": "Disponivel",
  "5": "Em disputa",
  "6": "Devolvida",
  "7": "Cancelada",
  "8": "Chargeback debitado",
  "9": "Em contestacao",
};

const voucherTypeLabels: Record<string, string> = {
  norma: "Passaporte",
  infan: "Passaporte Infantil",
  escol: "Escolar",
  corte: "Cortesia",
  espec: "Especial",
  isent: "Isento",
};

function normalizeLegacyRouteSegment(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function escapeSqlLiteral(value: string) {
  return value.replaceAll("'", "''");
}

function escapeSqlLikeLiteral(value: string) {
  return escapeSqlLiteral(value).replaceAll("%", "\\%").replaceAll("_", "\\_");
}

function resolveDateRangeValue(
  input: PainelPurchaseListFilterInput,
  key: "de" | "ate",
) {
  const flatKey = `dtcompra[${key}]` as const;
  const nestedValue = input.dtcompra?.[key];
  return normalizePainelCompraDateFilterValue(input[flatKey] ?? nestedValue);
}

function resolveVoucherDateRangeValue(
  input: PainelPurchaseVoucherFilterInput,
  field: "dtcompra" | "dtuso" | "dtagenda",
  key: "de" | "ate",
) {
  const flatKey = `${field}[${key}]` as const;
  const nestedValue = input[field]?.[key];
  return normalizePainelCompraDateFilterValue(input[flatKey] ?? nestedValue);
}

function buildTicketPaymentMethodClause(method: string) {
  const escapedMethod = escapeSqlLiteral(method);
  const courtesyClause =
    method === "corte" ? " OR COALESCE(compra.vltotcompra,0) = 0" : "";

  return `((compra.tpcompra = 'bilhe' AND (
    EXISTS (
      SELECT 1
      FROM compra_pagamentos cp
      WHERE cp.idcompra = compra.idcompra
        AND cp.forma_pagamento = '${escapedMethod}'
    )
    OR (
      NOT EXISTS (
        SELECT 1
        FROM compra_pagamentos cp2
        WHERE cp2.idcompra = compra.idcompra
      )
      AND compra.formapag = '${escapedMethod}'
    )${courtesyClause}
  )) OR (compra.tpcompra <> 'bilhe' AND compra.formapag = '${escapedMethod}'))`;
}

function normalizePurchaseId(value: string | null | undefined) {
  if (!value || !/^\d+$/.test(value)) {
    return null;
  }

  const purchaseId = Number(value);
  return Number.isSafeInteger(purchaseId) && purchaseId > 0 ? purchaseId : null;
}

function normalizeVoucherId(value: string | null | undefined) {
  if (!value || !/^\d+$/.test(value)) {
    return null;
  }

  const voucherId = Number(value);
  return Number.isSafeInteger(voucherId) && voucherId > 0 ? voucherId : null;
}

function normalizeCpf(value: string | null | undefined) {
  const digits = String(value ?? "").replace(/\D+/g, "");
  return digits ? digits : null;
}

function normalizeWhereFilters(
  filters: PainelPurchaseListWhereInput,
): PainelPurchaseListFilters {
  return {
    purchaseId: normalizePainelCompraScalarFilterValue(filters.purchaseId),
    type: normalizePainelCompraScalarFilterValue(filters.type),
    purchaseStatus: normalizePainelCompraScalarFilterValue(filters.purchaseStatus),
    paymentMethod: normalizePainelCompraScalarFilterValue(filters.paymentMethod),
    ticketPaymentMethod: normalizePainelCompraScalarFilterValue(filters.ticketPaymentMethod),
    gatewayPaymentMethod: normalizePainelCompraScalarFilterValue(filters.gatewayPaymentMethod),
    gatewayStatus: normalizePainelCompraScalarFilterValue(filters.gatewayStatus),
    cpf: normalizeCpf(filters.cpf),
    userName: normalizePainelCompraScalarFilterValue(filters.userName),
    dateFrom: normalizePainelCompraDateFilterValue(filters.dateFrom),
    dateTo: normalizePainelCompraDateFilterValue(filters.dateTo),
  };
}

function formatDateLabel(value: string | null | undefined) {
  const normalized = String(value ?? "").slice(0, 10);

  if (!normalized) {
    return null;
  }

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(normalized)) {
    return normalized;
  }

  const [year, month, day] = normalized.split("-");

  return year && month && day ? `${day}/${month}/${year}` : normalized;
}

function formatMoneyLabel(value: string | number | null | undefined) {
  const numeric = Number(value ?? 0);

  if (!Number.isFinite(numeric)) {
    return "0,00";
  }

  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numeric);
}

function formatPurchaseTypeLabel(code: string | null | undefined) {
  const normalized = String(code ?? "").trim();
  return normalized ? purchaseTypeLabels[normalized] ?? normalized : "-";
}

function formatPurchaseStatusLabel(code: string | null | undefined) {
  const normalized = String(code ?? "").trim();
  return normalized ? purchaseStatusLabels[normalized] ?? normalized : "-";
}

function formatTicketPaymentMethodLabel(code: string | null | undefined) {
  const normalized = String(code ?? "").trim().toLowerCase();
  return normalized ? ticketPaymentMethodLabels[normalized] ?? normalized.toUpperCase() : "-";
}

function formatGatewayPaymentMethodLabel(code: string | number | null | undefined) {
  const normalized = String(code ?? "").trim();
  return normalized ? gatewayPaymentMethodLabels[normalized] ?? normalized : "-";
}

function formatGatewayStatusLabel(code: string | number | null | undefined) {
  const normalized = String(code ?? "").trim();
  return normalized ? gatewayStatusLabels[normalized] ?? normalized : "-";
}

function formatVoucherTypeLabel(code: string | null | undefined) {
  const normalized = String(code ?? "").trim().toLowerCase();
  return normalized ? voucherTypeLabels[normalized] ?? normalized : "-";
}

function formatVoucherUsedLabel(code: string | null | undefined) {
  return String(code ?? "").trim().toLowerCase() === "s" ? "Sim" : "Nao";
}

function formatPurchaseLocationLabel(code: string | null | undefined) {
  switch (String(code ?? "").trim()) {
    case "ponli":
      return "SITE";
    case "reser":
      return "RESERVA";
    default:
      return "NO PARQUE";
  }
}

function formatGatewayPaymentDetailLabel(
  paymentMethodType: string | number | null | undefined,
) {
  const normalized = String(paymentMethodType ?? "").trim();
  return normalized ? formatGatewayPaymentMethodLabel(normalized) : "-";
}

function resolveDetailPaymentLabel(row: PainelPurchaseDetailRow) {
  if (String(row.tpcompra ?? "").trim() === "reser") {
    return "Bilheteria";
  }

  const gatewayStatus = String(row.status ?? "").trim();

  if (gatewayStatus && String(row.stcompra ?? "").trim() === "conc") {
    return `Cielo ${gatewayStatus} - ${formatGatewayStatusLabel(gatewayStatus)}`;
  }

  return "-";
}

function buildSchoolTripHref(agendaId: number | null, schoolId: number | null) {
  if (!agendaId || !schoolId) {
    return null;
  }

  return `/painel/clientes/passeios/${agendaId}/alunos`;
}

function readObject(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function readStringValue(
  object: Record<string, unknown> | null,
  keys: string[],
) {
  if (!object) {
    return "";
  }

  for (const key of keys) {
    const value = object[key];

    if (value !== null && value !== undefined) {
      return String(value).trim();
    }
  }

  return "";
}

async function loadPainelPurchaseDetailRow(purchaseId: number) {
  const pool = getIngressoDbPool();
  const purchaseResult = await pool.query<PainelPurchaseDetailRow>(
    `
      SELECT
        compra.idcompra,
        compra.dtcompra::text AS dtcompra,
        compra.tpcompra,
        compra.stcompra,
        compra.formapag,
        compra.vltotcompra::text AS vltotcompra,
        compra.dtpagamento::text AS dtpagamento,
        compra.hrpagamento::text AS hrpagamento,
        compra.cpf,
        compra.codindica,
        usuario.nmusuario,
        pagpagseguro.idpagseguro,
        pagpagseguro.paymentmethodtype,
        pagpagseguro.status
      FROM compra
      LEFT JOIN usuario ON usuario.cpf = compra.cpf
      LEFT JOIN LATERAL (
        SELECT
          pagamento.idpagseguro,
          pagamento.paymentmethodtype,
          pagamento.status
        FROM pagpagseguro AS pagamento
        WHERE pagamento.idcompra = compra.idcompra
        ORDER BY pagamento.idpagseguro DESC
        LIMIT 1
      ) AS pagpagseguro ON true
      WHERE compra.idcompra = $1
      LIMIT 1
    `,
    [purchaseId],
  );

  return purchaseResult.rows[0] ?? null;
}

function resolvePaymentMethodLabel(row: PainelPurchaseListRow) {
  const purchaseType = String(row.tpcompra ?? "").trim();
  const ticketMethod = String(row.formapag ?? "").trim().toLowerCase();
  const totalValue = Number(row.vltotcompra ?? 0);

  if (purchaseType === "bilhe") {
    if (ticketMethod) {
      return formatTicketPaymentMethodLabel(ticketMethod);
    }

    if (totalValue === 0) {
      return formatTicketPaymentMethodLabel("corte");
    }

    return "-";
  }

  if (row.idpagseguro) {
    return formatGatewayPaymentMethodLabel(row.paymentmethodtype);
  }

  if (ticketMethod) {
    return formatTicketPaymentMethodLabel(ticketMethod);
  }

  return "-";
}

function resolvePaymentLabel(row: PainelPurchaseListRow) {
  const purchaseType = String(row.tpcompra ?? "").trim();

  if (purchaseType === "reser" || purchaseType === "bilhe") {
    return "Bilheteria";
  }

  if (row.idpagseguro) {
    const gatewayStatus = String(row.status ?? "").trim();
    return `Cielo ${gatewayStatus} - ${formatGatewayStatusLabel(gatewayStatus)}`;
  }

  return "-";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function buildPurchaseListItem(row: PainelPurchaseListRow): PainelPurchaseListItem {
  const type = String(row.tpcompra ?? "").trim();
  const status = String(row.stcompra ?? "").trim();

  return {
    purchaseId: Number(row.idcompra),
    purchaseDate: formatDateLabel(row.dtcompra),
    paymentDate: formatDateLabel(row.dtpagamento),
    paymentTime: row.hrpagamento ? String(row.hrpagamento).slice(0, 8) : null,
    type,
    typeLabel: formatPurchaseTypeLabel(type),
    status,
    statusLabel: formatPurchaseStatusLabel(status),
    paymentMethodLabel: resolvePaymentMethodLabel(row),
    paymentLabel: resolvePaymentLabel(row),
    cpf: row.cpf,
    userName: row.nmusuario,
    totalValue: formatMoneyLabel(row.vltotcompra),
  };
}

export function normalizePainelPurchaseListFilters(
  input: PainelPurchaseListFilterInput,
): PainelPurchaseListFilters {
  const paymentMethod = normalizePainelCompraScalarFilterValue(input.payment);

  return {
    purchaseId: normalizePainelCompraScalarFilterValue(input.idcompra),
    type: normalizePainelCompraScalarFilterValue(input.tpcompra),
    purchaseStatus: normalizePainelCompraScalarFilterValue(input.stcompra),
    paymentMethod,
    ticketPaymentMethod: normalizePainelCompraScalarFilterValue(input.formapag),
    gatewayPaymentMethod: normalizePainelCompraScalarFilterValue(input.paymentmethodtype),
    gatewayStatus: normalizePainelCompraScalarFilterValue(input.status),
    cpf: normalizePainelCompraScalarFilterValue(input.cpf),
    userName: normalizePainelCompraScalarFilterValue(input.nmusuario),
    dateFrom: resolveDateRangeValue(input, "de"),
    dateTo: resolveDateRangeValue(input, "ate"),
  };
}

export function normalizePainelPurchaseVoucherListFilters(
  input: PainelPurchaseVoucherFilterInput,
): PainelPurchaseVoucherListFilters {
  return {
    voucherId: normalizePainelCompraScalarFilterValue(input.idvoucher),
    purchaseDateFrom: resolveVoucherDateRangeValue(input, "dtcompra", "de"),
    purchaseDateTo: resolveVoucherDateRangeValue(input, "dtcompra", "ate"),
    usedDateFrom: resolveVoucherDateRangeValue(input, "dtuso", "de"),
    usedDateTo: resolveVoucherDateRangeValue(input, "dtuso", "ate"),
    visitDateFrom: resolveVoucherDateRangeValue(input, "dtagenda", "de"),
    visitDateTo: resolveVoucherDateRangeValue(input, "dtagenda", "ate"),
    voucherType: normalizePainelCompraScalarFilterValue(input.tpvoucher),
    purchaseLocation: normalizePainelCompraScalarFilterValue(input.tpcompra),
    purchaseStatus: normalizePainelCompraScalarFilterValue(input.stcompra),
    usedStatus: normalizePainelCompraScalarFilterValue(input.stusado),
  };
}

export function decodeLegacyPurchaseId(encoded: string) {
  const normalized = normalizeLegacyRouteSegment(encoded);

  if (/^\d+$/.test(normalized)) {
    const purchaseId = Number(normalized);
    return Number.isSafeInteger(purchaseId) && purchaseId > 0 ? purchaseId : null;
  }

  try {
    const decoded = Buffer.from(normalized, "base64").toString("utf8").trim();

    if (!/^\d+$/.test(decoded)) {
      return null;
    }

    const purchaseId = Number(decoded);
    return Number.isSafeInteger(purchaseId) && purchaseId > 0 ? purchaseId : null;
  } catch {
    return null;
  }
}

export function buildPainelPurchaseListWhere(
  filters: PainelPurchaseListWhereInput,
) {
  const normalizedFilters = normalizeWhereFilters(filters);
  const clauses: string[] = [];

  const purchaseId = normalizePurchaseId(normalizedFilters.purchaseId);

  if (purchaseId) {
    clauses.push(`compra.idcompra = ${purchaseId}`);
  }

  if (normalizedFilters.type) {
    clauses.push(`compra.tpcompra = '${escapeSqlLiteral(normalizedFilters.type)}'`);
  }

  if (normalizedFilters.purchaseStatus) {
    clauses.push(
      `compra.stcompra = '${escapeSqlLiteral(normalizedFilters.purchaseStatus)}'`,
    );
  }

  if (normalizedFilters.gatewayPaymentMethod) {
    clauses.push(
      `pagpagseguro.paymentmethodtype = '${escapeSqlLiteral(normalizedFilters.gatewayPaymentMethod)}'`,
    );
  }

  if (normalizedFilters.gatewayStatus) {
    clauses.push(
      `pagpagseguro.status = '${escapeSqlLiteral(normalizedFilters.gatewayStatus)}'`,
    );
  }

  if (normalizedFilters.cpf) {
    clauses.push(`usuario.cpf = '${escapeSqlLiteral(normalizedFilters.cpf)}'`);
  }

  if (normalizedFilters.userName) {
    clauses.push(
      `usuario.nmusuario ILIKE '%${escapeSqlLikeLiteral(normalizedFilters.userName)}%'`,
    );
  }

  if (normalizedFilters.dateFrom) {
    clauses.push(
      `compra.dtcompra >= TO_DATE('${normalizedFilters.dateFrom}', 'DD/MM/YYYY')`,
    );
  }

  if (normalizedFilters.dateTo) {
    clauses.push(
      `compra.dtcompra <= TO_DATE('${normalizedFilters.dateTo}', 'DD/MM/YYYY')`,
    );
  }

  if (normalizedFilters.ticketPaymentMethod) {
    clauses.push(buildTicketPaymentMethodClause(normalizedFilters.ticketPaymentMethod));
  }

  if (normalizedFilters.paymentMethod) {
    if (normalizedFilters.paymentMethod.startsWith("gateway:")) {
      clauses.push(
        `pagpagseguro.paymentmethodtype = '${escapeSqlLiteral(
          normalizedFilters.paymentMethod.slice("gateway:".length),
        )}'`,
      );
    } else if (normalizedFilters.paymentMethod.startsWith("ticket:")) {
      clauses.push(
        buildTicketPaymentMethodClause(
          normalizedFilters.paymentMethod.slice("ticket:".length),
        ),
      );
    }
  }

  return {
    sql: clauses.join(" AND "),
  };
}

export function buildPainelPurchaseVoucherListWhere(
  filters: PainelPurchaseVoucherListFilters,
) {
  const clauses: string[] = [];
  const voucherId = normalizeVoucherId(filters.voucherId);

  if (voucherId) {
    clauses.push(`voucher.idvoucher = ${voucherId}`);
  }

  if (filters.purchaseDateFrom) {
    clauses.push(
      `c.dtcompra >= TO_DATE('${filters.purchaseDateFrom}', 'DD/MM/YYYY')`,
    );
  }

  if (filters.purchaseDateTo) {
    clauses.push(
      `c.dtcompra <= TO_DATE('${filters.purchaseDateTo}', 'DD/MM/YYYY')`,
    );
  }

  if (filters.usedDateFrom) {
    clauses.push(
      `voucher.dtuso >= TO_DATE('${filters.usedDateFrom}', 'DD/MM/YYYY')`,
    );
  }

  if (filters.usedDateTo) {
    clauses.push(
      `voucher.dtuso <= TO_DATE('${filters.usedDateTo}', 'DD/MM/YYYY')`,
    );
  }

  if (filters.visitDateFrom) {
    clauses.push(
      `a.dtagenda >= TO_DATE('${filters.visitDateFrom}', 'DD/MM/YYYY')`,
    );
  }

  if (filters.visitDateTo) {
    clauses.push(
      `a.dtagenda <= TO_DATE('${filters.visitDateTo}', 'DD/MM/YYYY')`,
    );
  }

  if (filters.voucherType) {
    clauses.push(`voucher.tpvoucher = '${escapeSqlLiteral(filters.voucherType)}'`);
  }

  switch (filters.purchaseLocation) {
    case "site":
      clauses.push("c.tpcompra = 'ponli'");
      break;
    case "reser":
      clauses.push("c.tpcompra = 'reser'");
      break;
    case "parq":
      clauses.push("c.tpcompra = 'bilhe'");
      break;
  }

  if (filters.purchaseStatus) {
    clauses.push(`c.stcompra = '${escapeSqlLiteral(filters.purchaseStatus)}'`);
  }

  if (filters.usedStatus) {
    clauses.push(`voucher.stusado = '${escapeSqlLiteral(filters.usedStatus)}'`);
  }

  return {
    sql: clauses.join(" AND "),
  };
}

export async function listPainelPurchases(input: {
  page?: string | number | null;
  perPage?: string | number | null;
  filters: Record<string, string | string[] | undefined>;
  allRows?: boolean;
}): Promise<PainelPurchaseListResult> {
  const filters = normalizePainelPurchaseListFilters(input.filters);
  const page = Math.max(1, Number(input.page ?? 1) || 1);
  const allRows = input.allRows === true;
  const perPage = allRows
    ? Number.MAX_SAFE_INTEGER
    : Math.min(5000, Math.max(1, Number(input.perPage ?? 30) || 30));
  const offset = (page - 1) * perPage;
  const { sql } = buildPainelPurchaseListWhere(filters);
  const whereClause = sql ? `WHERE ${sql}` : "";
  const pool = getIngressoDbPool();
  const paginationClause = allRows ? "" : `LIMIT ${perPage} OFFSET ${offset}`;

  const rowsResult = await pool.query<PainelPurchaseListRow>(
    `
      SELECT
        compra.idcompra,
        compra.dtcompra::text AS dtcompra,
        compra.tpcompra,
        compra.stcompra,
        compra.formapag,
        compra.vltotcompra::text AS vltotcompra,
        compra.dtpagamento::text AS dtpagamento,
        compra.hrpagamento::text AS hrpagamento,
        compra.cpf,
        usuario.nmusuario,
        pagpagseguro.idpagseguro,
        pagpagseguro.paymentmethodtype,
        pagpagseguro.status
      FROM compra
      LEFT JOIN usuario ON usuario.cpf = compra.cpf
      LEFT JOIN LATERAL (
        SELECT
          pagamento.idpagseguro,
          pagamento.paymentmethodtype,
          pagamento.status
        FROM pagpagseguro AS pagamento
        WHERE pagamento.idcompra = compra.idcompra
        ORDER BY pagamento.idpagseguro DESC
        LIMIT 1
      ) AS pagpagseguro ON true
      ${whereClause}
      ORDER BY compra.dtcompra DESC, compra.idcompra DESC
      ${paginationClause}
    `,
  );

  const countResult = await pool.query<{ total: string }>(
    `
      SELECT COUNT(*)::text AS total
      FROM compra
      LEFT JOIN usuario ON usuario.cpf = compra.cpf
      LEFT JOIN LATERAL (
        SELECT
          pagamento.idpagseguro,
          pagamento.paymentmethodtype,
          pagamento.status
        FROM pagpagseguro AS pagamento
        WHERE pagamento.idcompra = compra.idcompra
        ORDER BY pagamento.idpagseguro DESC
        LIMIT 1
      ) AS pagpagseguro ON true
      ${whereClause}
    `,
  );

  const total = Number(countResult.rows[0]?.total ?? 0);
  const effectivePerPage = allRows ? Math.max(total, rowsResult.rows.length, 1) : perPage;

  return {
    items: rowsResult.rows.map(buildPurchaseListItem),
    total,
    page,
    perPage: effectivePerPage,
    totalPages: Math.max(1, Math.ceil(total / effectivePerPage)),
    filters,
  };
}

function mapPainelPurchaseVoucherIndicators(
  row: PainelPurchaseVoucherIndicatorsRow | null | undefined,
): PainelPurchaseVoucherIndicators {
  const qtdnormal_site = Number(row?.qtdnormal_site ?? 0);
  const qtdinfantil_site = Number(row?.qtdinfantil_site ?? 0);
  const qtdnormal_parque = Number(row?.qtdnormal_parque ?? 0);
  const qtdinfantil_parque = Number(row?.qtdinfantil_parque ?? 0);
  const qtdescola = Number(row?.qtdescola ?? 0);
  const qtdadulto_reserva = Number(row?.qtdadulto_reserva ?? 0);
  const qtdinfantil_reserva = Number(row?.qtdinfantil_reserva ?? 0);
  const qtespecial = Number(row?.qtespecial ?? 0);
  const qtdcortesia = Number(row?.qtdcortesia ?? 0);
  const qtdisento = Number(row?.qtdisento ?? 0);
  const totalCount =
    qtdnormal_site +
    qtdinfantil_site +
    qtdnormal_parque +
    qtdinfantil_parque +
    qtdescola +
    qtdadulto_reserva +
    qtdinfantil_reserva +
    qtespecial +
    qtdcortesia +
    qtdisento;
  const totalValueNumber =
    Number(row?.vlnormal_site ?? 0) +
    Number(row?.vlinfantil_site ?? 0) +
    Number(row?.vlnormal_parque ?? 0) +
    Number(row?.vlinfantil_parque ?? 0) +
    Number(row?.vlescola ?? 0) +
    Number(row?.vladulto_reserva ?? 0) +
    Number(row?.vlinfantil_reserva ?? 0) +
    Number(row?.vlespecial ?? 0);

  return {
    qtdnormal_site,
    vlnormal_site: formatMoneyLabel(row?.vlnormal_site),
    qtdinfantil_site,
    vlinfantil_site: formatMoneyLabel(row?.vlinfantil_site),
    qtdnormal_parque,
    vlnormal_parque: formatMoneyLabel(row?.vlnormal_parque),
    qtdinfantil_parque,
    vlinfantil_parque: formatMoneyLabel(row?.vlinfantil_parque),
    qtdescola,
    vlescola: formatMoneyLabel(row?.vlescola),
    qtdadulto_reserva,
    vladulto_reserva: formatMoneyLabel(row?.vladulto_reserva),
    qtdinfantil_reserva,
    vlinfantil_reserva: formatMoneyLabel(row?.vlinfantil_reserva),
    qtespecial,
    vlespecial: formatMoneyLabel(row?.vlespecial),
    qtdcortesia,
    qtdisento,
    totalCount,
    totalValue: formatMoneyLabel(totalValueNumber),
  };
}

function mapPainelPurchaseVoucherListItem(
  row: PainelPurchaseVoucherListRow,
): PainelPurchaseVoucherListItem {
  const specialDescription = String(row.descricao ?? "").trim();
  const ticketTypeLabel = specialDescription || formatVoucherTypeLabel(row.tpvoucher);

  return {
    purchaseId: Number(row.idcompra),
    voucherId: Number(row.idvoucher),
    voucherNumber: row.numvoucher,
    purchaseDate: formatDateLabel(row.dtcompra),
    visitDate: formatDateLabel(row.dtagenda),
    ticketTypeLabel,
    name: row.identificacao,
    location: String(row.tpcompra ?? "").trim(),
    locationLabel: formatPurchaseLocationLabel(row.tpcompra),
    unitValue: formatMoneyLabel(row.vlunicompra),
    purchaseStatusLabel: formatPurchaseStatusLabel(row.stcompra),
    usedLabel: formatVoucherUsedLabel(row.stusado),
    usedDate: formatDateLabel(row.dtuso),
    usedTime: row.hruso ? String(row.hruso).slice(0, 8) : null,
    purchaseTypeLabel: formatPurchaseTypeLabel(row.tpcompra),
  };
}

export async function listPainelPurchaseVouchers(input: {
  page?: string | number | null;
  perPage?: string | number | null;
  filters: Record<string, string | string[] | undefined>;
  allRows?: boolean;
}): Promise<PainelPurchaseVoucherListResult> {
  const filters = normalizePainelPurchaseVoucherListFilters(input.filters);
  const page = Math.max(1, Number(input.page ?? 1) || 1);
  const allRows = input.allRows === true;
  const perPage = allRows
    ? Number.MAX_SAFE_INTEGER
    : Math.min(5000, Math.max(1, Number(input.perPage ?? 100) || 100));
  const offset = (page - 1) * perPage;
  const { sql } = buildPainelPurchaseVoucherListWhere(filters);
  const whereClause = sql ? `WHERE ${sql}` : "";
  const paginationClause = allRows ? "" : `LIMIT ${perPage} OFFSET ${offset}`;
  const pool = getIngressoDbPool();

  const [rowsResult, countResult, indicatorsResult] = await Promise.all([
    pool.query<PainelPurchaseVoucherListRow>(
      `
        SELECT
          voucher.idcompra,
          voucher.idvoucher,
          voucher.numvoucher,
          c.dtcompra::text AS dtcompra,
          a.dtagenda::text AS dtagenda,
          voucher.tpvoucher,
          voucher.descricao,
          voucher.identificacao,
          c.tpcompra,
          c.stcompra,
          voucher.vlunicompra::text AS vlunicompra,
          voucher.stusado,
          voucher.dtuso::text AS dtuso,
          voucher.hruso::text AS hruso
        FROM voucher
        JOIN compra c ON c.idcompra = voucher.idcompra
        JOIN agenda a ON a.idagenda = voucher.idagenda
        ${whereClause}
        ORDER BY c.dtcompra DESC, voucher.idvoucher DESC
        ${paginationClause}
      `,
    ),
    pool.query<{ total: string }>(
      `
        SELECT COUNT(voucher.idvoucher)::text AS total
        FROM voucher
        JOIN compra c ON c.idcompra = voucher.idcompra
        JOIN agenda a ON a.idagenda = voucher.idagenda
        ${whereClause}
      `,
    ),
    pool.query<PainelPurchaseVoucherIndicatorsRow>(
      `
        SELECT
          SUM(CASE WHEN voucher.tpvoucher = 'norma' AND c.tpcompra = 'ponli' THEN 1 ELSE 0 END)::text AS qtdnormal_site,
          SUM(CASE WHEN voucher.tpvoucher = 'norma' AND c.tpcompra = 'ponli' THEN voucher.vlunicompra ELSE 0 END)::text AS vlnormal_site,
          SUM(CASE WHEN voucher.tpvoucher = 'infan' AND c.tpcompra = 'ponli' THEN 1 ELSE 0 END)::text AS qtdinfantil_site,
          SUM(CASE WHEN voucher.tpvoucher = 'infan' AND c.tpcompra = 'ponli' THEN voucher.vlunicompra ELSE 0 END)::text AS vlinfantil_site,
          SUM(CASE WHEN voucher.tpvoucher = 'norma' AND c.tpcompra = 'bilhe' THEN 1 ELSE 0 END)::text AS qtdnormal_parque,
          SUM(CASE WHEN voucher.tpvoucher = 'norma' AND c.tpcompra = 'bilhe' THEN voucher.vlunicompra ELSE 0 END)::text AS vlnormal_parque,
          SUM(CASE WHEN voucher.tpvoucher = 'infan' AND c.tpcompra = 'bilhe' THEN 1 ELSE 0 END)::text AS qtdinfantil_parque,
          SUM(CASE WHEN voucher.tpvoucher = 'infan' AND c.tpcompra = 'bilhe' THEN voucher.vlunicompra ELSE 0 END)::text AS vlinfantil_parque,
          SUM(CASE WHEN voucher.tpvoucher = 'escol' THEN 1 ELSE 0 END)::text AS qtdescola,
          SUM(CASE WHEN voucher.tpvoucher = 'escol' THEN voucher.vlunicompra ELSE 0 END)::text AS vlescola,
          SUM(CASE WHEN voucher.tpvoucher = 'norma' AND c.tpcompra = 'reser' THEN 1 ELSE 0 END)::text AS qtdadulto_reserva,
          SUM(CASE WHEN voucher.tpvoucher = 'norma' AND c.tpcompra = 'reser' THEN voucher.vlunicompra ELSE 0 END)::text AS vladulto_reserva,
          SUM(CASE WHEN voucher.tpvoucher = 'infan' AND c.tpcompra = 'reser' THEN 1 ELSE 0 END)::text AS qtdinfantil_reserva,
          SUM(CASE WHEN voucher.tpvoucher = 'infan' AND c.tpcompra = 'reser' THEN voucher.vlunicompra ELSE 0 END)::text AS vlinfantil_reserva,
          SUM(CASE WHEN voucher.tpvoucher = 'espec' OR voucher.descricao ILIKE '%especial%' THEN 1 ELSE 0 END)::text AS qtespecial,
          SUM(CASE WHEN voucher.tpvoucher = 'espec' OR voucher.descricao ILIKE '%especial%' THEN voucher.vlunicompra ELSE 0 END)::text AS vlespecial,
          SUM(CASE WHEN voucher.tpvoucher = 'corte' OR voucher.descricao ILIKE '%cortesia%' THEN 1 ELSE 0 END)::text AS qtdcortesia,
          SUM(CASE WHEN voucher.tpvoucher = 'isent' THEN 1 ELSE 0 END)::text AS qtdisento
        FROM voucher
        JOIN compra c ON c.idcompra = voucher.idcompra
        JOIN agenda a ON a.idagenda = voucher.idagenda
        ${whereClause}
      `,
    ),
  ]);

  const total = Number(countResult.rows[0]?.total ?? 0);
  const effectivePerPage = allRows ? Math.max(total, rowsResult.rows.length, 1) : perPage;

  return {
    items: rowsResult.rows.map(mapPainelPurchaseVoucherListItem),
    total,
    page,
    perPage: effectivePerPage,
    totalPages: Math.max(1, Math.ceil(total / effectivePerPage)),
    filters,
    indicators: mapPainelPurchaseVoucherIndicators(indicatorsResult.rows[0]),
  };
}

export function mapPainelPurchaseListExportRows(result: PainelPurchaseListResult) {
  return [
      [
        "ID",
        "Data",
        "Tipo",
        "Status",
        "Pagamento",
        "Data de pagamento",
        "Hora de pagamento",
        "Valor",
        "CPF",
        "Usuario",
      ],
    ...result.items.map((item) => [
      String(item.purchaseId),
      item.purchaseDate ?? "-",
      item.typeLabel,
      item.statusLabel,
      item.paymentLabel,
      item.paymentDate ?? "-",
      item.paymentTime ?? "-",
      item.totalValue,
      item.cpf ?? "-",
      item.userName ?? "-",
    ]),
  ];
}

export function mapPainelPurchaseVoucherListExportRows(
  result: PainelPurchaseVoucherListResult,
) {
  return [
    [
      "ID",
      "Voucher",
      "Data Visita",
      "Passaporte",
      "Tipo Compra",
      "Valor",
      "Usado",
      "Data de uso",
      "Hora de uso",
    ],
    ...result.items.map((item) => [
      String(item.voucherId),
      item.voucherNumber ?? "-",
      item.visitDate ?? "-",
      item.ticketTypeLabel,
      item.purchaseTypeLabel,
      item.unitValue,
      item.usedLabel,
      item.usedDate ?? "-",
      item.usedTime ?? "-",
    ]),
  ];
}

export function renderPainelPurchaseListExportTable(
  rows: string[][],
  title = "Lista de compras / reservas",
) {
  const tableRows = rows
    .map((row, rowIndex) => {
      const cells = row
        .map((cell) =>
          rowIndex === 0
            ? `<th>${escapeHtml(cell)}</th>`
            : `<td>${escapeHtml(cell)}</td>`,
        )
        .join("");

      return `<tr>${cells}</tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body>
    <table border="1">
      <caption>${escapeHtml(title)}</caption>
      ${tableRows}
    </table>
  </body>
</html>`;
}

export async function getPainelPurchaseDetail(
  purchaseId: number,
): Promise<PainelPurchaseDetail> {
  if (!Number.isInteger(purchaseId) || purchaseId <= 0) {
    throw new PainelComprasError(
      "invalid_purchase_id",
      "Compra invalida.",
      400,
    );
  }

  const purchase = await loadPainelPurchaseDetailRow(purchaseId);

  if (!purchase) {
    throw new PainelComprasError(
      "purchase_not_found",
      "Compra nao encontrada.",
      404,
    );
  }

  const pool = getIngressoDbPool();
  const voucherResult = await pool.query<PainelPurchaseDetailVoucherRow>(
    `
      SELECT
        voucher.idvoucher,
        voucher.numvoucher,
        voucher.tpvoucher,
        voucher.descricao,
        voucher.idagenda,
        agenda.dtagenda::text AS dtagenda,
        voucher.idescola,
        clientes.nome AS nmescola,
        voucher.turma,
        voucher.periodo,
        voucher.vlunicompra::text AS vlunicompra,
        voucher.stusado,
        voucher.dtuso::text AS dtuso,
        voucher.hruso::text AS hruso
      FROM voucher
      LEFT JOIN agenda ON agenda.idagenda = voucher.idagenda
      LEFT JOIN clientes ON clientes.idcliente = voucher.idescola
      WHERE voucher.idcompra = $1
      ORDER BY voucher.idvoucher DESC
    `,
    [purchaseId],
  );

  return {
    purchaseId: purchase.idcompra,
    purchaseDate: formatDateLabel(purchase.dtcompra),
    type: String(purchase.tpcompra ?? "").trim(),
    typeLabel: formatPurchaseTypeLabel(purchase.tpcompra),
    status: String(purchase.stcompra ?? "").trim(),
    statusLabel: formatPurchaseStatusLabel(purchase.stcompra),
    paymentLabel: resolveDetailPaymentLabel(purchase),
    paymentMethodLabel: formatGatewayPaymentDetailLabel(purchase.paymentmethodtype),
    paymentDate: formatDateLabel(purchase.dtpagamento),
    paymentTime: purchase.hrpagamento ? String(purchase.hrpagamento).slice(0, 8) : null,
    totalValue: formatMoneyLabel(purchase.vltotcompra),
    cpf: purchase.cpf,
    userName: purchase.nmusuario,
    referralCode: String(purchase.codindica ?? "").trim() || null,
    gatewayPaymentId: purchase.idpagseguro ? String(purchase.idpagseguro) : null,
    gatewayStatusCode:
      purchase.status !== null && purchase.status !== undefined
        ? String(purchase.status).trim() || null
        : null,
    gatewayStatusLabel:
      purchase.status !== null && purchase.status !== undefined
        ? formatGatewayStatusLabel(purchase.status)
        : null,
    vouchers: voucherResult.rows.map((voucher) => ({
      voucherId: voucher.idvoucher,
      voucherNumber: voucher.numvoucher,
      visitDate: formatDateLabel(voucher.dtagenda),
      voucherType: String(voucher.tpvoucher ?? "").trim(),
      voucherTypeLabel:
        String(voucher.descricao ?? "").trim() || formatVoucherTypeLabel(voucher.tpvoucher),
      schoolName: voucher.nmescola,
      className: voucher.turma,
      periodName: voucher.periodo,
      unitValue: formatMoneyLabel(voucher.vlunicompra),
      used: String(voucher.stusado ?? "").trim(),
      usedLabel: formatVoucherUsedLabel(voucher.stusado),
      usedDate: formatDateLabel(voucher.dtuso),
      usedTime: voucher.hruso ? String(voucher.hruso).slice(0, 8) : null,
      schoolTripHref: buildSchoolTripHref(voucher.idagenda, voucher.idescola),
    })),
  };
}

export async function getPainelPurchaseGatewayConsult(
  purchaseId: number,
): Promise<PainelPurchaseGatewayConsultResult> {
  if (!Number.isInteger(purchaseId) || purchaseId <= 0) {
    throw new PainelComprasError(
      "invalid_purchase_id",
      "Compra invalida.",
      400,
    );
  }

  const purchase = await loadPainelPurchaseDetailRow(purchaseId);

  if (!purchase) {
    throw new PainelComprasError(
      "purchase_not_found",
      "Compra nao encontrada.",
      404,
    );
  }

  const pool = getIngressoDbPool();
  const ledgerResult = await pool.query<PainelPurchaseGatewayLedgerRow>(
    `
      SELECT
        pagpagseguro.idpagseguro AS payment_id,
        pagpagseguro.reference
      FROM pagpagseguro
      WHERE pagpagseguro.idcompra = $1
      ORDER BY pagpagseguro.date DESC NULLS LAST, pagpagseguro.idpagseguro DESC
      LIMIT 1
    `,
    [purchaseId],
  );
  const ledger = ledgerResult.rows[0] ?? null;

  if (!isCieloEcommerceConfigured()) {
    return {
      purchaseId,
      found: false,
      message: "Dados nao encontrados na Cielo",
      statusCode: null,
      statusLabel: null,
      paymentMethodType: null,
      paymentMethodLabel: null,
      grossAmount: "0,00",
      feeAmount: "0,00",
      netAmount: "0,00",
      paymentDate: null,
      startedAt: null,
      finishedAt: null,
      senderName: null,
      senderEmail: null,
      senderPhone: null,
    };
  }

  const payload = await getNativeCieloCheckoutStatus({
    paymentId: String(ledger?.payment_id ?? "").trim() || null,
    reference: String(ledger?.reference ?? "").trim() || String(purchaseId),
    purchaseId,
  });

  if (payload.status !== "00") {
    return {
      purchaseId,
      found: false,
      message: readStringValue(readObject(payload), ["msgRetorno"]) || "Dados nao encontrados na Cielo",
      statusCode: null,
      statusLabel: null,
      paymentMethodType: null,
      paymentMethodLabel: null,
      grossAmount: "0,00",
      feeAmount: "0,00",
      netAmount: "0,00",
      paymentDate: null,
      startedAt: null,
      finishedAt: null,
      senderName: null,
      senderEmail: null,
      senderPhone: null,
    };
  }

  const normalized = normalizePaymentReconciliationPayload(payload, purchaseId);

  return {
    purchaseId,
    found: true,
    message: "Consulta manual do gateway executada com sucesso.",
    statusCode: normalized.status,
    statusLabel: formatGatewayStatusLabel(normalized.status),
    paymentMethodType: normalized.paymentMethodType,
    paymentMethodLabel: formatGatewayPaymentMethodLabel(
      normalized.paymentMethodType,
    ),
    grossAmount: formatMoneyLabel(normalized.grossAmount),
    feeAmount: formatMoneyLabel(normalized.feeAmount),
    netAmount: formatMoneyLabel(normalized.netAmount),
    paymentDate: normalized.lastEventDate.toISOString(),
    startedAt: normalized.date.toISOString(),
    finishedAt: normalized.lastEventDate.toISOString(),
    senderName: normalized.senderName || null,
    senderEmail: normalized.senderEmail || null,
    senderPhone:
      normalized.senderPhoneNumber != null
        ? `${normalized.senderPhoneAreaCode ?? ""} ${normalized.senderPhoneNumber}`.trim()
        : null,
  };
}

export function asPainelComprasError(error: unknown) {
  if (error instanceof PainelComprasError) {
    return error;
  }

  return new PainelComprasError(
    "painel_compras_unavailable",
    "Nao foi possivel carregar os dados de compras agora.",
    502,
  );
}
