import type { PoolClient } from "pg";
import { getIngressoDbPool } from "@/lib/ingresso-db";
import { ensureOpsAuditLogTable, registerOpsAuditLog } from "@/lib/ops-audit-log";
import {
  buildOperationalCashSummary,
  ensureCashPeriodsTable,
  getOrCreateOpenCashPeriod,
  listCashMovementsByType,
  type OperationalCashSummary,
} from "@/lib/ops-cash-management";

type CashClosureRow = {
  id: number;
  periodo_id: number | null;
  snapshot_json: string | null;
  totals_dinheiro: string | null;
  totals_fundo: string | null;
  totals_geral: string | null;
  created_at: string | null;
  periodo_aberto_em: string | null;
  periodo_fechado_em: string | null;
  periodo_operador: string | null;
};

export type OperationalCashClosureListItem = {
  id: number;
  periodId: number | null;
  openedAt: string | null;
  closedAt: string | null;
  operator: string | null;
  totals: {
    cash: string;
    fund: string;
    overall: string;
  };
  createdAt: string | null;
};

export type OperationalCashClosureList = {
  items: OperationalCashClosureListItem[];
  meta: {
    limit: number;
    offset: number;
    total: number;
  };
};

export type OperationalCashClosureDetail = OperationalCashClosureListItem & {
  snapshot: unknown;
};

type CashClosureActor = {
  name?: string | null;
  cpf?: string | null;
};

export type CloseOperationalCashClosureInput = {
  reason: string;
  operatorName: string;
  actor?: CashClosureActor | null;
};

export type CloseOperationalCashClosureSuccess = {
  action: "close";
  periodId: number;
  nextPeriodId: number;
  closure: OperationalCashClosureDetail;
  closedSummary: OperationalCashSummary;
  currentSummary: OperationalCashSummary;
  auditLogId: number | null;
  message: string;
};

export type AutoCloseOperationalCashClosuresInput = {
  reason: string;
  actor?: CashClosureActor | null;
};

export type AutoCloseOperationalCashClosuresSuccess = {
  action: "auto_close";
  closedCount: number;
  closedPeriodIds: number[];
  closureIds: number[];
  currentSummary: OperationalCashSummary;
  auditLogIds: number[];
  message: string;
};

class OperationalCashClosureError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "OperationalCashClosureError";
    this.code = code;
    this.status = status;
  }
}

