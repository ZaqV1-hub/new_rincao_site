import type { PoolClient } from "pg";
import { getIngressoDbPool } from "@/lib/ingresso-db";
import { registerOpsAuditLog } from "@/lib/ops-audit-log";

type CashPeriodRow = {
  id: number;
  aberto_em: string | null;
  fechado_em: string | null;
  operador: string | null;
  folha_id: number | null;
};

type CashMovementRow = {
  id: number;
  tipo: string | null;
  responsavel: string | null;
  valor: string | null;
  data_hora: string | null;
};

type CashSalesTotalRow = {
  total: string | null;
};

type CashMovementActor = {
  name?: string | null;
  cpf?: string | null;
};

export type OperationalCashMovementType = "fundo" | "sangria";

export type OperationalCashMovement = {
  id: number;
  type: OperationalCashMovementType;
  responsible: string;
  value: string;
  createdAt: string | null;
};

export type OperationalCashSummary = {
  period: {
    id: number;
    openedAt: string | null;
    closedAt: string | null;
    operator: string | null;
    closureSheetId: number | null;
  };
  funds: OperationalCashMovement[];
  sangrias: OperationalCashMovement[];
  totals: {
    cashSales: string;
    fund: string;
    sangria: string;
    cashInDrawer: string;
  };
};

export type CreateOperationalCashMovementInput = {
  type: OperationalCashMovementType;
  responsible: string;
  value: string | number;
  reason: string;
  actor?: CashMovementActor | null;
};

export type CreateOperationalCashMovementSuccess = {
  action: "create";
  movement: OperationalCashMovement;
  summary: OperationalCashSummary;
  auditLogId: number | null;
  message: string;
};

export type UpdateOperationalCashMovementInput = {
  movementId: number;
  responsible: string;
  value: string | number;
  reason: string;
  actor?: CashMovementActor | null;
};

export type UpdateOperationalCashMovementSuccess = {
  action: "update";
  movement: OperationalCashMovement;
  summary: OperationalCashSummary;
  auditLogId: number | null;
  message: string;
  unchanged?: boolean;
};

export type DeleteOperationalCashMovementInput = {
  movementId: number;
  reason: string;
  actor?: CashMovementActor | null;
};

export type DeleteOperationalCashMovementSuccess = {
  action: "delete";
  movementId: number;
  movementType: OperationalCashMovementType;
  summary: OperationalCashSummary;
  auditLogId: number | null;
  message: string;
};

class OperationalCashError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "OperationalCashError";
    this.code = code;
    this.status = status;
  }
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatMoney(value: number) {
  return roundMoney(value).toFixed(2);
}

function parseMoneyInput(value: string | number | null | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? roundMoney(value) : null;
  }

  const raw = String(value ?? "").trim().replace(/^R\\$\\s*/i, "");
  const normalized =
    raw.includes(",") && raw.includes(".")
      ? raw.replace(/\\./g, "").replace(",", ".")
      : raw.includes(",")
        ? raw.replace(",", ".")
        : raw;

  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? roundMoney(parsed) : null;
}

function normalizeCashMovementType(value: unknown) {
  return value === "fundo" || value === "sangria" ?
      value :
      null;
}

function toOperationalCashMovement(
  row: CashMovementRow,
): OperationalCashMovement {
  return {
    id: row.id,
    type: normalizeCashMovementType(row.tipo) ?? "fundo",
    responsible: String(row.responsavel ?? "").trim(),
    value: formatMoney(Number(row.valor ?? 0)),
    createdAt: row.data_hora,
  };
}

function getActorUserName(actor?: CashMovementActor | null) {
  const actorName = String(actor?.name ?? "").trim();
  const actorCpf = String(actor?.cpf ?? "").trim();

  return actorName || actorCpf
    ? [actorName || null, actorCpf || null].filter(Boolean).join(" · ")
    : null;
}

