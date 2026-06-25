import { processCodindicaCashback } from "@/lib/codindica-cashback";
import { getIngressoDbPool } from "@/lib/ingresso-db";

type RawCodIndicaRow = {
  codindica: string;
  nmrepresentante: string | null;
  email: string | null;
  validade: string | null;
  stcodindica: string | null;
  vlvendanormal: string | null;
  vlvendainfant: string | null;
  vldescnormal: string | null;
  vldescinfant: string | null;
  vlcashback: string | null;
  vlcashbacknormal: string | null;
  vlcashbackinfant: string | null;
  flpromocional: string | null;
  vldescpromonormal: string | null;
  vlcashbackpromonormal: string | null;
  vlcashbackpromoinfant: string | null;
  percomissao: string | null;
};

type RawCashbackPaymentRow = {
  idpagamento: number;
  dtpagamento: string | null;
  hrpagamento: string | null;
  vlpagamento: string | null;
  nmgerente: string | null;
  dsobservacao: string | null;
};

type RawPurchaseRow = {
  idcompra: number;
  dtcompra: string | null;
  hrcompra: string | null;
  cpf: string | null;
  nmusuario: string | null;
  status: string | null;
  paymentmethodtype: string | number | null;
  formapag: string | null;
  dtpagamento: string | null;
  hrpagamento: string | null;
  vltotcompra: string | null;
  vltotdesc: string | null;
  vlcashback: string | null;
  stcompra: string | null;
};

type RawReportRow = {
  idcompra: number;
  codindica: string;
  nmrepresentante: string | null;
  nmusuario: string | null;
  cpf: string | null;
  dtpagamento: string | null;
  vltotcompra: string | null;
  vltotdesc: string | null;
  vlcashback: string | null;
  tpcashback: string | null;
};

export type PainelCodIndicaListItem = {
  codigo: string;
  representante: string;
  validade: string | null;
  validadeLabel: string;
  status: string;
  statusLabel: string;
};

export type PainelCodIndicaListResult = {
  items: PainelCodIndicaListItem[];
  page: number;
  perPage: number;
  total: number;
  pageCount: number;
  start: number;
  end: number;
  filters: PainelCodIndicaListFilters;
};

export type PainelCodIndicaListFilters = {
  codigo: string;
  representante: string;
  validadeDe: string;
  validadeAte: string;
  status: string;
};

export type PainelCodIndicaFormValues = {
  codindica: string;
  nmrepresentante: string;
  validade: string;
  discountValue: string;
  cashbackPercent: string;
  stcodindica: string;
  email: string;
};

export type PainelCodIndicaMessageValues = {
  codval: string;
  codven: string;
  codine: string;
};

export type PainelCodIndicaMessageData = PainelCodIndicaMessageValues;

export type PainelCodIndicaCashbackSummary = {
  gerado: string;
  pago: string;
  disponivel: string;
};

export type PainelCodIndicaPayment = {
  id: number;
  dataLabel: string;
  horaLabel: string;
  valorLabel: string;
  gerente: string;
  observacao: string;
};

export type PainelCodIndicaPurchase = {
  purchaseId: number;
  purchaseDateLabel: string;
  purchaseTimeLabel: string;
  cpfLabel: string;
  userName: string;
  paymentLabel: string;
  paymentMethodLabel: string;
  paymentDateLabel: string;
  paymentTimeLabel: string;
  totalValueLabel: string;
  discountValueLabel: string;
  cashbackValueLabel: string;
  status: string;
  statusLabel: string;
  canReprocess: boolean;
  detailHref: string;
};

export type PainelCodIndicaIndicators = {
  totalPagasLabel: string;
  totalNaoPagasLabel: string;
  totalDescontoLabel: string;
  cashbackGeradoLabel: string;
  cashbackPagoLabel: string;
  cashbackDisponivelLabel: string;
};

export type PainelCodIndicaDetail = {
  codigo: string;
  representante: string;
  email: string;
  validadeLabel: string;
  status: string;
  statusLabel: string;
  valores: {
    adultoLabel: string;
    criancaLabel: string;
    cashbackAdultoLabel: string;
    cashbackCriancaLabel: string;
    promoLabel: string;
    descontoPromoLabel: string;
    cashbackPromoAdultoLabel: string;
    cashbackPromoCriancaLabel: string;
  };
  indicators: PainelCodIndicaIndicators;
  cashbackSummary: PainelCodIndicaCashbackSummary;
  payments: PainelCodIndicaPayment[];
  purchases: PainelCodIndicaPurchase[];
  filters: PainelCodIndicaDetailFilters;
};

export type PainelCodIndicaDetailFilters = {
  idcompra: string;
  cpf: string;
  nmusuario: string;
  dtcompraDe: string;
  dtcompraAte: string;
  dtpagamentoDe: string;
  dtpagamentoAte: string;
  paymentmethodtype: string;
  status: string;
  stcompra: string;
};

export type PainelCodIndicaReportRow = {
  purchaseId: number;
  buyerName: string;
  cpfLabel: string;
  paymentDateLabel: string;
  totalValueLabel: string;
  discountValueLabel: string;
  cashbackValueLabel: string;
  cashbackTypeLabel: string;
};

export type PainelCodIndicaReportData = {
  codigo: string;
  representante: string;
  dateFrom: string;
  dateTo: string;
  dateFromLabel: string;
  dateToLabel: string;
  totalCashbackLabel: string;
  rows: PainelCodIndicaReportRow[];
};

