import { getIngressoDbPool } from "@/lib/ingresso-db";

export type AgreementPurchaseReportFilters = {
  agreementName?: unknown;
  voucherNumber?: unknown;
  visitDateFrom?: unknown;
  visitDateTo?: unknown;
  usedDateFrom?: unknown;
  usedDateTo?: unknown;
  voucherType?: unknown;
  purchaseType?: unknown;
  usedStatus?: unknown;
  paymentStatus?: unknown;
  purchaseStatus?: unknown;
  paymentMethodType?: unknown;
};

export type AgreementPurchaseIndicator = {
  qtdnormal: number;
  vlnormal: string;
  qtdinfantil: number;
  vlinfantil: string;
  qtdisento: number;
  qtdescola: number;
  vlescola: string;
  qtdconvenio: number;
  vlconvenio: string;
};

export type AgreementPurchaseSummaryRow = {
  agreementName: string;
  adultQuantity: number;
  adultValue: string;
  childQuantity: number;
  childValue: string;
  schoolQuantity: number;
  schoolValue: string;
  exemptQuantity: number;
  totalQuantity: number;
  totalValue: string;
};

export type AgreementPurchaseReport = {
  generatedAt: string;
  filters: {
    agreementName: string | null;
    voucherNumber: string | null;
    visitDateFrom: string | null;
    visitDateTo: string | null;
    usedDateFrom: string | null;
    usedDateTo: string | null;
    voucherType: string | null;
    purchaseType: string | null;
    usedStatus: string | null;
    paymentStatus: number | null;
    purchaseStatus: string | null;
    paymentMethodType: number | null;
  };
  indicators: AgreementPurchaseIndicator;
  rows: AgreementPurchaseSummaryRow[];
};

type QueryFilters = AgreementPurchaseReport["filters"];

type IndicatorRow = {
  qtdnormal: string | number | null;
  vlnormal: string | null;
  qtdinfantil: string | number | null;
  vlinfantil: string | null;
  qtdisento: string | number | null;
  qtdescola: string | number | null;
  vlescola: string | null;
  qtdconvenio: string | number | null;
  vlconvenio: string | null;
};

type SummaryRow = {
  agreement_name: string;
  adult_quantity: string | number | null;
  adult_value: string | null;
  child_quantity: string | number | null;
  child_value: string | null;
  school_quantity: string | number | null;
  school_value: string | null;
  exempt_quantity: string | number | null;
  total_quantity: string | number | null;
  total_value: string | null;
};

