import type { PoolClient } from "pg";
import { getIngressoDbPool } from "@/lib/ingresso-db";

type OperationalJobRunRow = {
  id: number;
  job_name: string;
  trigger_source: string;
  initiated_by: string | null;
  status: string;
  message: string;
  summary_json: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string | null;
};

export type OperationalJobRunListItem = {
  id: number;
  jobName: string;
  triggerSource: string;
  initiatedBy: string | null;
  status: string;
  message: string;
  summary: unknown;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string | null;
};

export type OperationalJobRunList = {
  items: OperationalJobRunListItem[];
  meta: {
    limit: number;
    offset: number;
    total: number;
    jobName: string | null;
  };
};

export type OperationalJobHealth = {
  jobName: string;
  triggerSource: "manual" | "scheduled";
  maxAgeMinutes: number;
  healthy: boolean;
  status: "healthy" | "stale" | "failed" | "missing";
  message: string;
  recommendedActions: string[];
  ageMinutes: number | null;
  latestRun: OperationalJobRunListItem | null;
  lastSuccessAt: string | null;
};

type RecordOperationalJobRunInput = {
  jobName: string;
  triggerSource: "manual" | "scheduled";
  initiatedBy?: string | null;
  status: string;
  message: string;
  summary?: unknown;
  startedAt?: string | null;
  finishedAt?: string | null;
};

let operationalJobRunsTableReady = false;

