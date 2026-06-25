import type { OperationalCashMovement } from "@/lib/ops-cash-management";

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  dinhe: "Dinheiro",
  debit: "Debito",
  credi: "Credito",
  chequ: "Cheque",
  tranb: "Trans. bancaria",
  pix: "Pix",
  pgseg: "Pagamento Online",
};

const VOUCHER_TYPE_LABELS: Record<string, string> = {
  isent: "Isento",
  corte: "Cortesia",
};

const PAYMENT_METHOD_ORDER = [
  "dinhe",
  "debit",
  "credi",
  "pix",
  "chequ",
  "tranb",
  "pgseg",
] as const;

export type BilheteriaCashAggregateRow = {
  voucherType: string;
  quantity: number;
  totalValue: number;
  paymentMethod?: string | null;
};

export type BilheteriaCashCourtesyRow = {
  authorizedBy: string;
  identification: string;
  quantity: number;
};

export type BilheteriaCashClosureReportInput = {
  period: {
    openedAt: string | null;
    closedAt: string | null;
  };
  siteRows: BilheteriaCashAggregateRow[];
  boxOfficeRows: BilheteriaCashAggregateRow[];
  discountGroups: Array<{
    label: string;
    rows: BilheteriaCashAggregateRow[];
  }>;
  courtesyRows: BilheteriaCashCourtesyRow[];
  funds: OperationalCashMovement[];
  sangrias: OperationalCashMovement[];
  forms: Record<string, number>;
  formsDesc: Record<string, number>;
  totalFund: number;
  totalSangria: number;
  cashInDrawer: number;
};

export type BilheteriaCashClosureReportModel = ReturnType<
  typeof buildBilheteriaCashClosureReportModel
>;

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function normalizeMoney(value: string | number | null | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? roundMoney(value) : 0;
  }

  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? roundMoney(parsed) : 0;
}

function normalizeCount(value: number | null | undefined) {
  return Number.isFinite(value) ? Number(value) : 0;
}

function resolveVoucherTypeLabel(code: string | null | undefined) {
  const normalized = String(code ?? "").trim();
  return normalized ? (VOUCHER_TYPE_LABELS[normalized] ?? normalized) : "-";
}

function resolvePaymentLabel(code: string | null | undefined) {
  const normalized = String(code ?? "").trim();
  return normalized ? (PAYMENT_METHOD_LABELS[normalized] ?? normalized) : "-";
}

function sortPaymentEntries(entries: Array<[string, number]>) {
  return entries.sort(([leftKey], [rightKey]) => {
    const leftIndex = PAYMENT_METHOD_ORDER.indexOf(
      leftKey as (typeof PAYMENT_METHOD_ORDER)[number],
    );
    const rightIndex = PAYMENT_METHOD_ORDER.indexOf(
      rightKey as (typeof PAYMENT_METHOD_ORDER)[number],
    );

    if (leftIndex === -1 && rightIndex === -1) {
      return leftKey.localeCompare(rightKey);
    }

    if (leftIndex === -1) {
      return 1;
    }

    if (rightIndex === -1) {
      return -1;
    }

    return leftIndex - rightIndex;
  });
}

function buildPaymentRows(
  forms: Record<string, number>,
  formsDesc?: Record<string, number>,
) {
  const paymentMap = new Map<string, number>();

  for (const [method, value] of Object.entries(forms)) {
    const normalized = normalizeMoney(value);
    if (normalized > 0) {
      paymentMap.set(method, normalized);
    }
  }

  for (const [method, value] of Object.entries(formsDesc ?? {})) {
    const normalized = normalizeMoney(value);
    if (normalized > 0) {
      paymentMap.set(method, roundMoney((paymentMap.get(method) ?? 0) + normalized));
    }
  }

  return sortPaymentEntries([...paymentMap.entries()]).map(([method, value]) => ({
    label: resolvePaymentLabel(method),
    method,
    value,
  }));
}

function buildDiscountPanelLabel(label: string) {
  return label.replace(/^Descontos\s*-\s*/i, "").trim();
}

