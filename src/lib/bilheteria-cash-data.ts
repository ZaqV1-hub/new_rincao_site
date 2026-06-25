import { getIngressoDbPool } from "@/lib/ingresso-db";
import { getOperationalCashClosureDetail, listOperationalCashClosures } from "@/lib/ops-cash-closures";
import {
  buildOperationalCashSummary,
  ensureCashPeriodsTable,
  getOperationalCashSummary,
  listCashMovementsByType,
} from "@/lib/ops-cash-management";
import { ensureOpsAuditLogTable } from "@/lib/ops-audit-log";
import {
  buildBilheteriaCashClosureReportModel,
  type BilheteriaCashAggregateRow,
  type BilheteriaCashClosureReportModel,
  type BilheteriaCashCourtesyRow,
} from "@/lib/bilheteria-cash-view-model";

type DiscountRow = {
  tipo: string | null;
  nome: string | null;
  descricao: string | null;
  tpvoucher: string | null;
  formapag: string | null;
  quantidade: string | number | null;
  valor_total: string | number | null;
};

type AggregateRow = {
  tpvoucher: string | null;
  descricao: string | null;
  quantidade: string | number | null;
  valor_total: string | number | null;
};

type CourtesyRow = {
  autorizado_por: string | null;
  nome: string | null;
  quantidade: string | number | null;
};