function parseJson(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function toItem(row: OperationalJobRunRow): OperationalJobRunListItem {
  return {
    id: row.id,
    jobName: row.job_name,
    triggerSource: row.trigger_source,
    initiatedBy: row.initiated_by,
    status: row.status,
    message: row.message,
    summary: parseJson(row.summary_json),
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    createdAt: row.created_at,
  };
}

function getJobHealthActions(status: OperationalJobHealth["status"]) {
  if (status === "healthy") {
    return [];
  }

  if (status === "failed") {
    return [
      "Abrir o historico de jobs e identificar a etapa com falha.",
      "Corrigir segredo, conectividade ou dependencia externa indicada no resumo.",
      "Rerodar a rotina diaria manualmente pela console operacional.",
      "Revalidar o health check apos a rodada manual.",
    ];
  }

  if (status === "stale") {
    return [
      "Confirmar que o scheduler externo esta ativo.",
      "Validar OPS_JOBS_BASE_URL e o token INGRESSO_OPERATIONS_JOBS_TOKEN.",
      "Executar uma rodada manual pela console operacional.",
      "Revalidar o health check dentro da janela esperada.",
    ];
  }

  return [
    "Confirmar se a rota agendada ja foi ligada no scheduler externo.",
    "Executar a rotina diaria manualmente para criar a primeira evidencia.",
    "Validar o historico de jobs e o health check apos a primeira execucao.",
  ];
}

export async function ensureOperationalJobRunsTable(client: PoolClient) {
  if (operationalJobRunsTableReady) {
    return;
  }

  await client.query(`
    CREATE TABLE IF NOT EXISTS ops_job_runs (
      id SERIAL PRIMARY KEY,
      job_name VARCHAR(80) NOT NULL,
      trigger_source VARCHAR(20) NOT NULL,
      initiated_by VARCHAR(255) NULL,
      status VARCHAR(20) NOT NULL,
      message TEXT NOT NULL,
      summary_json TEXT NULL,
      started_at TIMESTAMPTZ NULL,
      finished_at TIMESTAMPTZ NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await client.query(
    "CREATE INDEX IF NOT EXISTS idx_ops_job_runs_job_name_created_at ON ops_job_runs (job_name, created_at DESC)",
  );
  await client.query(
    "CREATE INDEX IF NOT EXISTS idx_ops_job_runs_trigger_source_created_at ON ops_job_runs (trigger_source, created_at DESC)",
  );

  operationalJobRunsTableReady = true;
}

export async function recordOperationalJobRun(
  input: RecordOperationalJobRunInput,
) {
  const pool = getIngressoDbPool();
  const client = await pool.connect();

  try {
    await ensureOperationalJobRunsTable(client);

    const result = await client.query<{ id: number }>(
      `
        INSERT INTO ops_job_runs (
          job_name,
          trigger_source,
          initiated_by,
          status,
          message,
          summary_json,
          started_at,
          finished_at,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        RETURNING id
      `,
      [
        input.jobName.trim(),
        input.triggerSource,
        input.initiatedBy?.trim() || null,
        input.status.trim(),
        input.message.trim(),
        input.summary === undefined ? null : JSON.stringify(input.summary),
        input.startedAt ?? null,
        input.finishedAt ?? null,
      ],
    );

    return result.rows[0]?.id ?? null;
  } finally {
    client.release();
  }
}

export async function listOperationalJobRuns(input?: {
  jobName?: string | null;
  limit?: number;
  offset?: number;
}): Promise<OperationalJobRunList> {
  const jobName = String(input?.jobName ?? "").trim() || null;
  const limit = Number.isInteger(input?.limit) ? Math.min(Math.max(input!.limit!, 1), 100) : 20;
  const offset = Number.isInteger(input?.offset) ? Math.max(input!.offset!, 0) : 0;
  const pool = getIngressoDbPool();
  const client = await pool.connect();

  try {
    await ensureOperationalJobRunsTable(client);

    const whereClause = jobName ? "WHERE job_name = $1" : "";
    const values = jobName ? [jobName, limit, offset] : [limit, offset];

    const rows = await client.query<OperationalJobRunRow>(
      `
        SELECT
          id,
          job_name,
          trigger_source,
          initiated_by,
          status,
          message,
          summary_json,
          started_at::text AS started_at,
          finished_at::text AS finished_at,
          created_at::text AS created_at
        FROM ops_job_runs
        ${whereClause}
        ORDER BY id DESC
        LIMIT $${jobName ? 2 : 1}
        OFFSET $${jobName ? 3 : 2}
      `,
      values,
    );

    const total = await client.query<{ total: string }>(
      `
        SELECT COUNT(*)::text AS total
        FROM ops_job_runs
        ${whereClause}
      `,
      jobName ? [jobName] : [],
    );

    return {
      items: rows.rows.map(toItem),
      meta: {
        limit,
        offset,
        total: Number(total.rows[0]?.total ?? 0),
        jobName,
      },
    };
  } finally {
    client.release();
  }
}

export async function getOperationalJobHealth(input: {
  jobName: string;
  triggerSource?: "manual" | "scheduled";
  maxAgeMinutes?: number;
}): Promise<OperationalJobHealth> {
  const jobName = String(input.jobName ?? "").trim();
  const triggerSource = input.triggerSource ?? "scheduled";
  const maxAgeMinutes =
    Number.isInteger(input.maxAgeMinutes) && Number(input.maxAgeMinutes) > 0 ?
      Number(input.maxAgeMinutes) :
      26 * 60;

  const pool = getIngressoDbPool();
  const client = await pool.connect();

  try {
    await ensureOperationalJobRunsTable(client);

    const latest = await client.query<OperationalJobRunRow>(
      `
        SELECT
          id,
          job_name,
          trigger_source,
          initiated_by,
          status,
          message,
          summary_json,
          started_at::text AS started_at,
          finished_at::text AS finished_at,
          created_at::text AS created_at
        FROM ops_job_runs
        WHERE job_name = $1
          AND trigger_source = $2
        ORDER BY id DESC
        LIMIT 1
      `,
      [jobName, triggerSource],
    );

    const latestRun = latest.rows[0] ? toItem(latest.rows[0]) : null;

    const lastSuccess = await client.query<{ finished_at: string | null }>(
      `
        SELECT finished_at::text AS finished_at
        FROM ops_job_runs
        WHERE job_name = $1
          AND trigger_source = $2
          AND status = 'success'
        ORDER BY id DESC
        LIMIT 1
      `,
      [jobName, triggerSource],
    );

    const lastSuccessAt = lastSuccess.rows[0]?.finished_at ?? null;

    if (!latestRun) {
      return {
        jobName,
        triggerSource,
        maxAgeMinutes,
        healthy: false,
        status: "missing",
        message: "Nenhuma execucao registrada para este job.",
        recommendedActions: getJobHealthActions("missing"),
        ageMinutes: null,
        latestRun: null,
        lastSuccessAt,
      };
    }

    const referenceTime = latestRun.finishedAt ?? latestRun.createdAt;
    const ageMinutes =
      referenceTime ?
        Math.max(
          0,
          Math.floor((Date.now() - new Date(referenceTime).getTime()) / 60000),
        ) :
        null;

    if (latestRun.status !== "success") {
      return {
        jobName,
        triggerSource,
        maxAgeMinutes,
        healthy: false,
        status: "failed",
        message: "A execucao mais recente terminou com falha ou pendencia.",
        recommendedActions: getJobHealthActions("failed"),
        ageMinutes,
        latestRun,
        lastSuccessAt,
      };
    }

    if (ageMinutes !== null && ageMinutes > maxAgeMinutes) {
      return {
        jobName,
        triggerSource,
        maxAgeMinutes,
        healthy: false,
        status: "stale",
        message: "A ultima execucao bem-sucedida esta atrasada para a janela esperada.",
        recommendedActions: getJobHealthActions("stale"),
        ageMinutes,
        latestRun,
        lastSuccessAt,
      };
    }

    return {
      jobName,
      triggerSource,
      maxAgeMinutes,
      healthy: true,
      status: "healthy",
      message: "Job dentro da janela esperada.",
      recommendedActions: getJobHealthActions("healthy"),
      ageMinutes,
      latestRun,
      lastSuccessAt,
    };
  } finally {
    client.release();
  }
}
