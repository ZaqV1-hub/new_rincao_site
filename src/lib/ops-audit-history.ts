import { getIngressoDbPool } from "@/lib/ingresso-db";
import { ensureOpsAuditLogTable } from "@/lib/ops-audit-log";

type AuditRow = {
  id: number;
  origem: string | null;
  acao: string | null;
  compra_id: number | null;
  descricao: string | null;
  motivo: string | null;
  usuario_nome: string | null;
  detalhes_json: string | null;
  created_at: string | null;
};

export type OpsAuditLogItem = {
  id: number;
  origin: string;
  action: string;
  purchaseId: number | null;
  description: string;
  reason: string;
  userName: string | null;
  details: unknown;
  createdAt: string | null;
};

export type OpsAuditLogList = {
  items: OpsAuditLogItem[];
  meta: {
    limit: number;
    offset: number;
    total: number;
    purchaseId: number | null;
    voucherId: number | null;
    agendaId: number | null;
  };
};

type OpsAuditHistoryInput = {
  purchaseId?: number | null;
  voucherId?: number | null;
  agendaId?: number | null;
  limit?: number;
  offset?: number;
};

class OpsAuditHistoryError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "OpsAuditHistoryError";
    this.code = code;
    this.status = status;
  }
}

function parseDetailsJson(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

export function asOpsAuditHistoryError(error: unknown) {
  if (error instanceof OpsAuditHistoryError) {
    return error;
  }

  return new OpsAuditHistoryError(
    "ops_audit_history_unavailable",
    "Nao foi possivel carregar a auditoria operacional agora.",
    502,
  );
}

function normalizeOptionalId(value: unknown) {
  return value == null ? null : Number(value);
}

function getDetailsJsonExpression() {
  return `CASE
    WHEN detalhes_json IS NULL OR btrim(detalhes_json) = '' THEN '{}'::jsonb
    ELSE detalhes_json::jsonb
  END`;
}

export async function listOperationalAuditLogs(
  input?: OpsAuditHistoryInput,
): Promise<OpsAuditLogList> {
  const purchaseId = normalizeOptionalId(input?.purchaseId);
  const voucherId = normalizeOptionalId(input?.voucherId);
  const agendaId = normalizeOptionalId(input?.agendaId);
  const limit = Number.isInteger(input?.limit) ? Math.min(Math.max(input!.limit!, 1), 100) : 20;
  const offset = Number.isInteger(input?.offset) ? Math.max(input!.offset!, 0) : 0;

  if (purchaseId !== null && (!Number.isInteger(purchaseId) || purchaseId <= 0)) {
    throw new OpsAuditHistoryError(
      "invalid_purchase_id",
      "Informe um purchaseId valido para filtrar a auditoria.",
      400,
    );
  }

  if (voucherId !== null && (!Number.isInteger(voucherId) || voucherId <= 0)) {
    throw new OpsAuditHistoryError(
      "invalid_voucher_id",
      "Informe um voucherId valido para filtrar a auditoria.",
      400,
    );
  }

  if (agendaId !== null && (!Number.isInteger(agendaId) || agendaId <= 0)) {
    throw new OpsAuditHistoryError(
      "invalid_agenda_id",
      "Informe um agendaId valido para filtrar a auditoria.",
      400,
    );
  }

  const pool = getIngressoDbPool();
  const client = await pool.connect();

  try {
    await ensureOpsAuditLogTable(client);

    const values: Array<number> = [];
    const where: string[] = [];
    const detailsJson = getDetailsJsonExpression();

    if (purchaseId !== null) {
      values.push(purchaseId);
      where.push(`compra_id = $${values.length}`);
    }

    if (voucherId !== null) {
      values.push(voucherId);
      where.push(
        `${detailsJson} @> jsonb_build_object('affectedVoucherIds', jsonb_build_array($${values.length}))`,
      );
    }

    if (agendaId !== null) {
      values.push(agendaId);
      const agendaValueIndex = values.length;
      values.push(agendaId);
      const agendaArrayIndex = values.length;
      where.push(
        `(${detailsJson} @> jsonb_build_object('agendaId', $${agendaValueIndex}) OR ${detailsJson} @> jsonb_build_object('affectedAgendaIds', jsonb_build_array($${agendaArrayIndex})))`,
      );
    }

    values.push(limit);
    const limitIndex = values.length;
    values.push(offset);
    const offsetIndex = values.length;
    const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

    const itemsResult = await client.query<AuditRow>(
      `
        SELECT
          id,
          origem,
          acao,
          compra_id,
          descricao,
          motivo,
          usuario_nome,
          detalhes_json,
          created_at::text AS created_at
        FROM edicoes_log
        ${whereClause}
        ORDER BY created_at DESC, id DESC
        LIMIT $${limitIndex}
        OFFSET $${offsetIndex}
      `,
      values,
    );

    const countValues = values.slice(0, values.length - 2);
    const countWhereClause = whereClause;
    const totalResult = await client.query<{ total: string }>(
      `
        SELECT COUNT(*)::text AS total
        FROM edicoes_log
        ${countWhereClause}
      `,
      countValues,
    );

    return {
      items: itemsResult.rows.map((row) => ({
        id: row.id,
        origin: String(row.origem ?? "").trim(),
        action: String(row.acao ?? "").trim(),
        purchaseId: row.compra_id,
        description: String(row.descricao ?? "").trim(),
        reason: String(row.motivo ?? "").trim(),
        userName: row.usuario_nome ? String(row.usuario_nome).trim() : null,
        details: parseDetailsJson(row.detalhes_json),
        createdAt: row.created_at,
      })),
      meta: {
        limit,
        offset,
        total: Number(totalResult.rows[0]?.total ?? 0),
        purchaseId,
        voucherId,
        agendaId,
      },
    };
  } finally {
    client.release();
  }
}