export function buildBilheteriaCashClosureReportModel(
  input: BilheteriaCashClosureReportInput,
) {
  const siteRows = input.siteRows.map((row) => ({
    quantity: normalizeCount(row.quantity),
    totalValue: normalizeMoney(row.totalValue),
    voucherType: row.voucherType,
    voucherTypeLabel: resolveVoucherTypeLabel(row.voucherType),
  }));

  const baseBoxOfficeRows = input.boxOfficeRows.map((row) => ({
    quantity: normalizeCount(row.quantity),
    totalValue: normalizeMoney(row.totalValue),
    voucherType: row.voucherType,
    voucherTypeLabel: resolveVoucherTypeLabel(row.voucherType),
  }));

  const discountPanels = input.discountGroups.map((group) => {
    const paymentMap = new Map<string, number>();
    const rows = group.rows.map((row) => {
      const totalValue = normalizeMoney(row.totalValue);
      const paymentMethod = String(row.paymentMethod ?? "").trim() || null;
      if (paymentMethod && totalValue > 0) {
        paymentMap.set(
          paymentMethod,
          roundMoney((paymentMap.get(paymentMethod) ?? 0) + totalValue),
        );
      }

      return {
        paymentMethod,
        quantity: normalizeCount(row.quantity),
        totalValue,
        voucherType: row.voucherType,
        voucherTypeLabel: resolveVoucherTypeLabel(row.voucherType),
      };
    });

    return {
      label: buildDiscountPanelLabel(group.label),
      quantity: rows.reduce((sum, row) => sum + row.quantity, 0),
      totalValue: roundMoney(rows.reduce((sum, row) => sum + row.totalValue, 0)),
      paymentRows: sortPaymentEntries([...paymentMap.entries()]).map(
        ([method, value]) => ({
          label: resolvePaymentLabel(method),
          method,
          value,
        }),
      ),
      rows,
    };
  });

  const courtesySummaryMap = new Map<string, number>();
  const courtesyRows = input.courtesyRows.map((row) => {
    const authorizedBy = row.authorizedBy.trim() || "Nao informado";
    const quantity = normalizeCount(row.quantity);
    courtesySummaryMap.set(
      authorizedBy,
      (courtesySummaryMap.get(authorizedBy) ?? 0) + quantity,
    );
    return {
      authorizedBy,
      identification: row.identification.trim() || "Nao informado",
      quantity,
    };
  });

  const courtesySummaryRows = [...courtesySummaryMap.entries()].map(
    ([authorizedBy, quantity]) => ({
      authorizedBy,
      quantity,
    }),
  );

  const mergedBoxOfficeMap = new Map<
    string,
    {
      quantity: number;
      totalValue: number;
      voucherType: string;
      voucherTypeLabel: string;
    }
  >();

  for (const row of [...baseBoxOfficeRows, ...discountPanels.flatMap((panel) => panel.rows)]) {
    const current = mergedBoxOfficeMap.get(row.voucherType);
    if (current) {
      current.quantity += row.quantity;
      current.totalValue = roundMoney(current.totalValue + row.totalValue);
      continue;
    }

    mergedBoxOfficeMap.set(row.voucherType, {
      quantity: row.quantity,
      totalValue: row.totalValue,
      voucherType: row.voucherType,
      voucherTypeLabel: row.voucherTypeLabel,
    });
  }

  const boxOfficeSummaryRows = [...mergedBoxOfficeMap.values()].sort((left, right) =>
    left.voucherType.localeCompare(right.voucherType),
  );

  const siteValidatedCount = siteRows.reduce((sum, row) => sum + row.quantity, 0);
  const siteValidatedRevenue = roundMoney(
    siteRows.reduce((sum, row) => sum + row.totalValue, 0),
  );
  const boxOfficeBaseCount = baseBoxOfficeRows.reduce(
    (sum, row) => sum + row.quantity,
    0,
  );
  const boxOfficeBaseRevenue = roundMoney(
    baseBoxOfficeRows.reduce((sum, row) => sum + row.totalValue, 0),
  );
  const discountCount = discountPanels.reduce((sum, panel) => sum + panel.quantity, 0);
  const discountRevenue = roundMoney(
    discountPanels.reduce((sum, panel) => sum + panel.totalValue, 0),
  );
  const boxOfficeCount = boxOfficeBaseCount + discountCount;
  const boxOfficeVoucherRevenue = roundMoney(boxOfficeBaseRevenue + discountRevenue);
  const courtesyCount = courtesyRows.reduce((sum, row) => sum + row.quantity, 0);
  const totalPeople = siteValidatedCount + boxOfficeCount + courtesyCount;
  const totalFund = normalizeMoney(input.totalFund);
  const totalSangria = normalizeMoney(input.totalSangria);
  const boxOfficePaymentRows = buildPaymentRows(input.forms);
  const summaryPaymentRows = buildPaymentRows(input.forms, input.formsDesc);
  const cashSales = roundMoney(
    summaryPaymentRows.reduce((sum, row) => {
      return row.method === "dinhe" ? sum + row.value : sum;
    }, 0),
  );
  const boxOfficeRevenue = roundMoney(
    summaryPaymentRows.reduce((sum, row) => sum + row.value, 0),
  );
  const totalBilling = roundMoney(siteValidatedRevenue + boxOfficeRevenue);
  const cashInDrawer = normalizeMoney(input.cashInDrawer);
  const averageTicket =
    totalPeople > 0 ? roundMoney(totalBilling / totalPeople) : 0;

  return {
    boxOfficeBaseCount,
    boxOfficeBaseRevenue,
    boxOfficeCount,
    boxOfficePaymentRows,
    boxOfficeRevenue,
    boxOfficeVoucherRevenue,
    boxOfficeRows: baseBoxOfficeRows,
    boxOfficeSummaryRows,
    cashInDrawer,
    cashSales,
    courtesyCount,
    courtesyRows,
    courtesySummaryRows,
    detailPaymentRows: summaryPaymentRows,
    discountCount,
    discountPanels,
    discountRevenue,
    funds: input.funds.map((item) => ({
      ...item,
      numericValue: normalizeMoney(item.value),
    })),
    kpis: {
      averageTicket,
      billing: {
        boxOffice: boxOfficeRevenue,
        site: siteValidatedRevenue,
        total: totalBilling,
      },
      cashInDrawer,
      people: {
        boxOfficeCount,
        courtesyCount,
        siteValidatedCount,
        total: totalPeople,
      },
    },
    period: input.period,
    sangrias: input.sangrias.map((item) => ({
      ...item,
      numericValue: normalizeMoney(item.value),
    })),
    siteRows,
    summaryPaymentRows,
    totalFund,
    totalSangria,
  };
}

export function formatBilheteriaCashMoney(value: number | string | null | undefined) {
  return new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    style: "currency",
  }).format(normalizeMoney(value));
}

export function formatBilheteriaCashDateTime(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(date);
}

export function formatBilheteriaCashDateLong() {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
}