type AuditListRow = {
  id: number;
  origem: string | null;
  acao: string | null;
  compra_id: number | null;
  movimentacao_id: number | null;
  movimentacao_tipo: string | null;
  descricao: string | null;
  motivo: string | null;
  usuario_nome: string | null;
  created_at: string | null;
};

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function normalizeNumber(value: string | number | null | undefined) {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toAggregateRows(rows: AggregateRow[]): BilheteriaCashAggregateRow[] {
  return rows.map((row) => ({
    voucherType:
      String(row.descricao ?? "").trim() || String(row.tpvoucher ?? "").trim(),
    quantity: normalizeNumber(row.quantidade),
    totalValue: normalizeNumber(row.valor_total),
  }));
}

function toCourtesyRows(rows: CourtesyRow[]): BilheteriaCashCourtesyRow[] {
  return rows.map((row) => ({
    authorizedBy: String(row.autorizado_por ?? "").trim() || "Bilheteria",
    identification: String(row.nome ?? "").trim(),
    quantity: normalizeNumber(row.quantidade),
  }));
}

function buildPaymentMap(rows: Array<{ forma_pagamento: string | null; total: string | number | null }>) {
  return rows.reduce<Record<string, number>>((result, row) => {
    const key = String(row.forma_pagamento ?? "").trim();
    if (!key) {
      return result;
    }
    result[key] = roundMoney(normalizeNumber(row.total));
    return result;
  }, {});
}

async function querySiteRows(client: import("pg").PoolClient, openedAt: string, closedAt: string) {
  const result = await client.query<AggregateRow>(
    `
      SELECT
        v.tpvoucher,
        COALESCE(NULLIF(BTRIM(v.descricao), ''), v.tpvoucher) AS descricao,
        COUNT(*)::text AS quantidade,
        COALESCE(SUM(v.vlunicompra), 0)::text AS valor_total
      FROM voucher v
      JOIN compra c ON c.idcompra = v.idcompra
      WHERE c.tpcompra = 'ponli'
        AND v.stusado = 's'
        AND (v.dtuso::timestamp + COALESCE(v.hruso, '00:00'::time)) >= ($1::timestamptz AT TIME ZONE 'America/Sao_Paulo')
        AND (v.dtuso::timestamp + COALESCE(v.hruso, '00:00'::time)) <= ($2::timestamptz AT TIME ZONE 'America/Sao_Paulo')
      GROUP BY v.tpvoucher, COALESCE(NULLIF(BTRIM(v.descricao), ''), v.tpvoucher)
      ORDER BY COALESCE(NULLIF(BTRIM(v.descricao), ''), v.tpvoucher)
    `,
    [openedAt, closedAt],
  );

  return toAggregateRows(result.rows);
}

async function queryBoxOfficeRows(
  client: import("pg").PoolClient,
  openedAt: string,
  closedAt: string,
) {
  const result = await client.query<AggregateRow>(
    `
      SELECT
        v.tpvoucher,
        COALESCE(NULLIF(BTRIM(v.descricao), ''), v.tpvoucher) AS descricao,
        COUNT(*)::text AS quantidade,
        COALESCE(SUM(v.vlunicompra), 0)::text AS valor_total
      FROM voucher v
      JOIN compra c ON c.idcompra = v.idcompra
      WHERE c.tpcompra IN ('bilhe', 'reser')
        AND c.stcompra = 'conc'
        AND c.formapag IS NOT NULL
        AND c.formapag <> 'N/A'
        AND (c.dtcompra + COALESCE(c.hrcompra, '00:00'::time)) >= $1::timestamptz
        AND (c.dtcompra + COALESCE(c.hrcompra, '00:00'::time)) <= $2::timestamptz
        AND v.tpvoucher <> 'corte'
        AND v.tpvoucher <> 'espec'
        AND v.stusado <> 'inv'
        AND v.desconto_id IS NULL
      GROUP BY v.tpvoucher, COALESCE(NULLIF(BTRIM(v.descricao), ''), v.tpvoucher)
      ORDER BY COALESCE(NULLIF(BTRIM(v.descricao), ''), v.tpvoucher)
    `,
    [openedAt, closedAt],
  );

  return toAggregateRows(result.rows);
}

async function queryDiscountRows(
  client: import("pg").PoolClient,
  openedAt: string,
  closedAt: string,
) {
  const result = await client.query<DiscountRow>(
    `
      SELECT
        dt.descricao AS tipo,
        d.nome AS nome,
        v.tpvoucher,
        COALESCE(NULLIF(BTRIM(v.descricao), ''), v.tpvoucher) AS descricao,
        c.formapag,
        COUNT(*)::text AS quantidade,
        COALESCE(SUM(v.vlunicompra), 0)::text AS valor_total
      FROM voucher v
      JOIN compra c ON c.idcompra = v.idcompra
      JOIN descontos d ON d.id = v.desconto_id
      JOIN descontos_tipos dt ON dt.id = d.tipo_id
      WHERE c.tpcompra IN ('bilhe', 'reser')
        AND c.stcompra = 'conc'
        AND c.formapag IS NOT NULL
        AND c.formapag <> 'N/A'
        AND (c.dtcompra + COALESCE(c.hrcompra, '00:00'::time)) >= $1::timestamptz
        AND (c.dtcompra + COALESCE(c.hrcompra, '00:00'::time)) <= $2::timestamptz
        AND v.tpvoucher <> 'corte'
        AND v.tpvoucher <> 'espec'
        AND v.stusado <> 'inv'
      GROUP BY dt.descricao, d.nome, v.tpvoucher, COALESCE(NULLIF(BTRIM(v.descricao), ''), v.tpvoucher), c.formapag
      ORDER BY dt.descricao, d.nome, COALESCE(NULLIF(BTRIM(v.descricao), ''), v.tpvoucher), c.formapag
    `,
    [openedAt, closedAt],
  );

  const grouped = new Map<
    string,
    Array<{
      voucherType: string;
      quantity: number;
      totalValue: number;
      paymentMethod: string | null;
    }>
  >();

  for (const row of result.rows) {
    const type = String(row.tipo ?? "").trim();
    const name = String(row.nome ?? "").trim();
    const label = `Descontos - ${type} - ${name}`.replace(/\s+-\s+-\s+/g, " - ");
    const rows = grouped.get(label) ?? [];
    rows.push({
      voucherType:
        String(row.descricao ?? "").trim() || String(row.tpvoucher ?? "").trim(),
      quantity: normalizeNumber(row.quantidade),
      totalValue: normalizeNumber(row.valor_total),
      paymentMethod: String(row.formapag ?? "").trim() || null,
    });
    grouped.set(label, rows);
  }

  return [...grouped.entries()].map(([label, rows]) => ({
    label,
    rows,
  }));
}

async function queryCourtesyRows(
  client: import("pg").PoolClient,
  openedAt: string,
  closedAt: string,
) {
  const result = await client.query<CourtesyRow>(
    `
      SELECT
        COALESCE(ct.nome, 'Bilheteria') AS autorizado_por,
        v.identificacao AS nome,
        COUNT(*)::text AS quantidade
      FROM voucher v
      JOIN compra c ON c.idcompra = v.idcompra
      LEFT JOIN cortesias ct ON ct.id = v.autorizado_por_id
      WHERE v.tpvoucher = 'corte'
        AND v.stusado <> 'inv'
        AND (c.dtcompra + COALESCE(c.hrcompra, '00:00'::time)) >= $1::timestamptz
        AND (c.dtcompra + COALESCE(c.hrcompra, '00:00'::time)) <= $2::timestamptz
      GROUP BY COALESCE(ct.nome, 'Bilheteria'), v.identificacao
      ORDER BY COALESCE(ct.nome, 'Bilheteria')
    `,
    [openedAt, closedAt],
  );

  return toCourtesyRows(result.rows);
}

async function queryPaymentTotals(
  client: import("pg").PoolClient,
  openedAt: string,
  closedAt: string,
  discounted: boolean,
) {
  const result = await client.query<{
    forma_pagamento: string | null;
    total: string | null;
  }>(
    `
      WITH vouchers AS (
        SELECT
          v.idcompra,
          SUM(
            CASE
              WHEN v.tpvoucher NOT IN ('corte', 'espec')
                AND ${discounted ? "v.desconto_id IS NOT NULL" : "v.desconto_id IS NULL"}
              THEN v.vlunicompra
              ELSE 0
            END
          ) AS total_vouchers
        FROM voucher v
        JOIN compra c ON c.idcompra = v.idcompra
        WHERE c.tpcompra IN ('bilhe', 'reser')
          AND c.stcompra = 'conc'
          AND c.formapag IS NOT NULL
          AND c.formapag <> 'N/A'
          AND (c.dtcompra + COALESCE(c.hrcompra, '00:00'::time)) >= $1::timestamptz
          AND (c.dtcompra + COALESCE(c.hrcompra, '00:00'::time)) <= $2::timestamptz
          AND v.stusado <> 'inv'
        GROUP BY v.idcompra
      ),
      payments AS (
        SELECT
          cp.idcompra,
          TRIM(cp.forma_pagamento) AS forma_pagamento,
          SUM(cp.valor) AS total_pagamento
        FROM compra_pagamentos cp
        JOIN compra c ON c.idcompra = cp.idcompra
        WHERE c.tpcompra IN ('bilhe', 'reser')
          AND c.stcompra = 'conc'
          AND c.formapag IS NOT NULL
          AND c.formapag <> 'N/A'
          AND (c.dtcompra + COALESCE(c.hrcompra, '00:00'::time)) >= $1::timestamptz
          AND (c.dtcompra + COALESCE(c.hrcompra, '00:00'::time)) <= $2::timestamptz
        GROUP BY cp.idcompra, TRIM(cp.forma_pagamento)
      )
      SELECT
        payments.forma_pagamento,
        COALESCE(
          SUM(
            CASE
              WHEN vouchers.total_vouchers > 0 THEN payments.total_pagamento
              ELSE 0
            END
          ),
          0
        )::text AS total
      FROM payments
      JOIN vouchers ON vouchers.idcompra = payments.idcompra
      GROUP BY payments.forma_pagamento
      ORDER BY payments.forma_pagamento
    `,
    [openedAt, closedAt],
  );

  return buildPaymentMap(result.rows);
}

async function buildClosureRawRangeData(
  client: import("pg").PoolClient,
  openedAt: string,
  closedAt: string,
) {
  const siteRows = await querySiteRows(client, openedAt, closedAt);
  const boxOfficeRows = await queryBoxOfficeRows(client, openedAt, closedAt);
  const discountGroups = await queryDiscountRows(client, openedAt, closedAt);
  const courtesyRows = await queryCourtesyRows(client, openedAt, closedAt);
  const forms = await queryPaymentTotals(client, openedAt, closedAt, false);
  const formsDesc = await queryPaymentTotals(client, openedAt, closedAt, true);
  const funds = await listCashMovementsByType(client, "fundo", openedAt, closedAt);
  const sangrias = await listCashMovementsByType(client, "sangria", openedAt, closedAt);

  const totalFund = roundMoney(
    funds.reduce((sum, item) => sum + normalizeNumber(item.value), 0),
  );
  const totalSangria = roundMoney(
    sangrias.reduce((sum, item) => sum + normalizeNumber(item.value), 0),
  );
  const cashSales = roundMoney((forms.dinhe ?? 0) + (formsDesc.dinhe ?? 0));
  const cashInDrawer = roundMoney(cashSales + totalFund - totalSangria);

  return {
    boxOfficeRows,
    cashInDrawer,
    courtesyRows,
    discountGroups,
    forms,
    formsDesc,
    funds,
    period: {
      closedAt,
      openedAt,
    },
    sangrias,
    siteRows,
    totalFund,
    totalSangria,
  };
}

export async function getBilheteriaCashFundSummary() {
  return getOperationalCashSummary();
}

export async function getBilheteriaCashClosureReport(
  closureId?: number | null,
): Promise<{
  closureId: number | null;
  isHistorical: boolean;
  printHref: string | null;
  report: BilheteriaCashClosureReportModel;
}> {
  if (closureId && Number.isInteger(closureId) && closureId > 0) {
    const detail = await getOperationalCashClosureDetail(closureId);
    const openedAt = detail.openedAt;
    const closedAt = detail.closedAt ?? detail.createdAt;

    if (!openedAt || !closedAt) {
      throw new Error("Fechamento sem periodo valido para consulta.");
    }

    const client = await getIngressoDbPool().connect();
    try {
      const raw = await buildClosureRawRangeData(client, openedAt, closedAt);
      return {
        closureId: detail.id,
        isHistorical: true,
        printHref: `/painel/fechamentos/${detail.id}/imprimir`,
        report: buildBilheteriaCashClosureReportModel(raw),
      };
    } finally {
      client.release();
    }
  }

  const client = await getIngressoDbPool().connect();
  try {
    await ensureCashPeriodsTable(client);
    const { summary } = await buildOperationalCashSummary(client);
    const openedAt = summary.period.openedAt;
    const closedAt = new Date().toISOString();

    if (!openedAt) {
      throw new Error("Periodo de caixa aberto sem data de abertura.");
    }

    const raw = await buildClosureRawRangeData(client, openedAt, closedAt);
    return {
      closureId: null,
      isHistorical: false,
      printHref: "/painel/fechamentos/imprimir",
      report: buildBilheteriaCashClosureReportModel(raw),
    };
  } finally {
    client.release();
  }
}

export async function listBilheteriaCashClosureHistory(input?: {
  page?: number;
  pageSize?: number;
}) {
  const page = input?.page && input.page > 0 ? input.page : 1;
  const pageSize = input?.pageSize && input.pageSize > 0 ? input.pageSize : 30;
  const offset = (page - 1) * pageSize;
  const data = await listOperationalCashClosures({
    limit: pageSize,
    offset,
  });

  return {
    items: data.items,
    page,
    pageSize,
    total: data.meta.total,
    totalPages: Math.max(1, Math.ceil(data.meta.total / pageSize)),
  };
}

export async function listBilheteriaCashEdits(input?: {
  closureId?: number | null;
  page?: number;
  pageSize?: number;
}) {
  const closureId =
    input?.closureId && input.closureId > 0 ? input.closureId : null;
  const page = input?.page && input.page > 0 ? input.page : 1;
  const pageSize = input?.pageSize && input.pageSize > 0 ? input.pageSize : 50;
  const offset = (page - 1) * pageSize;
  const pool = getIngressoDbPool();
  const client = await pool.connect();

  try {
    await ensureOpsAuditLogTable(client);

    let periodId: number | null = null;
    let sheetId: number | null = null;

    if (closureId) {
      const detail = await getOperationalCashClosureDetail(closureId);
      periodId = detail.periodId ?? null;
      sheetId = detail.id;
    } else {
      const summary = await getOperationalCashSummary();
      periodId = summary.period.id;
    }

    const whereClauses: string[] = [];
    const values: Array<number> = [];

    if (periodId) {
      values.push(periodId);
      whereClauses.push(`periodo_id = $${values.length}`);
    } else if (sheetId) {
      values.push(sheetId);
      whereClauses.push(`folha_id = $${values.length}`);
    } else {
      whereClauses.push("1 = 0");
    }

    values.push(pageSize);
    const limitIndex = values.length;
    values.push(offset);
    const offsetIndex = values.length;
    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const itemsResult = await client.query<AuditListRow>(
      `
        SELECT
          id,
          origem,
          acao,
          compra_id,
          movimentacao_id,
          movimentacao_tipo,
          descricao,
          motivo,
          usuario_nome,
          created_at::text AS created_at
        FROM edicoes_log
        ${whereSql}
        ORDER BY created_at DESC, id DESC
        LIMIT $${limitIndex}
        OFFSET $${offsetIndex}
      `,
      values,
    );

    const totalResult = await client.query<{ total: string }>(
      `
        SELECT COUNT(*)::text AS total
        FROM edicoes_log
        ${whereSql}
      `,
      values.slice(0, values.length - 2),
    );

    return {
      closureId,
      items: itemsResult.rows.map((row) => ({
        action: String(row.acao ?? "").trim(),
        createdAt: row.created_at,
        description: String(row.descricao ?? "").trim(),
        id: row.id,
        movementId: row.movimentacao_id,
        movementType: row.movimentacao_tipo ? String(row.movimentacao_tipo).trim() : null,
        origin: String(row.origem ?? "").trim(),
        purchaseId: row.compra_id,
        reason: String(row.motivo ?? "").trim(),
        userName: row.usuario_nome ? String(row.usuario_nome).trim() : null,
      })),
      page,
      pageSize,
      total: Number(totalResult.rows[0]?.total ?? 0),
      totalPages: Math.max(
        1,
        Math.ceil(Number(totalResult.rows[0]?.total ?? 0) / pageSize),
      ),
    };
  } finally {
    client.release();
  }
}