function formatMoney(value: number) {
  return value.toFixed(2);
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function getActorUserName(actor?: CashClosureActor | null) {
  const actorName = String(actor?.name ?? "").trim();
  const actorCpf = String(actor?.cpf ?? "").trim();

  return actorName || actorCpf
    ? [actorName || null, actorCpf || null].filter(Boolean).join(" · ")
    : null;
}

function parseSnapshotJson(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function getSnapshotRecord(snapshot: unknown) {
  return snapshot && typeof snapshot === "object" ?
      (snapshot as Record<string, unknown>) :
      null;
}

function resolveSnapshotPeriod(
  snapshot: unknown,
  fallback: {
    openedAt: string | null;
    closedAt: string | null;
    operator: string | null;
  },
) {
  const record = getSnapshotRecord(snapshot);
  const period =
    record?.period && typeof record.period === "object" ?
      (record.period as Record<string, unknown>) :
      null;

  return {
    openedAt:
      typeof period?.ini === "string" && period.ini.trim() ?
        period.ini :
        fallback.openedAt,
    closedAt:
      typeof period?.fim === "string" && period.fim.trim() ?
        period.fim :
        fallback.closedAt,
    operator:
      typeof record?.operador === "string" && record.operador.trim() ?
        record.operador.trim() :
        fallback.operator,
  };
}

function mapCashClosureRow(row: CashClosureRow): OperationalCashClosureDetail {
  const snapshot = parseSnapshotJson(row.snapshot_json);
  const periodInfo = resolveSnapshotPeriod(snapshot, {
    openedAt: row.periodo_aberto_em,
    closedAt: row.periodo_fechado_em ?? row.created_at,
    operator: row.periodo_operador ? String(row.periodo_operador).trim() : null,
  });

  return {
    id: row.id,
    periodId: row.periodo_id,
    openedAt: periodInfo.openedAt,
    closedAt: periodInfo.closedAt,
    operator: periodInfo.operator,
    totals: {
      cash: formatMoney(Number(row.totals_dinheiro ?? 0)),
      fund: formatMoney(Number(row.totals_fundo ?? 0)),
      overall: formatMoney(Number(row.totals_geral ?? 0)),
    },
    createdAt: row.created_at,
    snapshot,
  };
}

async function getOperationalCashClosureDetailForClient(
  client: PoolClient,
  closureId: number,
) {
  const result = await client.query<CashClosureRow>(
    `
      SELECT
        fechamento.id,
        fechamento.periodo_id,
        fechamento.snapshot_json,
        fechamento.totals_dinheiro::text AS totals_dinheiro,
        fechamento.totals_fundo::text AS totals_fundo,
        fechamento.totals_geral::text AS totals_geral,
        fechamento.created_at::text AS created_at,
        periodo.aberto_em::text AS periodo_aberto_em,
        periodo.fechado_em::text AS periodo_fechado_em,
        periodo.operador AS periodo_operador
      ${buildCashClosuresBaseQuery()}
      WHERE fechamento.id = $1
      LIMIT 1
    `,
    [closureId],
  );

  const row = result.rows[0];

  if (!row) {
    throw new OperationalCashClosureError(
      "cash_closure_not_found",
      "Fechamento de caixa nao encontrado.",
      404,
    );
  }

  return mapCashClosureRow(row);
}

function buildCashClosuresBaseQuery() {
  return `
    FROM caixa_fechamentos fechamento
    LEFT JOIN caixa_periodos periodo
      ON periodo.folha_id = fechamento.id
      OR (
        fechamento.periodo_id IS NOT NULL
        AND periodo.id = fechamento.periodo_id
      )
  `;
}

async function ensureCashClosuresTable(client: PoolClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS caixa_fechamentos (
      id SERIAL PRIMARY KEY,
      periodo_id INTEGER NULL,
      snapshot_json TEXT NULL,
      totals_dinheiro NUMERIC(12,2) NOT NULL DEFAULT 0,
      totals_fundo NUMERIC(12,2) NOT NULL DEFAULT 0,
      totals_geral NUMERIC(12,2) NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await client.query(`
    ALTER TABLE caixa_fechamentos
    ADD COLUMN IF NOT EXISTS periodo_id INTEGER
  `);
}

export function asOperationalCashClosureError(error: unknown) {
  if (error instanceof OperationalCashClosureError) {
    return error;
  }

  return new OperationalCashClosureError(
    "ops_cash_closures_unavailable",
    "Nao foi possivel carregar o historico de fechamento agora.",
    502,
  );
}

export async function listOperationalCashClosures(input?: {
  limit?: number;
  offset?: number;
}): Promise<OperationalCashClosureList> {
  const limit = Number.isInteger(input?.limit) ? Math.min(Math.max(input!.limit!, 1), 100) : 20;
  const offset = Number.isInteger(input?.offset) ? Math.max(input!.offset!, 0) : 0;
  const pool = getIngressoDbPool();
  const client = await pool.connect();

  try {
    await ensureCashPeriodsTable(client);
    await ensureCashClosuresTable(client);

    const rows = await client.query<CashClosureRow>(
      `
        SELECT
          fechamento.id,
          fechamento.periodo_id,
          fechamento.snapshot_json,
          fechamento.totals_dinheiro::text AS totals_dinheiro,
          fechamento.totals_fundo::text AS totals_fundo,
          fechamento.totals_geral::text AS totals_geral,
          fechamento.created_at::text AS created_at,
          periodo.aberto_em::text AS periodo_aberto_em,
          periodo.fechado_em::text AS periodo_fechado_em,
          periodo.operador AS periodo_operador
        ${buildCashClosuresBaseQuery()}
        ORDER BY fechamento.id DESC
        LIMIT $1
        OFFSET $2
      `,
      [limit, offset],
    );

    const totalResult = await client.query<{ total: string }>(
      `
        SELECT COUNT(*)::text AS total
        ${buildCashClosuresBaseQuery()}
      `,
    );

    return {
      items: rows.rows.map((row) => {
        const detail = mapCashClosureRow(row);
        return {
          id: detail.id,
          periodId: detail.periodId,
          openedAt: detail.openedAt,
          closedAt: detail.closedAt,
          operator: detail.operator,
          totals: detail.totals,
          createdAt: detail.createdAt,
        };
      }),
      meta: {
        limit,
        offset,
        total: Number(totalResult.rows[0]?.total ?? 0),
      },
    };
  } finally {
    client.release();
  }
}

async function lockCashPeriod(client: PoolClient, periodId: number) {
  const result = await client.query<{
    id: number;
    aberto_em: string | null;
    fechado_em: string | null;
    operador: string | null;
    folha_id: number | null;
  }>(
    `
      SELECT
        id,
        aberto_em::text AS aberto_em,
        fechado_em::text AS fechado_em,
        operador,
        folha_id
      FROM caixa_periodos
      WHERE id = $1
      LIMIT 1
      FOR UPDATE
    `,
    [periodId],
  );

  return result.rows[0] ?? null;
}

async function createCashClosureRecord(
  client: PoolClient,
  periodId: number,
  snapshot: unknown,
  totals: {
    cash: string;
    fund: string;
    overall: string;
  },
) {
  const result = await client.query<{ id: number }>(
    `
      INSERT INTO caixa_fechamentos (
        periodo_id,
        snapshot_json,
        totals_dinheiro,
        totals_fundo,
        totals_geral,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING id
    `,
    [
      periodId,
      JSON.stringify(snapshot),
      totals.cash,
      totals.fund,
      totals.overall,
    ],
  );

  return result.rows[0]?.id ?? null;
}

async function getCurrentTimeText(client: PoolClient) {
  const result = await client.query<{ current_at: string }>(
    "SELECT NOW()::text AS current_at",
  );

  return String(result.rows[0]?.current_at ?? "").trim();
}

async function getNextLocalMidnightForPeriod(
  client: PoolClient,
  openedAt: string,
) {
  const result = await client.query<{ closed_at: string }>(
    `
      SELECT (
        (
          date_trunc('day', $1::timestamptz AT TIME ZONE 'America/Sao_Paulo')
          + interval '1 day'
        ) AT TIME ZONE 'America/Sao_Paulo'
      )::text AS closed_at
    `,
    [openedAt],
  );

  return String(result.rows[0]?.closed_at ?? "").trim();
}

async function closeCashPeriod(
  client: PoolClient,
  periodId: number,
  operatorName: string | null,
  closureId: number,
  closedAt: string,
  automatic: boolean,
) {
  await client.query(
    `
      UPDATE caixa_periodos
      SET fechado_em = $4,
          operador = $2,
          fechamento_auto = $5,
          folha_id = $3
      WHERE id = $1
    `,
    [periodId, operatorName, closureId, closedAt, automatic],
  );
}

async function openNextCashPeriod(client: PoolClient, openedAt?: string) {
  const result = await client.query<{ id: number }>(
    `
      INSERT INTO caixa_periodos (
        aberto_em,
        created_at
      ) VALUES (COALESCE($1::timestamptz, NOW()), NOW())
      RETURNING id
    `,
    [openedAt ?? null],
  );

  return result.rows[0]?.id ?? null;
}

async function bindAuditLogsToClosure(
  client: PoolClient,
  periodId: number,
  closureId: number,
) {
  await client.query(
    `
      UPDATE edicoes_log
      SET folha_id = $2
      WHERE periodo_id = $1
        AND folha_id IS NULL
    `,
    [periodId, closureId],
  );
}

async function markClosedVouchersForPeriod(
  client: PoolClient,
  periodId: number,
  openedAt: string,
  closedAt: string,
) {
  await client.query(
    `
      UPDATE voucher v
      SET periodo_id = $1,
          closed_at = NOW()
      FROM compra c
      WHERE v.periodo_id IS NULL
        AND v.stusado = 's'
        AND c.idcompra = v.idcompra
        AND c.tpcompra = 'ponli'
        AND (
          (v.dtuso::timestamp + COALESCE(v.hruso, '00:00'::time))
          BETWEEN $2::timestamptz AND $3::timestamptz
        )
    `,
    [periodId, openedAt, closedAt],
  );

  await client.query(
    `
      UPDATE voucher v
      SET periodo_id = $1,
          closed_at = NOW()
      FROM compra c
      WHERE v.periodo_id IS NULL
        AND c.idcompra = v.idcompra
        AND c.tpcompra <> 'ponli'
        AND (
          (c.dtcompra + COALESCE(c.hrcompra, '00:00'::time))
          BETWEEN $2::timestamptz AND $3::timestamptz
        )
    `,
    [periodId, openedAt, closedAt],
  );
}

async function getCashSalesTotalForRange(
  client: PoolClient,
  openedAt: string,
  closedAt: string,
) {
  const result = await client.query<{ total: string | null }>(
    `
      WITH voucher_totals AS (
        SELECT
          v.idcompra,
          SUM(
            CASE
              WHEN v.tpvoucher NOT IN ('corte', 'espec')
                AND v.stusado <> 'inv'
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
          AND (c.dtcompra + COALESCE(c.hrcompra, '00:00'::time))
            BETWEEN $1::timestamptz AND $2::timestamptz
        GROUP BY v.idcompra
      ),
      payment_totals AS (
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
          AND (c.dtcompra + COALESCE(c.hrcompra, '00:00'::time))
            BETWEEN $1::timestamptz AND $2::timestamptz
        GROUP BY cp.idcompra, TRIM(cp.forma_pagamento)
      )
      SELECT
        COALESCE(
          SUM(
            CASE
              WHEN payment_totals.forma_pagamento = 'dinhe'
                AND voucher_totals.total_vouchers > 0
              THEN payment_totals.total_pagamento
              ELSE 0
            END
          ),
          0
        )::text AS total
      FROM payment_totals
      JOIN voucher_totals ON voucher_totals.idcompra = payment_totals.idcompra
    `,
    [openedAt, closedAt],
  );

  return roundMoney(Number(result.rows[0]?.total ?? 0));
}

async function buildCashSummaryForRange(
  client: PoolClient,
  period: {
    id: number;
    openedAt: string;
    operator: string | null;
    closureSheetId: number | null;
  },
  closedAt: string,
) {
  const [funds, sangrias, cashSales] = await Promise.all([
    listCashMovementsByType(client, "fundo", period.openedAt, closedAt),
    listCashMovementsByType(client, "sangria", period.openedAt, closedAt),
    getCashSalesTotalForRange(client, period.openedAt, closedAt),
  ]);

  const totalFund = roundMoney(
    funds.reduce((sum, item) => sum + Number(item.value), 0),
  );
  const totalSangria = roundMoney(
    sangrias.reduce((sum, item) => sum + Number(item.value), 0),
  );
  const cashInDrawer = roundMoney(cashSales + totalFund - totalSangria);

  return {
    period: {
      id: period.id,
      openedAt: period.openedAt,
      closedAt,
      operator: period.operator,
      closureSheetId: period.closureSheetId,
    },
    funds,
    sangrias,
    totals: {
      cashSales: formatMoney(cashSales),
      fund: formatMoney(totalFund),
      sangria: formatMoney(totalSangria),
      cashInDrawer: formatMoney(cashInDrawer),
    },
  } satisfies OperationalCashSummary;
}

function buildClosureSnapshot(
  summary: OperationalCashSummary,
  options: {
    operatorName: string | null;
    automatic: boolean;
    closedAt: string;
  },
) {
  return {
    operador: options.operatorName,
    period: {
      ini: summary.period.openedAt,
      fim: options.closedAt,
    },
    fechamentoInfo: {
      auto: options.automatic,
      operador: options.operatorName,
      fechadoEm: options.closedAt,
    },
    funds: summary.funds,
    sangrias: summary.sangrias,
    totals: summary.totals,
  };
}

async function findNextStaleOpenCashPeriod(client: PoolClient) {
  const result = await client.query<{
    id: number;
    aberto_em: string | null;
    fechado_em: string | null;
    operador: string | null;
    folha_id: number | null;
  }>(
    `
      SELECT
        id,
        aberto_em::text AS aberto_em,
        fechado_em::text AS fechado_em,
        operador,
        folha_id
      FROM caixa_periodos
      WHERE fechado_em IS NULL
        AND (aberto_em AT TIME ZONE 'America/Sao_Paulo')::date < CURRENT_DATE
      ORDER BY aberto_em ASC
      LIMIT 1
      FOR UPDATE
    `,
  );

  return result.rows[0] ?? null;
}

async function closeCashPeriodInternal(
  client: PoolClient,
  options: {
    periodId: number;
    openedAt: string;
    operatorName: string | null;
    reason: string;
    automatic: boolean;
    closedAt: string;
    actor?: CashClosureActor | null;
  },
) {
  const summary = await buildCashSummaryForRange(
    client,
    {
      id: options.periodId,
      openedAt: options.openedAt,
      operator: options.operatorName,
      closureSheetId: null,
    },
    options.closedAt,
  );

  const closureId = await createCashClosureRecord(
    client,
    options.periodId,
    buildClosureSnapshot(summary, {
      operatorName: options.operatorName,
      automatic: options.automatic,
      closedAt: options.closedAt,
    }),
    {
      cash: summary.totals.cashSales,
      fund: summary.totals.fund,
      overall: summary.totals.cashInDrawer,
    },
  );

  if (!closureId) {
    throw new OperationalCashClosureError(
      "cash_closure_create_failed",
      "Nao foi possivel registrar o fechamento de caixa.",
      502,
    );
  }

  await closeCashPeriod(
    client,
    options.periodId,
    options.operatorName,
    closureId,
    options.closedAt,
    options.automatic,
  );
  await markClosedVouchersForPeriod(
    client,
    options.periodId,
    options.openedAt,
    options.closedAt,
  );
  await ensureOpsAuditLogTable(client);
  await bindAuditLogsToClosure(client, options.periodId, closureId);

  const auditLogId = await registerOpsAuditLog(client, {
    origem: "caixa",
    acao: options.automatic ? "fechar_auto" : "fechar",
    periodoId: options.periodId,
    folhaId: closureId,
    descricao: options.automatic ?
      `Fechamento automatico do periodo ${options.periodId}.` :
      `Fechamento de caixa concluido por ${options.operatorName}.`,
    motivo: options.reason,
    usuarioNome: getActorUserName(options.actor),
    detalhes: {
      closedSummary: summary.totals,
      closedAt: options.closedAt,
      automatic: options.automatic,
    },
  });

  return {
    closureId,
    auditLogId,
    summary,
    detail: await getOperationalCashClosureDetailForClient(client, closureId),
  };
}

export async function getOperationalCashClosureDetail(
  closureId: number,
): Promise<OperationalCashClosureDetail> {
  if (!Number.isInteger(closureId) || closureId <= 0) {
    throw new OperationalCashClosureError(
      "invalid_cash_closure_id",
      "Informe um closureId valido para consultar o fechamento.",
      400,
    );
  }

  const pool = getIngressoDbPool();
  const client = await pool.connect();

  try {
    await ensureCashPeriodsTable(client);
    await ensureCashClosuresTable(client);

    return await getOperationalCashClosureDetailForClient(client, closureId);
  } finally {
    client.release();
  }
}

export async function closeOperationalCashClosure(
  input: CloseOperationalCashClosureInput,
): Promise<CloseOperationalCashClosureSuccess> {
  const reason = String(input.reason ?? "").trim();
  const operatorName = String(input.operatorName ?? "").trim();

  if (!operatorName) {
    throw new OperationalCashClosureError(
      "invalid_cash_closure_operator",
      "Informe o operador responsavel pelo fechamento.",
      400,
    );
  }

  if (!reason) {
    throw new OperationalCashClosureError(
      "invalid_cash_closure_reason",
      "Informe o motivo do fechamento de caixa.",
      400,
    );
  }

  const pool = getIngressoDbPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await ensureCashPeriodsTable(client);
    await ensureCashClosuresTable(client);

    const openPeriod = await getOrCreateOpenCashPeriod(client);
    const lockedPeriod = await lockCashPeriod(client, openPeriod.id);

    if (!lockedPeriod) {
      throw new OperationalCashClosureError(
        "cash_period_not_found",
        "Periodo de caixa aberto nao encontrado.",
        404,
      );
    }

    if (lockedPeriod.fechado_em) {
      throw new OperationalCashClosureError(
        "cash_period_already_closed",
        "O periodo de caixa atual ja foi fechado.",
        409,
      );
    }

    const openedAt = String(lockedPeriod.aberto_em ?? "").trim();

    if (!openedAt) {
      throw new OperationalCashClosureError(
        "cash_period_opened_at_missing",
        "Periodo de caixa sem data de abertura valida.",
        409,
      );
    }

    const closedAt = await getCurrentTimeText(client);
    const closedClosure = await closeCashPeriodInternal(client, {
      periodId: lockedPeriod.id,
      openedAt,
      operatorName,
      reason,
      automatic: false,
      closedAt,
      actor: input.actor,
    });

    const nextPeriodId = await openNextCashPeriod(client, closedAt);
    const { summary: currentSummary } = await buildOperationalCashSummary(client);

    await client.query("COMMIT");

    return {
      action: "close",
      periodId: lockedPeriod.id,
      nextPeriodId: nextPeriodId ?? currentSummary.period.id,
      closure: closedClosure.detail,
      closedSummary: closedClosure.summary,
      currentSummary,
      auditLogId: closedClosure.auditLogId,
      message: "Caixa fechado com sucesso.",
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function autoCloseOperationalCashClosures(
  input: AutoCloseOperationalCashClosuresInput,
): Promise<AutoCloseOperationalCashClosuresSuccess> {
  const reason = String(input.reason ?? "").trim();

  if (!reason) {
    throw new OperationalCashClosureError(
      "invalid_cash_closure_reason",
      "Informe o motivo do fechamento automatico de caixa.",
      400,
    );
  }

  const pool = getIngressoDbPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await ensureCashPeriodsTable(client);
    await ensureCashClosuresTable(client);
    await ensureOpsAuditLogTable(client);

    const closedPeriodIds: number[] = [];
    const closureIds: number[] = [];
    const auditLogIds: number[] = [];

    for (let index = 0; index < 90; index += 1) {
      const stalePeriod = await findNextStaleOpenCashPeriod(client);

      if (!stalePeriod) {
        break;
      }

      const openedAt = String(stalePeriod.aberto_em ?? "").trim();

      if (!openedAt) {
        throw new OperationalCashClosureError(
          "cash_period_opened_at_missing",
          "Periodo de caixa sem data de abertura valida.",
          409,
        );
      }

      const closedAt = await getNextLocalMidnightForPeriod(client, openedAt);
      const closedClosure = await closeCashPeriodInternal(client, {
        periodId: stalePeriod.id,
        openedAt,
        operatorName: stalePeriod.operador ? String(stalePeriod.operador).trim() : null,
        reason,
        automatic: true,
        closedAt,
        actor: input.actor,
      });

      closedPeriodIds.push(stalePeriod.id);
      closureIds.push(closedClosure.closureId);

      if (closedClosure.auditLogId != null) {
        auditLogIds.push(closedClosure.auditLogId);
      }

      await openNextCashPeriod(client, closedAt);
    }

    const { summary: currentSummary } = await buildOperationalCashSummary(client);

    await client.query("COMMIT");

    return {
      action: "auto_close",
      closedCount: closedPeriodIds.length,
      closedPeriodIds,
      closureIds,
      currentSummary,
      auditLogIds,
      message:
        closedPeriodIds.length > 0
          ? `${closedPeriodIds.length} periodo(s) anterior(es) fechados automaticamente.`
          : "Nenhum periodo anterior elegivel para fechamento automatico.",
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
