import { getIngressoDbPool } from "@/lib/ingresso-db";
import {
  asOpsAgreementPurchaseReportError,
  getAgreementPurchaseReport,
  type AgreementPurchaseIndicator,
  type AgreementPurchaseSummaryRow,
} from "@/lib/ops-agreement-purchases";

export type PainelCompraConvenioFilters = {
  agreementName: string | null;
  voucherNumber: string | null;
  visitDateFrom: string | null;
  visitDateTo: string | null;
  usedDateFrom: string | null;
  usedDateTo: string | null;
  voucherType: string | null;
  purchaseType: string | null;
  usedStatus: string | null;
  paymentStatus: string | null;
  purchaseStatus: string | null;
  paymentMethodType: string | null;
};

export type PainelCompraConvenioAgreementOption = {
  name: string;
};

export type PainelCompraConvenioRow = AgreementPurchaseSummaryRow;
export type PainelCompraConvenioIndicators = AgreementPurchaseIndicator & {
  totalCount: number;
  totalValue: string;
};

export type PainelCompraConvenioResult = {
  filters: PainelCompraConvenioFilters;
  indicators: PainelCompraConvenioIndicators;
  rows: PainelCompraConvenioRow[];
  agreementOptions: PainelCompraConvenioAgreementOption[];
};

export class PainelCompraConvenioError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "PainelCompraConvenioError";
    this.code = code;
    this.status = status;
  }
}

function normalizeText(value: unknown) {
  const normalized = String(value ?? "").trim();
  return normalized && normalized !== "-1" ? normalized : "";
}

function formatMoney(value: string | number) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function normalizePainelCompraConvenioFilters(
  input: Record<string, unknown>,
): PainelCompraConvenioFilters {
  return {
    agreementName: normalizeText(input.convenio) || null,
    voucherNumber:
      normalizeText(input.numvoucher) || normalizeText(input.idvoucher) || null,
    visitDateFrom:
      normalizeText(input["dtcompra[de]"]) ||
      normalizeText(input["dtvisita[de]"]) ||
      null,
    visitDateTo:
      normalizeText(input["dtcompra[ate]"]) ||
      normalizeText(input["dtvisita[ate]"]) ||
      null,
    usedDateFrom: normalizeText(input["dtuso[de]"]) || null,
    usedDateTo: normalizeText(input["dtuso[ate]"]) || null,
    voucherType: normalizeText(input.tpvoucher) || null,
    purchaseType: normalizeText(input.tpcompra) || null,
    usedStatus:
      normalizeText(input.stusado) || normalizeText(input.usado) || null,
    paymentStatus: normalizeText(input.status) || null,
    purchaseStatus: normalizeText(input.stcompra) || null,
    paymentMethodType: normalizeText(input.paymentmethodtype) || null,
  };
}

export async function listPainelCompraConvenio(
  filters: Record<string, unknown>,
): Promise<PainelCompraConvenioResult> {
  const normalized = normalizePainelCompraConvenioFilters(filters);
  const report = await getAgreementPurchaseReport(normalized);
  const agreementOptions = await listPainelCompraConvenioAgreementOptions();

  return {
    filters: normalized,
    indicators: {
      ...report.indicators,
      totalCount:
        report.indicators.qtdnormal +
        report.indicators.qtdinfantil +
        report.indicators.qtdisento +
        report.indicators.qtdescola,
      totalValue: formatMoney(
        Number(report.indicators.vlnormal) +
          Number(report.indicators.vlinfantil) +
          Number(report.indicators.vlescola),
      ),
    },
    rows: report.rows,
    agreementOptions,
  };
}

export async function listPainelCompraConvenioAgreementOptions() {
  const pool = getIngressoDbPool();
  const result = await pool.query<{ nmconvenio: string | null }>(
    `
      SELECT DISTINCT convenio.nmconvenio
      FROM convenio
      WHERE convenio.nmconvenio IS NOT NULL
        AND convenio.nmconvenio <> ''
      ORDER BY convenio.nmconvenio ASC
    `,
  );

  return result.rows
    .map((row) => row.nmconvenio?.trim() ?? "")
    .filter(Boolean)
    .map((name) => ({ name }));
}

export function mapPainelCompraConvenioExportRows(result: PainelCompraConvenioResult) {
  return result.rows.map((row) => ({
    Convenios: row.agreementName,
    Passaporte: String(row.adultQuantity),
    ValorPassaporte: row.adultValue,
    Infantil: String(row.childQuantity),
    ValorInfantil: row.childValue,
    Escolar: String(row.schoolQuantity),
    ValorEscolar: row.schoolValue,
    Isento: String(row.exemptQuantity),
    TotalIngressos: String(row.totalQuantity),
    TotalValores: row.totalValue,
  }));
}

export function renderPainelCompraConvenioExportTable(
  rows: Array<Record<string, string>>,
) {
  const headers = [
    "Convenios",
    "Passaporte",
    "ValorPassaporte",
    "Infantil",
    "ValorInfantil",
    "Escolar",
    "ValorEscolar",
    "Isento",
    "TotalIngressos",
    "TotalValores",
  ];

  const head = headers.map((header) => `<th>${header}</th>`).join("");
  const body = rows
    .map(
      (row) =>
        `<tr>${headers.map((header) => `<td>${row[header] ?? ""}</td>`).join("")}</tr>`,
    )
    .join("");

  return `<!doctype html><html><head><meta charset="utf-8" /></head><body><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></body></html>`;
}

export function asPainelCompraConvenioError(error: unknown) {
  const operationError = asOpsAgreementPurchaseReportError(error);
  return new PainelCompraConvenioError(
    operationError.code,
    operationError.message,
    operationError.status,
  );
}