export type PainelCodIndicaCashbackPaymentValues = {
  vlpagamento: string;
  senha_admin: string;
  dsobservacao: string;
};

export class PainelCodIndicaError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "PainelCodIndicaError";
    this.code = code;
    this.status = status;
  }
}

const statusLabels: Record<string, string> = {
  ati: "Ativo",
  ina: "Inativo",
};

const purchaseStatusLabels: Record<string, string> = {
  pend: "Pendente",
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

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeCode(value: unknown) {
  return normalizeText(value).toUpperCase();
}

function parsePositiveInteger(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toDbMoney(value: unknown) {
  const raw = String(value ?? "").trim().replace(/^R\$\s*/i, "");
  if (!raw) {
    return "0.00";
  }

  const normalized =
    raw.includes(",") && raw.includes(".")
      ? raw.replace(/\./g, "").replace(",", ".")
      : raw.includes(",")
        ? raw.replace(",", ".")
        : raw;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed.toFixed(2) : "0.00";
}

function formatMoneyLabel(value: string | number | null | undefined) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(toNumber(value));
}

function normalizeDateInput(value: unknown) {
  const raw = normalizeText(value);
  if (!raw) {
    return "";
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  const match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (match) {
    return `${match[3]}-${match[2]}-${match[1]}`;
  }

  return raw;
}

function formatDateLabel(value: string | null | undefined) {
  const normalized = String(value ?? "").slice(0, 10);
  if (!normalized) {
    return "-";
  }
  const [year, month, day] = normalized.split("-");
  return year && month && day ? `${day}/${month}/${year}` : normalized;
}

function formatTimeLabel(value: string | null | undefined) {
  const normalized = String(value ?? "").trim();
  return normalized ? normalized.slice(0, 5) : "-";
}

function formatCpfLabel(value: string | null | undefined) {
  const digits = String(value ?? "").replace(/\D+/g, "");
  if (digits.length !== 11) {
    return value ? String(value) : "-";
  }

  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function normalizeStatus(value: unknown) {
  const normalized = normalizeText(value).toLowerCase();
  return normalized === "ina" ? "ina" : "ati";
}

function statusLabel(value: string | null | undefined) {
  const normalized = normalizeText(value).toLowerCase();
  return statusLabels[normalized] ?? "-";
}

function purchaseStatusLabel(value: string | null | undefined) {
  const normalized = normalizeText(value).toLowerCase();
  return purchaseStatusLabels[normalized] ?? "-";
}

function ticketPaymentMethodLabel(value: string | null | undefined) {
  const normalized = normalizeText(value).toLowerCase();
  return ticketPaymentMethodLabels[normalized] ?? "-";
}

function gatewayPaymentMethodLabel(value: string | number | null | undefined) {
  const normalized = String(value ?? "").trim();
  return normalized ? gatewayPaymentMethodLabels[normalized] ?? normalized : "-";
}

function gatewayStatusLabel(value: string | number | null | undefined) {
  const normalized = String(value ?? "").trim();
  return normalized ? gatewayStatusLabels[normalized] ?? normalized : "-";
}

function buildPaymentLabel(row: RawPurchaseRow) {
  const purchaseType = normalizeText(row.stcompra);
  if (normalizeText(row.status) && purchaseType === "conc") {
    return `Cielo ${row.status} - ${gatewayStatusLabel(row.status)}`;
  }
  return "-";
}

function buildPaymentMethodLabel(row: RawPurchaseRow) {
  if (row.paymentmethodtype !== null && row.paymentmethodtype !== undefined) {
    return gatewayPaymentMethodLabel(row.paymentmethodtype);
  }
  return ticketPaymentMethodLabel(row.formapag);
}

function paginate<T>(items: T[], page: number, perPage: number) {
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(Math.max(page, 1), pageCount);
  const startIndex = (safePage - 1) * perPage;
  const current = items.slice(startIndex, startIndex + perPage);
  return {
    items: current,
    page: safePage,
    perPage,
    total,
    pageCount,
    start: total === 0 ? 0 : startIndex + 1,
    end: total === 0 ? 0 : startIndex + current.length,
  };
}

function buildListFilters(input: Record<string, unknown>): PainelCodIndicaListFilters {
  return {
    codigo: normalizeCode(input.codindica),
    representante: normalizeText(input.nmrepresentante),
    validadeDe: normalizeDateInput(input["validade[de]"] ?? input.validadeDe),
    validadeAte: normalizeDateInput(input["validade[ate]"] ?? input.validadeAte),
    status: normalizeText(input.stcodindica),
  };
}

function buildDetailFilters(input: Record<string, unknown>): PainelCodIndicaDetailFilters {
  return {
    idcompra: normalizeText(input.idcompra),
    cpf: String(input.cpf ?? "").replace(/\D+/g, ""),
    nmusuario: normalizeText(input.nmusuario),
    dtcompraDe: normalizeDateInput(input["dtcompra[de]"] ?? input.dtcompraDe),
    dtcompraAte: normalizeDateInput(input["dtcompra[ate]"] ?? input.dtcompraAte),
    dtpagamentoDe: normalizeDateInput(input["dtpagamento[de]"] ?? input.dtpagamentoDe),
    dtpagamentoAte: normalizeDateInput(input["dtpagamento[ate]"] ?? input.dtpagamentoAte),
    paymentmethodtype: normalizeText(input.paymentmethodtype),
    status: normalizeText(input.status),
    stcompra: normalizeText(input.stcompra),
  };
}

function assertValidCode(codigo: string) {
  if (!codigo || codigo.length !== 6) {
    throw new PainelCodIndicaError(
      "invalid_codindica",
      "Informe um codigo de indicacao valido.",
      400,
    );
  }
}

type PainelCodIndicaNormalizedPayload = {
  codindica: string;
  nmrepresentante: string;
  validade: string;
  tpdesconto: string;
  vldescnormal: string;
  vldescinfant: string;
  tpcashback: string;
  vlcashback: string;
  percomissao: string;
  vlvendanormal: string;
  vlvendainfant: string;
  vlcashbackpadrao: string;
  vlcashbacknormal: string;
  vlcashbackinfant: string;
  flpromocional: string;
  vldescpromonormal: string;
  vldescpromoinfant: string;
  vlcashbackpromo: string;
  vlcashbackpromonormal: string;
  vlcashbackpromoinfant: string;
  stcodindica: string;
  email: string;
};

type PainelCodIndicaCreatePayload = PainelCodIndicaNormalizedPayload & {
  usucadastro: string | null;
  dtcadastro: string;
  hrcadastro: string;
};

function normalizeFormPayload(
  values: PainelCodIndicaFormValues,
  mode: "create",
): PainelCodIndicaCreatePayload;
function normalizeFormPayload(
  values: PainelCodIndicaFormValues,
  mode: "edit",
): PainelCodIndicaNormalizedPayload;
function normalizeFormPayload(values: PainelCodIndicaFormValues, mode: "create" | "edit") {
  const codigo = normalizeCode(values.codindica);
  const validade = normalizeDateInput(values.validade);
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const discountValue = toDbMoney(values.discountValue);
  const cashbackPercent = toDbMoney(values.cashbackPercent);

  assertValidCode(codigo);

  if (!values.nmrepresentante.trim()) {
    throw new PainelCodIndicaError("invalid_rep_name", "Informe o representante.", 400);
  }

  if (!validade) {
    throw new PainelCodIndicaError("invalid_validity", "Informe a validade.", 400);
  }

  if (validade < todayIso) {
    throw new PainelCodIndicaError(
      "invalid_validity",
      "O campo Validade nao pode ser menor que a data atual.",
      400,
    );
  }

  if (!values.email.trim()) {
    throw new PainelCodIndicaError("invalid_email", "Informe o email.", 400);
  }

  const payload = {
    codindica: codigo,
    nmrepresentante: normalizeText(values.nmrepresentante),
    validade,
    tpdesconto: "fixo",
    vldescnormal: discountValue,
    vldescinfant: discountValue,
    tpcashback: "percentual",
    vlcashback: cashbackPercent,
    percomissao: cashbackPercent,
    vlvendanormal: "0.00",
    vlvendainfant: "0.00",
    vlcashbackpadrao: "0.00",
    vlcashbacknormal: "0.00",
    vlcashbackinfant: "0.00",
    flpromocional: "n",
    vldescpromonormal: "0.00",
    vldescpromoinfant: "0.00",
    vlcashbackpromo: "0.00",
    vlcashbackpromonormal: "0.00",
    vlcashbackpromoinfant: "0.00",
    stcodindica: normalizeStatus(values.stcodindica),
    email: normalizeText(values.email),
  };

  if (mode === "create") {
    return {
      ...payload,
      usucadastro: null as string | null,
      dtcadastro: new Date().toISOString().slice(0, 10),
      hrcadastro: new Date().toTimeString().slice(0, 8),
    };
  }

  return payload;
}

export function decodeLegacyCodIndicaCode(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  try {
    const decoded = Buffer.from(value, "base64").toString("utf8").trim().toUpperCase();
    return decoded || null;
  } catch {
    return null;
  }
}

function mapListItem(row: RawCodIndicaRow): PainelCodIndicaListItem {
  return {
    codigo: row.codindica,
    representante: row.nmrepresentante ?? "-",
    validade: row.validade,
    validadeLabel: formatDateLabel(row.validade),
    status: normalizeText(row.stcodindica),
    statusLabel: statusLabel(row.stcodindica),
  };
}

function buildListWhere(filters: PainelCodIndicaListFilters) {
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (filters.codigo) {
    params.push(filters.codigo);
    clauses.push(`codindica.codindica = $${params.length}`);
  }
  if (filters.representante) {
    params.push(`%${filters.representante}%`);
    clauses.push(`codindica.nmrepresentante ILIKE $${params.length}`);
  }
  if (filters.validadeDe) {
    params.push(filters.validadeDe);
    clauses.push(`codindica.validade >= $${params.length}::date`);
  }
  if (filters.validadeAte) {
    params.push(filters.validadeAte);
    clauses.push(`codindica.validade <= $${params.length}::date`);
  }
  if (filters.status && filters.status !== "-1") {
    params.push(filters.status);
    clauses.push(`codindica.stcodindica = $${params.length}`);
  }

  return {
    where: clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "",
    params,
  };
}

function buildPurchaseWhere(codigo: string, filters: PainelCodIndicaDetailFilters) {
  const clauses = [`compra.codindica = $1`];
  const params: unknown[] = [codigo];

  if (filters.idcompra) {
    params.push(Number(filters.idcompra));
    clauses.push(`compra.idcompra = $${params.length}`);
  }
  if (filters.cpf) {
    params.push(filters.cpf);
    clauses.push(`regexp_replace(COALESCE(compra.cpf, ''), '\\D', '', 'g') = $${params.length}`);
  }
  if (filters.nmusuario) {
    params.push(`%${filters.nmusuario}%`);
    clauses.push(`usuario.nmusuario ILIKE $${params.length}`);
  }
  if (filters.dtcompraDe) {
    params.push(filters.dtcompraDe);
    clauses.push(`compra.dtcompra >= $${params.length}::date`);
  }
  if (filters.dtcompraAte) {
    params.push(filters.dtcompraAte);
    clauses.push(`compra.dtcompra <= $${params.length}::date`);
  }
  if (filters.dtpagamentoDe) {
    params.push(filters.dtpagamentoDe);
    clauses.push(`compra.dtpagamento >= $${params.length}::date`);
  }
  if (filters.dtpagamentoAte) {
    params.push(filters.dtpagamentoAte);
    clauses.push(`compra.dtpagamento <= $${params.length}::date`);
  }
  if (filters.paymentmethodtype && filters.paymentmethodtype !== "-1") {
    params.push(filters.paymentmethodtype);
    clauses.push(`pagpagseguro.paymentmethodtype::text = $${params.length}`);
  }
  if (filters.status && filters.status !== "-1") {
    params.push(filters.status);
    clauses.push(`pagpagseguro.status::text = $${params.length}`);
  }
  if (filters.stcompra && filters.stcompra !== "-1") {
    params.push(filters.stcompra);
    clauses.push(`compra.stcompra = $${params.length}`);
  }

  return {
    where: `WHERE ${clauses.join(" AND ")}`,
    params,
  };
}

async function loadCodIndicaByCode(codigo: string) {
  const pool = getIngressoDbPool();
  const result = await pool.query<RawCodIndicaRow>(
    `SELECT * FROM codindica WHERE codindica = $1 LIMIT 1`,
    [codigo],
  );
  return result.rows[0] ?? null;
}

async function loadCashbackSummary(codigo: string) {
  const pool = getIngressoDbPool();
  const generated = await pool.query<{ total: string }>(
    `
      SELECT COALESCE(SUM(hist.vlcashback), 0)::text AS total
      FROM codindica_cashback hist
      JOIN compra ON compra.idcompra = hist.idcompra
      WHERE hist.codindica = $1
        AND hist.stcashback = 'gerado'
        AND compra.stcompra = 'conc'
    `,
    [codigo],
  );
  const paid = await pool.query<{ total: string }>(
    `
      SELECT COALESCE(SUM(vlpagamento), 0)::text AS total
      FROM codindica_cashback_pagamento
      WHERE codindica = $1
    `,
    [codigo],
  ).catch(() => ({ rows: [{ total: "0.00" }] }));

  const generatedValue = toNumber(generated.rows[0]?.total);
  const paidValue = toNumber(paid.rows[0]?.total);
  const available = Math.max(Number((generatedValue - paidValue).toFixed(2)), 0);

  return {
    gerado: generatedValue.toFixed(2),
    pago: paidValue.toFixed(2),
    disponivel: available.toFixed(2),
  };
}

async function loadCashbackAdminPassword() {
  const pool = getIngressoDbPool();
  const result = await pool.query<{ vlparametro: string | null }>(
    `
      SELECT vlparametro
      FROM parametro
      WHERE idparametro = 'codcash'
      LIMIT 1
    `,
  );

  return normalizeText(result.rows[0]?.vlparametro);
}

async function ensureCashbackPaymentTable() {
  const pool = getIngressoDbPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS codindica_cashback_pagamento (
      idpagamento BIGSERIAL PRIMARY KEY,
      codindica VARCHAR(6) NOT NULL,
      nmrepresentante VARCHAR(255),
      email VARCHAR(255),
      vlpagamento NUMERIC(12,2) NOT NULL DEFAULT 0,
      dsobservacao VARCHAR(255),
      cpfgerente VARCHAR(20),
      nmgerente VARCHAR(255),
      dtpagamento DATE NOT NULL DEFAULT CURRENT_DATE,
      hrpagamento TIME NOT NULL DEFAULT CURRENT_TIME
    )
  `);
}

async function loadCashbackPayments(codigo: string) {
  const pool = getIngressoDbPool();
  const result = await pool
    .query<RawCashbackPaymentRow>(
      `
        SELECT idpagamento, dtpagamento::text AS dtpagamento, hrpagamento::text AS hrpagamento,
               vlpagamento::text AS vlpagamento, nmgerente, dsobservacao
        FROM codindica_cashback_pagamento
        WHERE codindica = $1
        ORDER BY dtpagamento DESC, hrpagamento DESC, idpagamento DESC
        LIMIT 30
      `,
      [codigo],
    )
    .catch(() => ({ rows: [] as RawCashbackPaymentRow[] }));

  return result.rows.map((row) => ({
    id: row.idpagamento,
    dataLabel: formatDateLabel(row.dtpagamento),
    horaLabel: formatTimeLabel(row.hrpagamento),
    valorLabel: formatMoneyLabel(row.vlpagamento),
    gerente: row.nmgerente ?? "-",
    observacao: row.dsobservacao ?? "-",
  }));
}

async function loadPurchaseIndicators(
  codigo: string,
  filters: PainelCodIndicaDetailFilters,
  summary: PainelCodIndicaCashbackSummary,
) {
  const pool = getIngressoDbPool();
  const { where, params } = buildPurchaseWhere(codigo, filters);
  const result = await pool.query<{
    total_pagas: string;
    total_nao_pagas: string;
    total_desconto: string;
  }>(
    `
      SELECT
        COALESCE(SUM(CASE WHEN compra.stcompra = 'conc' THEN compra.vltotcompra ELSE 0 END), 0)::text AS total_pagas,
        COALESCE(SUM(CASE WHEN compra.stcompra = 'pend' THEN compra.vltotcompra ELSE 0 END), 0)::text AS total_nao_pagas,
        COALESCE(SUM(CASE WHEN compra.stcompra = 'conc' THEN compra.vltotdesc ELSE 0 END), 0)::text AS total_desconto
      FROM compra
      LEFT JOIN usuario ON usuario.cpf = compra.cpf
      LEFT JOIN LATERAL (
        SELECT idpagseguro, paymentmethodtype, status
        FROM pagpagseguro
        WHERE pagpagseguro.idcompra = compra.idcompra
        ORDER BY idpagseguro DESC
        LIMIT 1
      ) AS pagpagseguro ON true
      ${where}
    `,
    params,
  );

  return {
    totalPagasLabel: formatMoneyLabel(result.rows[0]?.total_pagas),
    totalNaoPagasLabel: formatMoneyLabel(result.rows[0]?.total_nao_pagas),
    totalDescontoLabel: formatMoneyLabel(result.rows[0]?.total_desconto),
    cashbackGeradoLabel: formatMoneyLabel(summary.gerado),
    cashbackPagoLabel: formatMoneyLabel(summary.pago),
    cashbackDisponivelLabel: formatMoneyLabel(summary.disponivel),
  } satisfies PainelCodIndicaIndicators;
}

async function loadPurchases(codigo: string, filters: PainelCodIndicaDetailFilters) {
  const pool = getIngressoDbPool();
  const { where, params } = buildPurchaseWhere(codigo, filters);
  const result = await pool.query<RawPurchaseRow>(
    `
      SELECT
        compra.idcompra,
        compra.dtcompra::text AS dtcompra,
        compra.hrcompra::text AS hrcompra,
        compra.cpf,
        usuario.nmusuario,
        pagpagseguro.status,
        pagpagseguro.paymentmethodtype,
        compra.formapag,
        compra.dtpagamento::text AS dtpagamento,
        compra.hrpagamento::text AS hrpagamento,
        compra.vltotcompra::text AS vltotcompra,
        compra.vltotdesc::text AS vltotdesc,
        COALESCE(codindica_cashback.vlcashback, compra.vlcashback, compra.vlcomiss, 0)::text AS vlcashback,
        compra.stcompra
      FROM compra
      LEFT JOIN usuario ON usuario.cpf = compra.cpf
      LEFT JOIN LATERAL (
        SELECT idpagseguro, paymentmethodtype, status
        FROM pagpagseguro
        WHERE pagpagseguro.idcompra = compra.idcompra
        ORDER BY idpagseguro DESC
        LIMIT 1
      ) AS pagpagseguro ON true
      LEFT JOIN codindica_cashback ON codindica_cashback.idcompra = compra.idcompra
      ${where}
      ORDER BY compra.idcompra DESC
      LIMIT 30
    `,
    params,
  );

  return result.rows.map((row) => {
    const cashbackValue = toNumber(row.vlcashback);
    const canReprocess = normalizeText(row.stcompra) === "conc" && cashbackValue <= 0;
    return {
      purchaseId: row.idcompra,
      purchaseDateLabel: formatDateLabel(row.dtcompra),
      purchaseTimeLabel: formatTimeLabel(row.hrcompra),
      cpfLabel: formatCpfLabel(row.cpf),
      userName: row.nmusuario ?? "-",
      paymentLabel: buildPaymentLabel(row),
      paymentMethodLabel: buildPaymentMethodLabel(row),
      paymentDateLabel: formatDateLabel(row.dtpagamento),
      paymentTimeLabel: formatTimeLabel(row.hrpagamento),
      totalValueLabel: formatMoneyLabel(row.vltotcompra),
      discountValueLabel: formatMoneyLabel(row.vltotdesc),
      cashbackValueLabel: formatMoneyLabel(row.vlcashback),
      status: normalizeText(row.stcompra),
      statusLabel: purchaseStatusLabel(row.stcompra),
      canReprocess,
      detailHref: `/painel/compras/${row.idcompra}`,
    } satisfies PainelCodIndicaPurchase;
  });
}

export async function listPainelCodIndica(input: {
  page?: unknown;
  perPage?: unknown;
  filters?: Record<string, unknown>;
}) {
  const filters = buildListFilters(input.filters ?? {});
  const { where, params } = buildListWhere(filters);
  const page = parsePositiveInteger(input.page, 1);
  const perPage = parsePositiveInteger(input.perPage, 30);
  const pool = getIngressoDbPool();
  const result = await pool.query<RawCodIndicaRow>(
    `
      SELECT codindica, nmrepresentante, validade::text AS validade, stcodindica
      FROM codindica
      ${where}
      ORDER BY nmrepresentante ASC
    `,
    params,
  );

  const mapped = result.rows.map(mapListItem);
  return {
    ...paginate(mapped, page, perPage),
    filters,
  } satisfies PainelCodIndicaListResult;
}

export async function getPainelCodIndica(codigo: string) {
  const normalizedCode = normalizeCode(codigo);
  assertValidCode(normalizedCode);
  const found = await loadCodIndicaByCode(normalizedCode);
  if (!found) {
    throw new PainelCodIndicaError(
      "codindica_not_found",
      "Codigo de indicacao nao encontrado.",
      404,
    );
  }
  return found;
}

export function mapPainelCodIndicaToFormValues(
  row: RawCodIndicaRow,
): PainelCodIndicaFormValues {
  return {
    codindica: row.codindica,
    nmrepresentante: row.nmrepresentante ?? "",
    validade: normalizeDateInput(row.validade),
    discountValue: toDbMoney(row.vldescnormal),
    cashbackPercent: toDbMoney(row.vlcashback ?? row.percomissao),
    stcodindica: normalizeStatus(row.stcodindica),
    email: row.email ?? "",
  };
}

export async function createPainelCodIndica(
  values: PainelCodIndicaFormValues,
  actorCpf?: string | null,
) {
  const payload = normalizeFormPayload(values, "create");
  const pool = getIngressoDbPool();
  const existing = await loadCodIndicaByCode(payload.codindica);
  if (existing) {
    throw new PainelCodIndicaError(
      "codindica_exists",
      `Codigo de Indicacao ${payload.codindica} ja existe.`,
      409,
    );
  }

  await pool.query(
    `
      INSERT INTO codindica (
        codindica, nmrepresentante, validade, tpdesconto, vldescnormal, vldescinfant,
        tpcashback, vlcashback, percomissao, vlvendanormal, vlvendainfant,
        vlcashbackpadrao, vlcashbacknormal, vlcashbackinfant, flpromocional,
        vldescpromonormal, vldescpromoinfant, vlcashbackpromo, vlcashbackpromonormal,
        vlcashbackpromoinfant, stcodindica, email, usucadastro, dtcadastro, hrcadastro
      ) VALUES (
        $1,$2,$3::date,$4,$5::numeric,$6::numeric,$7,$8::numeric,$9::numeric,$10::numeric,$11::numeric,
        $12::numeric,$13::numeric,$14::numeric,$15,$16::numeric,$17::numeric,$18::numeric,$19::numeric,
        $20::numeric,$21,$22,$23,$24::date,$25::time
      )
    `,
    [
      payload.codindica,
      payload.nmrepresentante,
      payload.validade,
      payload.tpdesconto,
      payload.vldescnormal,
      payload.vldescinfant,
      payload.tpcashback,
      payload.vlcashback,
      payload.percomissao,
      payload.vlvendanormal,
      payload.vlvendainfant,
      payload.vlcashbackpadrao,
      payload.vlcashbacknormal,
      payload.vlcashbackinfant,
      payload.flpromocional,
      payload.vldescpromonormal,
      payload.vldescpromoinfant,
      payload.vlcashbackpromo,
      payload.vlcashbackpromonormal,
      payload.vlcashbackpromoinfant,
      payload.stcodindica,
      payload.email,
      actorCpf ?? null,
      payload.dtcadastro,
      payload.hrcadastro,
    ],
  );

  return { codigo: payload.codindica, message: "Codigo de indicacao cadastrado com sucesso." };
}

export async function updatePainelCodIndica(
  codigo: string,
  values: PainelCodIndicaFormValues,
  actorCpf?: string | null,
) {
  const currentCode = normalizeCode(codigo);
  const payload = normalizeFormPayload({ ...values, codindica: currentCode }, "edit");
  await getPainelCodIndica(currentCode);
  const pool = getIngressoDbPool();

  await pool.query(
    `
      UPDATE codindica
      SET
        nmrepresentante = $2,
        validade = $3::date,
        tpdesconto = $4,
        vldescnormal = $5::numeric,
        vldescinfant = $6::numeric,
        tpcashback = $7,
        vlcashback = $8::numeric,
        percomissao = $9::numeric,
        vlvendanormal = $10::numeric,
        vlvendainfant = $11::numeric,
        vlcashbackpadrao = $12::numeric,
        vlcashbacknormal = $13::numeric,
        vlcashbackinfant = $14::numeric,
        flpromocional = $15,
        vldescpromonormal = $16::numeric,
        vldescpromoinfant = $17::numeric,
        vlcashbackpromo = $18::numeric,
        vlcashbackpromonormal = $19::numeric,
        vlcashbackpromoinfant = $20::numeric,
        stcodindica = $21,
        email = $22,
        dtualt = CURRENT_DATE,
        hrualt = CURRENT_TIME,
        usualt = $23
      WHERE codindica = $1
    `,
    [
      currentCode,
      payload.nmrepresentante,
      payload.validade,
      payload.tpdesconto,
      payload.vldescnormal,
      payload.vldescinfant,
      payload.tpcashback,
      payload.vlcashback,
      payload.percomissao,
      payload.vlvendanormal,
      payload.vlvendainfant,
      payload.vlcashbackpadrao,
      payload.vlcashbacknormal,
      payload.vlcashbackinfant,
      payload.flpromocional,
      payload.vldescpromonormal,
      payload.vldescpromoinfant,
      payload.vlcashbackpromo,
      payload.vlcashbackpromonormal,
      payload.vlcashbackpromoinfant,
      payload.stcodindica,
      payload.email,
      actorCpf ?? null,
    ],
  );

  return { codigo: currentCode, message: "Codigo de indicacao atualizado com sucesso." };
}

export async function setPainelCodIndicaStatus(codigo: string, status: string) {
  const normalizedCode = normalizeCode(codigo);
  await getPainelCodIndica(normalizedCode);
  const pool = getIngressoDbPool();
  const nextStatus = normalizeStatus(status);
  await pool.query(`UPDATE codindica SET stcodindica = $2 WHERE codindica = $1`, [
    normalizedCode,
    nextStatus,
  ]);
  return {
    codigo: normalizedCode,
    message: nextStatus === "ati" ? "Codigo ativado com sucesso." : "Codigo desativado com sucesso.",
  };
}

export async function removePainelCodIndica(codigo: string) {
  const normalizedCode = normalizeCode(codigo);
  await getPainelCodIndica(normalizedCode);
  const pool = getIngressoDbPool();
  try {
    await pool.query(`DELETE FROM codindica WHERE codindica = $1`, [normalizedCode]);
  } catch {
    throw new PainelCodIndicaError(
      "codindica_delete_blocked",
      "Nao e possivel realizar esta operacao, pois ja existem compras realizadas com esse codigo.",
      409,
    );
  }
  return { codigo: normalizedCode, message: "Codigo removido com sucesso." };
}

export async function getPainelCodIndicaDetail(
  codigo: string,
  filtersInput: Record<string, unknown> = {},
) {
  const normalizedCode = normalizeCode(codigo);
  const code = await getPainelCodIndica(normalizedCode);
  const filters = buildDetailFilters(filtersInput);
  const cashbackSummary = await loadCashbackSummary(normalizedCode);
  const [indicators, payments, purchases] = await Promise.all([
    loadPurchaseIndicators(normalizedCode, filters, cashbackSummary),
    loadCashbackPayments(normalizedCode),
    loadPurchases(normalizedCode, filters),
  ]);

  return {
    codigo: code.codindica,
    representante: code.nmrepresentante ?? "-",
    email: code.email ?? "-",
    validadeLabel: formatDateLabel(code.validade),
    status: normalizeText(code.stcodindica),
    statusLabel: statusLabel(code.stcodindica),
    valores: {
      adultoLabel: formatMoneyLabel(code.vlvendanormal),
      criancaLabel: formatMoneyLabel(code.vlvendainfant),
      cashbackAdultoLabel: formatMoneyLabel(code.vlcashbacknormal),
      cashbackCriancaLabel: formatMoneyLabel(code.vlcashbackinfant),
      promoLabel: normalizeText(code.flpromocional) === "s" ? "Habilitado" : "Bloqueado",
      descontoPromoLabel: formatMoneyLabel(code.vldescpromonormal),
      cashbackPromoAdultoLabel: formatMoneyLabel(code.vlcashbackpromonormal),
      cashbackPromoCriancaLabel: formatMoneyLabel(code.vlcashbackpromoinfant),
    },
    indicators,
    cashbackSummary,
    payments,
    purchases,
    filters,
  } satisfies PainelCodIndicaDetail;
}

export async function getPainelCodIndicaMessage() {
  const pool = getIngressoDbPool();
  const result = await pool.query<{ idparametro: string; vlparametro: string | null }>(
    `SELECT idparametro, vlparametro FROM parametro WHERE idparametro IN ('codval','codven','codine') ORDER BY idparametro`,
  );
  const map = new Map(result.rows.map((row) => [row.idparametro, row.vlparametro ?? ""]));
  return {
    codval: map.get("codval") ?? "",
    codven: map.get("codven") ?? "",
    codine: map.get("codine") ?? "",
  } satisfies PainelCodIndicaMessageData;
}

export async function savePainelCodIndicaMessage(values: PainelCodIndicaMessageValues) {
  const pool = getIngressoDbPool();
  const entries = [
    ["codval", normalizeText(values.codval)],
    ["codven", normalizeText(values.codven)],
    ["codine", normalizeText(values.codine)],
  ] as const;

  for (const [id, message] of entries) {
    await pool.query(
      `
        INSERT INTO parametro (idparametro, vlparametro)
        VALUES ($1, $2)
        ON CONFLICT (idparametro)
        DO UPDATE SET vlparametro = EXCLUDED.vlparametro
      `,
      [id, message],
    );
  }

  return { message: "Mensagens personalizadas atualizadas com sucesso." };
}

export async function payPainelCodIndicaCashback(
  codigo: string,
  values: PainelCodIndicaCashbackPaymentValues,
  actor: { roleId: number | null; cpf?: string | null; name?: string | null },
) {
  const normalizedCode = normalizeCode(codigo);
  const code = await getPainelCodIndica(normalizedCode);
  if (actor.roleId !== 1) {
    throw new PainelCodIndicaError(
      "manager_required",
      "Apenas gerentes podem registrar pagamento de cashback.",
      403,
    );
  }

  const amount = toNumber(toDbMoney(values.vlpagamento));
  if (amount <= 0) {
    throw new PainelCodIndicaError(
      "invalid_payment_amount",
      "Informe um valor de pagamento maior que zero.",
      400,
    );
  }

  const adminPassword = await loadCashbackAdminPassword();

  if (!adminPassword) {
    throw new PainelCodIndicaError(
      "cashback_admin_password_unconfigured",
      "Senha administrativa de cashback nao configurada.",
      409,
    );
  }

  if (normalizeText(values.senha_admin) !== adminPassword) {
    throw new PainelCodIndicaError(
      "invalid_admin_password",
      "Senha administrativa invalida.",
      400,
    );
  }

  const summary = await loadCashbackSummary(normalizedCode);
  if (amount > toNumber(summary.disponivel)) {
    throw new PainelCodIndicaError(
      "cashback_amount_exceeds_available",
      "O valor informado e maior que o cashback disponivel.",
      409,
    );
  }

  const pool = getIngressoDbPool();
  await ensureCashbackPaymentTable();
  await pool.query(
    `
      INSERT INTO codindica_cashback_pagamento (
        codindica, nmrepresentante, email, vlpagamento, dsobservacao,
        cpfgerente, nmgerente, dtpagamento, hrpagamento
      ) VALUES (
        $1, $2, $3, $4::numeric, $5, $6, $7, CURRENT_DATE, CURRENT_TIME
      )
    `,
    [
      normalizedCode,
      code.nmrepresentante,
      code.email,
      amount.toFixed(2),
      normalizeText(values.dsobservacao) || null,
      actor.cpf ?? null,
      actor.name ?? null,
    ],
  );

  return { message: "Pagamento de cashback registrado com sucesso." };
}

export async function reprocessPainelCodIndicaPurchase(
  codigo: string,
  purchaseId: number,
  actorRoleId: number | null,
) {
  const normalizedCode = normalizeCode(codigo);
  if (actorRoleId !== 1) {
    throw new PainelCodIndicaError(
      "manager_required",
      "Apenas gerentes podem reprocessar cashback.",
      403,
    );
  }

  const pool = getIngressoDbPool();
  const purchaseResult = await pool.query<{
    idcompra: number;
    codindica: string | null;
    stcompra: string | null;
    vlcashback: string | null;
  }>(
    `
      SELECT
        compra.idcompra,
        compra.codindica,
        compra.stcompra,
        COALESCE(codindica_cashback.vlcashback, compra.vlcashback, compra.vlcomiss, 0)::text AS vlcashback
      FROM compra
      LEFT JOIN codindica_cashback ON codindica_cashback.idcompra = compra.idcompra
      WHERE compra.idcompra = $1
      LIMIT 1
    `,
    [purchaseId],
  );

  const purchase = purchaseResult.rows[0];
  if (!purchase || purchase.codindica !== normalizedCode) {
    throw new PainelCodIndicaError(
      "purchase_not_found_for_code",
      "Compra nao encontrada para este codigo de indicacao.",
      404,
    );
  }

  const result = await processCodindicaCashback(purchaseId);
  if (result.status !== "processed") {
    throw new PainelCodIndicaError(
      "cashback_reprocess_failed",
      "Nao foi possivel reprocessar o cashback.",
      409,
    );
  }

  return { message: "Cashback reprocessado com sucesso." };
}

export async function loadPainelCodIndicaReport(
  codigo: string,
  input: { dtini: string; dtfim: string },
) {
  const normalizedCode = normalizeCode(codigo);
  const dateFrom = normalizeDateInput(input.dtini);
  const dateTo = normalizeDateInput(input.dtfim);
  if (!dateFrom || !dateTo) {
    throw new PainelCodIndicaError(
      "report_period_required",
      "Os campos Dia Inicio e Dia Fim sao obrigatorios.",
      400,
    );
  }

  const code = await getPainelCodIndica(normalizedCode);
  const pool = getIngressoDbPool();
  const result = await pool.query<RawReportRow>(
    `
      SELECT
        compra.idcompra,
        codindica.codindica,
        codindica.nmrepresentante,
        usuario.nmusuario,
        compra.cpf,
        compra.dtpagamento::text AS dtpagamento,
        compra.vltotcompra::text AS vltotcompra,
        compra.vltotdesc::text AS vltotdesc,
        COALESCE(codindica_cashback.vlcashback, compra.vlcashback, compra.vlcomiss, 0)::text AS vlcashback,
        codindica.tpcashback
      FROM compra
      LEFT JOIN usuario ON usuario.cpf = compra.cpf
      LEFT JOIN codindica ON codindica.codindica = compra.codindica
      LEFT JOIN codindica_cashback ON codindica_cashback.idcompra = compra.idcompra
      WHERE compra.codindica = $1
        AND compra.stcompra = 'conc'
        AND compra.dtpagamento >= $2::date
        AND compra.dtpagamento <= $3::date
      ORDER BY compra.dtpagamento ASC, compra.idcompra ASC
    `,
    [normalizedCode, dateFrom, dateTo],
  );

  if (result.rows.length === 0) {
    throw new PainelCodIndicaError(
      "report_empty_period",
      "Nenhuma compra concluida foi encontrada nesse periodo.",
      404,
    );
  }

  const totalCashback = result.rows.reduce((acc, row) => acc + toNumber(row.vlcashback), 0);

  return {
    codigo: code.codindica,
    representante: code.nmrepresentante ?? "-",
    dateFrom,
    dateTo,
    dateFromLabel: formatDateLabel(dateFrom),
    dateToLabel: formatDateLabel(dateTo),
    totalCashbackLabel: formatMoneyLabel(totalCashback),
    rows: result.rows.map((row) => ({
      purchaseId: row.idcompra,
      buyerName: row.nmusuario ?? "-",
      cpfLabel: formatCpfLabel(row.cpf),
      paymentDateLabel: formatDateLabel(row.dtpagamento),
      totalValueLabel: formatMoneyLabel(row.vltotcompra),
      discountValueLabel: formatMoneyLabel(row.vltotdesc),
      cashbackValueLabel: formatMoneyLabel(row.vlcashback),
      cashbackTypeLabel: normalizeText(row.tpcashback) === "percentual" ? "Percentual" : "Valor Fixo",
    })),
  } satisfies PainelCodIndicaReportData;
}

export function asPainelCodIndicaError(error: unknown) {
  if (error instanceof PainelCodIndicaError) {
    return error;
  }

  return new PainelCodIndicaError(
    "painel_codindica_unavailable",
    "Nao foi possivel operar Cod Indica agora.",
    500,
  );
}