function buildCashMovementDescription(
  oldMovement: OperationalCashMovement,
  newResponsible: string,
  newValue: string,
) {
  const changes: string[] = [];

  if (oldMovement.responsible !== newResponsible) {
    changes.push(
      `Responsavel alterado de ${oldMovement.responsible} para ${newResponsible}.`,
    );
  }

  if (oldMovement.value !== newValue) {
    changes.push(`Valor alterado de ${oldMovement.value} para ${newValue}.`);
  }

  return changes.join(" ");
}

export function asOperationalCashError(error: unknown) {
  if (error instanceof OperationalCashError) {
    return error;
  }

  return new OperationalCashError(
    "ops_cash_unavailable",
    "Nao foi possivel operar o caixa agora.",
    502,
  );
}

export async function ensureCashPeriodsTable(client: PoolClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS caixa_periodos (
      id SERIAL PRIMARY KEY,
      aberto_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      fechado_em TIMESTAMPTZ NULL,
      operador VARCHAR(255) NULL,
      fechamento_auto BOOLEAN NOT NULL DEFAULT FALSE,
      folha_id INTEGER NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await client.query(
    "CREATE INDEX IF NOT EXISTS idx_caixa_periodos_fechado_em ON caixa_periodos (fechado_em, id DESC)",
  );
}

export async function ensureCashMovementsTable(client: PoolClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS movimentacao_caixa (
      id SERIAL PRIMARY KEY,
      tipo VARCHAR(20) NOT NULL,
      responsavel VARCHAR(255) NOT NULL,
      valor NUMERIC(12,2) NOT NULL,
      data_hora TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await client.query(`
    ALTER TABLE movimentacao_caixa
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ
  `);
  await client.query(`
    UPDATE movimentacao_caixa
    SET created_at = data_hora
    WHERE created_at IS NULL
  `);
  await client.query(`
    ALTER TABLE movimentacao_caixa
    ALTER COLUMN created_at SET DEFAULT NOW()
  `);
  await client.query(
    "CREATE INDEX IF NOT EXISTS idx_movimentacao_caixa_tipo_data_hora ON movimentacao_caixa (tipo, data_hora DESC)",
  );
}

export async function getOrCreateOpenCashPeriod(client: PoolClient) {
  await ensureCashPeriodsTable(client);

  const openResult = await client.query<CashPeriodRow>(
    `
      SELECT
        id,
        aberto_em::text AS aberto_em,
        fechado_em::text AS fechado_em,
        operador,
        folha_id
      FROM caixa_periodos
      WHERE fechado_em IS NULL
      ORDER BY id DESC
      LIMIT 1
    `,
  );

  const existing = openResult.rows[0];

  if (existing) {
    return existing;
  }

  const insertResult = await client.query<CashPeriodRow>(
    `
      INSERT INTO caixa_periodos (
        aberto_em,
        created_at
      ) VALUES (NOW(), NOW())
      RETURNING
        id,
        aberto_em::text AS aberto_em,
        fechado_em::text AS fechado_em,
        operador,
        folha_id
    `,
  );

  return insertResult.rows[0];
}

export async function listCashMovementsByType(
  client: PoolClient,
  type: OperationalCashMovementType,
  openedAt: string | null,
  closedAt?: string | null,
) {
  await ensureCashMovementsTable(client);

  const result = await client.query<CashMovementRow>(
    `
      SELECT
        id,
        tipo,
        responsavel,
        valor::text AS valor,
        data_hora::text AS data_hora
      FROM movimentacao_caixa
      WHERE tipo = $1
        AND ($2::timestamptz IS NULL OR data_hora >= $2::timestamptz)
        AND data_hora <= COALESCE($3::timestamptz, CURRENT_TIMESTAMP)
      ORDER BY data_hora ASC, id ASC
    `,
    [type, openedAt, closedAt ?? null],
  );

  return result.rows.map(toOperationalCashMovement);
}

async function getCashMovementById(client: PoolClient, movementId: number) {
  await ensureCashMovementsTable(client);

  const result = await client.query<CashMovementRow>(
    `
      SELECT
        id,
        tipo,
        responsavel,
        valor::text AS valor,
        data_hora::text AS data_hora
      FROM movimentacao_caixa
      WHERE id = $1
      LIMIT 1
      FOR UPDATE
    `,
    [movementId],
  );

  return result.rows[0] ? toOperationalCashMovement(result.rows[0]) : null;
}

async function updateCashMovementRecord(
  client: PoolClient,
  movementId: number,
  responsible: string,
  value: string,
) {
  const result = await client.query<CashMovementRow>(
    `
      UPDATE movimentacao_caixa
      SET responsavel = $2,
          valor = $3
      WHERE id = $1
      RETURNING
        id,
        tipo,
        responsavel,
        valor::text AS valor,
        data_hora::text AS data_hora
    `,
    [movementId, responsible, value],
  );

  return result.rows[0] ? toOperationalCashMovement(result.rows[0]) : null;
}

async function deleteCashMovementRecord(client: PoolClient, movementId: number) {
  await client.query("DELETE FROM movimentacao_caixa WHERE id = $1", [movementId]);
}

async function getCashSalesTotal(client: PoolClient, openedAt: string | null) {
  const values = [openedAt];
  const result = await client.query<CashSalesTotalRow>(
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
          AND ($1::timestamptz IS NULL OR (c.dtcompra + COALESCE(c.hrcompra, '00:00'::time)) >= $1::timestamptz)
          AND (c.dtcompra + COALESCE(c.hrcompra, '00:00'::time)) <= CURRENT_TIMESTAMP
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
          AND ($1::timestamptz IS NULL OR (c.dtcompra + COALESCE(c.hrcompra, '00:00'::time)) >= $1::timestamptz)
          AND (c.dtcompra + COALESCE(c.hrcompra, '00:00'::time)) <= CURRENT_TIMESTAMP
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
    values,
  );

  return roundMoney(Number(result.rows[0]?.total ?? 0));
}

export async function buildOperationalCashSummary(client: PoolClient) {
  const period = await getOrCreateOpenCashPeriod(client);
  const [funds, sangrias, cashSales] = await Promise.all([
    listCashMovementsByType(client, "fundo", period.aberto_em),
    listCashMovementsByType(client, "sangria", period.aberto_em),
    getCashSalesTotal(client, period.aberto_em),
  ]);

  const totalFund = roundMoney(
    funds.reduce((sum, item) => sum + Number(item.value), 0),
  );
  const totalSangria = roundMoney(
    sangrias.reduce((sum, item) => sum + Number(item.value), 0),
  );
  const cashInDrawer = roundMoney(cashSales + totalFund - totalSangria);

  return {
    summary: {
      period: {
        id: period.id,
        openedAt: period.aberto_em,
        closedAt: period.fechado_em,
        operator: period.operador ? String(period.operador).trim() : null,
        closureSheetId: period.folha_id,
      },
      funds,
      sangrias,
      totals: {
        cashSales: formatMoney(cashSales),
        fund: formatMoney(totalFund),
        sangria: formatMoney(totalSangria),
        cashInDrawer: formatMoney(cashInDrawer),
      },
    } satisfies OperationalCashSummary,
    numericTotals: {
      cashSales,
      totalFund,
      totalSangria,
      cashInDrawer,
    },
    periodId: period.id,
  };
}

export async function getOperationalCashSummary(): Promise<OperationalCashSummary> {
  const pool = getIngressoDbPool();
  const client = await pool.connect();

  try {
    const { summary } = await buildOperationalCashSummary(client);
    return summary;
  } finally {
    client.release();
  }
}

export async function createOperationalCashMovement(
  input: CreateOperationalCashMovementInput,
): Promise<CreateOperationalCashMovementSuccess> {
  const type = normalizeCashMovementType(input.type);
  const responsible = String(input.responsible ?? "").trim();
  const reason = String(input.reason ?? "").trim();
  const value = parseMoneyInput(input.value);

  if (!type) {
    throw new OperationalCashError(
      "invalid_cash_movement_type",
      "Informe um tipo de lancamento valido: fundo ou sangria.",
      400,
    );
  }

  if (!responsible) {
    throw new OperationalCashError(
      "invalid_cash_responsible",
      "Informe o responsavel pelo lancamento de caixa.",
      400,
    );
  }

  if (value == null || value <= 0) {
    throw new OperationalCashError(
      "invalid_cash_value",
      "Informe um valor valido para o lancamento de caixa.",
      400,
    );
  }

  if (!reason) {
    throw new OperationalCashError(
      "invalid_cash_reason",
      "Informe o motivo do lancamento de caixa.",
      400,
    );
  }

  const pool = getIngressoDbPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { summary: beforeSummary, numericTotals, periodId } =
      await buildOperationalCashSummary(client);

    if (type === "sangria" && value > numericTotals.cashInDrawer + 0.0001) {
      throw new OperationalCashError(
        "cash_movement_exceeds_available",
        "Nao e possivel retirar mais do que o valor disponivel em caixa.",
        409,
      );
    }

    await ensureCashMovementsTable(client);

    const movementResult = await client.query<CashMovementRow>(
      `
        INSERT INTO movimentacao_caixa (
          tipo,
          responsavel,
          valor,
          data_hora,
          created_at
        ) VALUES ($1, $2, $3, NOW(), NOW())
        RETURNING
          id,
          tipo,
          responsavel,
          valor::text AS valor,
          data_hora::text AS data_hora
      `,
      [type, responsible, formatMoney(value)],
    );

    const movement = toOperationalCashMovement(movementResult.rows[0]);
    const { summary } = await buildOperationalCashSummary(client);
    const userName = getActorUserName(input.actor);
    const auditLogId = await registerOpsAuditLog(client, {
      origem: "caixa",
      acao: "criar",
      movimentacaoId: movement.id,
      movimentacaoTipo: movement.type,
      periodoId: periodId,
      descricao:
        type === "fundo"
          ? `Fundo de caixa registrado para ${responsible}.`
          : `Sangria registrada para ${responsible}.`,
      motivo: reason,
      usuarioNome: userName,
      detalhes: {
        movementId: movement.id,
        movementType: type,
        before: beforeSummary.totals,
        after: summary.totals,
        movement: {
          responsible: movement.responsible,
          value: movement.value,
          createdAt: movement.createdAt,
        },
      },
    });

    await client.query("COMMIT");

    return {
      action: "create",
      movement,
      summary,
      auditLogId,
      message:
        type === "fundo"
          ? "Fundo de caixa registrado com sucesso."
          : "Sangria registrada com sucesso.",
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function updateOperationalCashMovement(
  input: UpdateOperationalCashMovementInput,
): Promise<UpdateOperationalCashMovementSuccess> {
  const movementId = Number(input.movementId);
  const responsible = String(input.responsible ?? "").trim();
  const reason = String(input.reason ?? "").trim();
  const value = parseMoneyInput(input.value);

  if (!Number.isInteger(movementId) || movementId <= 0) {
    throw new OperationalCashError(
      "invalid_cash_movement_id",
      "Informe um movementId valido para editar o lancamento.",
      400,
    );
  }

  if (!responsible) {
    throw new OperationalCashError(
      "invalid_cash_responsible",
      "Informe o responsavel pelo lancamento de caixa.",
      400,
    );
  }

  if (value == null || value <= 0) {
    throw new OperationalCashError(
      "invalid_cash_value",
      "Informe um valor valido para o lancamento de caixa.",
      400,
    );
  }

  if (!reason) {
    throw new OperationalCashError(
      "invalid_cash_reason",
      "Informe o motivo da alteracao de caixa.",
      400,
    );
  }

  const pool = getIngressoDbPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { summary: beforeSummary, numericTotals, periodId } =
      await buildOperationalCashSummary(client);
    const currentMovement = await getCashMovementById(client, movementId);

    if (!currentMovement) {
      throw new OperationalCashError(
        "cash_movement_not_found",
        "Lancamento de caixa nao encontrado.",
        404,
      );
    }

    if (
      currentMovement.type === "sangria" &&
      value > numericTotals.cashInDrawer + Number(currentMovement.value) + 0.0001
    ) {
      throw new OperationalCashError(
        "cash_movement_exceeds_available",
        "Nao e possivel retirar mais do que o valor disponivel em caixa.",
        409,
      );
    }

    const nextValue = formatMoney(value);

    if (
      currentMovement.responsible === responsible &&
      currentMovement.value === nextValue
    ) {
      await client.query("COMMIT");

      return {
        action: "update",
        movement: currentMovement,
        summary: beforeSummary,
        auditLogId: null,
        message: "Nenhuma alteracao detectada.",
        unchanged: true,
      };
    }

    const movement = await updateCashMovementRecord(
      client,
      movementId,
      responsible,
      nextValue,
    );

    if (!movement) {
      throw new OperationalCashError(
        "cash_movement_not_found",
        "Lancamento de caixa nao encontrado.",
        404,
      );
    }

    const { summary } = await buildOperationalCashSummary(client);
    const auditLogId = await registerOpsAuditLog(client, {
      origem: "caixa",
      acao: "editar",
      movimentacaoId: movement.id,
      movimentacaoTipo: movement.type,
      periodoId: periodId,
      descricao: buildCashMovementDescription(
        currentMovement,
        movement.responsible,
        movement.value,
      ),
      motivo: reason,
      usuarioNome: getActorUserName(input.actor),
      detalhes: {
        before: {
          responsible: currentMovement.responsible,
          value: currentMovement.value,
        },
        after: {
          responsible: movement.responsible,
          value: movement.value,
        },
        beforeTotals: beforeSummary.totals,
        afterTotals: summary.totals,
      },
    });

    await client.query("COMMIT");

    return {
      action: "update",
      movement,
      summary,
      auditLogId,
      message: "Lancamento atualizado.",
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteOperationalCashMovement(
  input: DeleteOperationalCashMovementInput,
): Promise<DeleteOperationalCashMovementSuccess> {
  const movementId = Number(input.movementId);
  const reason = String(input.reason ?? "").trim();

  if (!Number.isInteger(movementId) || movementId <= 0) {
    throw new OperationalCashError(
      "invalid_cash_movement_id",
      "Informe um movementId valido para excluir o lancamento.",
      400,
    );
  }

  if (!reason) {
    throw new OperationalCashError(
      "invalid_cash_reason",
      "Informe o motivo da exclusao de caixa.",
      400,
    );
  }

  const pool = getIngressoDbPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { summary: beforeSummary, periodId } = await buildOperationalCashSummary(client);
    const currentMovement = await getCashMovementById(client, movementId);

    if (!currentMovement) {
      throw new OperationalCashError(
        "cash_movement_not_found",
        "Lancamento de caixa nao encontrado.",
        404,
      );
    }

    await deleteCashMovementRecord(client, movementId);

    const { summary } = await buildOperationalCashSummary(client);
    const auditLogId = await registerOpsAuditLog(client, {
      origem: "caixa",
      acao: "excluir",
      movimentacaoId: currentMovement.id,
      movimentacaoTipo: currentMovement.type,
      periodoId: periodId,
      descricao:
        `Registro excluido. Responsavel: ${currentMovement.responsible}. ` +
        `Valor: ${currentMovement.value}.`,
      motivo: reason,
      usuarioNome: getActorUserName(input.actor),
      detalhes: {
        before: {
          responsible: currentMovement.responsible,
          value: currentMovement.value,
          createdAt: currentMovement.createdAt,
        },
        beforeTotals: beforeSummary.totals,
        afterTotals: summary.totals,
      },
    });

    await client.query("COMMIT");

    return {
      action: "delete",
      movementId: currentMovement.id,
      movementType: currentMovement.type,
      summary,
      auditLogId,
      message: "Lancamento excluido.",
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