export class OpsAgreementPurchaseReportError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "OpsAgreementPurchaseReportError";
    this.code = code;
    this.status = status;
  }
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function parseDate(value: unknown) {
  const raw = normalizeText(value);
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const brMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const normalized = isoMatch
    ? raw
    : brMatch
      ? `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`
      : "";

  if (!normalized) {
    return null;
  }

  const date = new Date(`${normalized}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== normalized) {
    return null;
  }

  return normalized;
}

function parseOptionalInteger(value: unknown) {
  const normalized = normalizeText(value);

  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function parseOptionalStatus(value: unknown) {
  const normalized = normalizeText(value).toLowerCase();

  if (!normalized) {
    return null;
  }

  if (normalized === "s" || normalized === "n") {
    return normalized;
  }

  return null;
}

function hasProvidedValue(value: unknown) {
  if (value === undefined || value === null) {
    return false;
  }

  return normalizeText(value) !== "";
}

function normalizeFilters(filters: AgreementPurchaseReportFilters): QueryFilters {
  const agreementName = normalizeText(filters.agreementName) || null;
  const voucherNumber = normalizeText(filters.voucherNumber) || null;
  const visitDateFrom = hasProvidedValue(filters.visitDateFrom)
    ? parseDate(filters.visitDateFrom)
    : null;
  const visitDateTo = hasProvidedValue(filters.visitDateTo)
    ? parseDate(filters.visitDateTo)
    : null;
  const usedDateFrom = hasProvidedValue(filters.usedDateFrom)
    ? parseDate(filters.usedDateFrom)
    : null;
  const usedDateTo = hasProvidedValue(filters.usedDateTo)
    ? parseDate(filters.usedDateTo)
    : null;
  const voucherType = normalizeText(filters.voucherType) || null;
  const purchaseType = normalizeText(filters.purchaseType) || null;
  const usedStatus = parseOptionalStatus(filters.usedStatus);
  const paymentStatus = parseOptionalInteger(filters.paymentStatus);
  const purchaseStatus = normalizeText(filters.purchaseStatus) || null;
  const paymentMethodType = parseOptionalInteger(filters.paymentMethodType);

  if (hasProvidedValue(filters.visitDateFrom) && !visitDateFrom) {
    throw new OpsAgreementPurchaseReportError(
      "invalid_agreement_purchase_filter",
      "Informe uma data inicial de visita valida.",
      400,
    );
  }

  if (hasProvidedValue(filters.visitDateTo) && !visitDateTo) {
    throw new OpsAgreementPurchaseReportError(
      "invalid_agreement_purchase_filter",
      "Informe uma data final de visita valida.",
      400,
    );
  }

  if (hasProvidedValue(filters.usedDateFrom) && !usedDateFrom) {
    throw new OpsAgreementPurchaseReportError(
      "invalid_agreement_purchase_filter",
      "Informe uma data inicial de uso valida.",
      400,
    );
  }

  if (hasProvidedValue(filters.usedDateTo) && !usedDateTo) {
    throw new OpsAgreementPurchaseReportError(
      "invalid_agreement_purchase_filter",
      "Informe uma data final de uso valida.",
      400,
    );
  }

  if (hasProvidedValue(filters.usedStatus) && usedStatus === null) {
    throw new OpsAgreementPurchaseReportError(
      "invalid_agreement_purchase_filter",
      "Informe um status de uso valido.",
      400,
    );
  }

  if (hasProvidedValue(filters.paymentStatus) && paymentStatus === null) {
    throw new OpsAgreementPurchaseReportError(
      "invalid_agreement_purchase_filter",
      "Informe um status de pagamento valido.",
      400,
    );
  }

  if (hasProvidedValue(filters.paymentMethodType) && paymentMethodType === null) {
    throw new OpsAgreementPurchaseReportError(
      "invalid_agreement_purchase_filter",
      "Informe uma forma de pagamento valida.",
      400,
    );
  }

  return {
    agreementName,
    voucherNumber,
    visitDateFrom,
    visitDateTo,
    usedDateFrom,
    usedDateTo,
    voucherType,
    purchaseType,
    usedStatus,
    paymentStatus,
    purchaseStatus,
    paymentMethodType,
  };
}

function buildFilteredPurchasesQuery(filters: QueryFilters) {
  const conditions: string[] = [];
  const params: Array<string | number> = [];

  if (filters.agreementName) {
    if (filters.agreementName.toUpperCase() === "SITE") {
      conditions.push("c.idconvenio IS NULL");
    } else {
      params.push(filters.agreementName);
      conditions.push(`convenio.nmconvenio = $${params.length}`);
    }
  }

  if (filters.voucherNumber) {
    params.push(`%${filters.voucherNumber}%`);
    conditions.push(`v.numvoucher ILIKE $${params.length}`);
  }

  if (filters.visitDateFrom) {
    params.push(filters.visitDateFrom);
    conditions.push(`agenda.dtagenda >= $${params.length}::date`);
  }

  if (filters.visitDateTo) {
    params.push(filters.visitDateTo);
    conditions.push(`agenda.dtagenda <= $${params.length}::date`);
  }

  if (filters.usedDateFrom) {
    params.push(filters.usedDateFrom);
    conditions.push(`v.dtuso >= $${params.length}::date`);
  }

  if (filters.usedDateTo) {
    params.push(filters.usedDateTo);
    conditions.push(`v.dtuso <= $${params.length}::date`);
  }

  if (filters.voucherType) {
    params.push(filters.voucherType);
    conditions.push(`v.tpvoucher = $${params.length}`);
  }

  if (filters.purchaseType) {
    params.push(filters.purchaseType);
    conditions.push(`c.tpcompra = $${params.length}`);
  }

  if (filters.usedStatus) {
    params.push(filters.usedStatus);
    conditions.push(`v.stusado = $${params.length}`);
  }

  if (filters.paymentStatus !== null) {
    params.push(filters.paymentStatus);
    conditions.push(`pagpagseguro.status = $${params.length}`);
  }

  if (filters.purchaseStatus) {
    params.push(filters.purchaseStatus);
    conditions.push(`c.stcompra = $${params.length}`);
  }

  if (filters.paymentMethodType !== null) {
    params.push(filters.paymentMethodType);
    conditions.push(`pagpagseguro.paymentmethodtype = $${params.length}`);
  }

  return {
    params,
    whereClause: conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "",
  };
}

function parseCount(value: string | number | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseMoney(value: string | null | undefined) {
  const parsed = Number(value ?? "0");
  return Number.isFinite(parsed) ? parsed.toFixed(2) : "0.00";
}

export async function getAgreementPurchaseReport(filters: AgreementPurchaseReportFilters) {
  const normalizedFilters = normalizeFilters(filters);
  const { whereClause, params } = buildFilteredPurchasesQuery(normalizedFilters);
  const pool = getIngressoDbPool();

  const indicatorResult = await pool.query<IndicatorRow>(
    `
      WITH filtered AS (
        SELECT
          COALESCE(convenio.nmconvenio, 'SITE') AS agreement_name,
          v.tpvoucher,
          COALESCE(v.vlunicompra, 0)::numeric AS vlunicompra
        FROM compra c
        JOIN voucher v ON v.idcompra = c.idcompra
        LEFT JOIN agenda ON agenda.idagenda = v.idagenda
        LEFT JOIN pagpagseguro ON pagpagseguro.idcompra = c.idcompra
        LEFT JOIN convenio ON convenio.idconvenio = c.idconvenio
        ${whereClause}
      )
      SELECT
        COALESCE(SUM(CASE WHEN tpvoucher = 'norma' THEN 1 ELSE 0 END), 0) AS qtdnormal,
        COALESCE(SUM(CASE WHEN tpvoucher = 'norma' THEN vlunicompra ELSE 0 END), 0)::text AS vlnormal,
        COALESCE(SUM(CASE WHEN tpvoucher = 'infan' THEN 1 ELSE 0 END), 0) AS qtdinfantil,
        COALESCE(SUM(CASE WHEN tpvoucher = 'infan' THEN vlunicompra ELSE 0 END), 0)::text AS vlinfantil,
        COALESCE(SUM(CASE WHEN tpvoucher = 'isent' THEN 1 ELSE 0 END), 0) AS qtdisento,
        COALESCE(SUM(CASE WHEN tpvoucher = 'escol' THEN 1 ELSE 0 END), 0) AS qtdescola,
        COALESCE(SUM(CASE WHEN tpvoucher = 'escol' THEN vlunicompra ELSE 0 END), 0)::text AS vlescola,
        COALESCE(COUNT(*), 0) AS qtdconvenio,
        COALESCE(SUM(vlunicompra), 0)::text AS vlconvenio
      FROM filtered
    `,
    params,
  );
  const summaryResult = await pool.query<SummaryRow>(
    `
      WITH filtered AS (
        SELECT
          COALESCE(convenio.nmconvenio, 'SITE') AS agreement_name,
          v.tpvoucher,
          COALESCE(v.vlunicompra, 0)::numeric AS vlunicompra
        FROM compra c
        JOIN voucher v ON v.idcompra = c.idcompra
        LEFT JOIN agenda ON agenda.idagenda = v.idagenda
        LEFT JOIN pagpagseguro ON pagpagseguro.idcompra = c.idcompra
        LEFT JOIN convenio ON convenio.idconvenio = c.idconvenio
        ${whereClause}
      )
      SELECT
        agreement_name,
        COALESCE(SUM(CASE WHEN tpvoucher = 'norma' THEN 1 ELSE 0 END), 0) AS adult_quantity,
        COALESCE(SUM(CASE WHEN tpvoucher = 'norma' THEN vlunicompra ELSE 0 END), 0)::text AS adult_value,
        COALESCE(SUM(CASE WHEN tpvoucher = 'infan' THEN 1 ELSE 0 END), 0) AS child_quantity,
        COALESCE(SUM(CASE WHEN tpvoucher = 'infan' THEN vlunicompra ELSE 0 END), 0)::text AS child_value,
        COALESCE(SUM(CASE WHEN tpvoucher = 'escol' THEN 1 ELSE 0 END), 0) AS school_quantity,
        COALESCE(SUM(CASE WHEN tpvoucher = 'escol' THEN vlunicompra ELSE 0 END), 0)::text AS school_value,
        COALESCE(SUM(CASE WHEN tpvoucher = 'isent' THEN 1 ELSE 0 END), 0) AS exempt_quantity,
        COALESCE(COUNT(*), 0) AS total_quantity,
        COALESCE(SUM(vlunicompra), 0)::text AS total_value
      FROM filtered
      GROUP BY agreement_name
      ORDER BY agreement_name ASC
    `,
    params,
  );

  const indicatorRow = indicatorResult.rows[0] ?? {
    qtdnormal: 0,
    vlnormal: "0.00",
    qtdinfantil: 0,
    vlinfantil: "0.00",
    qtdisento: 0,
    qtdescola: 0,
    vlescola: "0.00",
    qtdconvenio: 0,
    vlconvenio: "0.00",
  };

  return {
    generatedAt: new Date().toISOString(),
    filters: normalizedFilters,
    indicators: {
      qtdnormal: parseCount(indicatorRow.qtdnormal),
      vlnormal: parseMoney(indicatorRow.vlnormal),
      qtdinfantil: parseCount(indicatorRow.qtdinfantil),
      vlinfantil: parseMoney(indicatorRow.vlinfantil),
      qtdisento: parseCount(indicatorRow.qtdisento),
      qtdescola: parseCount(indicatorRow.qtdescola),
      vlescola: parseMoney(indicatorRow.vlescola),
      qtdconvenio: parseCount(indicatorRow.qtdconvenio),
      vlconvenio: parseMoney(indicatorRow.vlconvenio),
    },
    rows: summaryResult.rows.map((row) => ({
      agreementName: row.agreement_name,
      adultQuantity: parseCount(row.adult_quantity),
      adultValue: parseMoney(row.adult_value),
      childQuantity: parseCount(row.child_quantity),
      childValue: parseMoney(row.child_value),
      schoolQuantity: parseCount(row.school_quantity),
      schoolValue: parseMoney(row.school_value),
      exemptQuantity: parseCount(row.exempt_quantity),
      totalQuantity: parseCount(row.total_quantity),
      totalValue: parseMoney(row.total_value),
    })),
  } satisfies AgreementPurchaseReport;
}

export function asOpsAgreementPurchaseReportError(error: unknown) {
  if (error instanceof OpsAgreementPurchaseReportError) {
    return error;
  }

  return new OpsAgreementPurchaseReportError(
    "agreement_purchase_report_unavailable",
    "Nao foi possivel carregar o relatorio de compras por convenio agora.",
    502,
  );
}
