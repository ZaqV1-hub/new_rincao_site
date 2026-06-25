import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getOperationalJobHealth,
  listOperationalJobRuns,
  recordOperationalJobRun,
} from "@/lib/ops-job-runs";

const { query, connect, release } = vi.hoisted(() => ({
  query: vi.fn(),
  connect: vi.fn(),
  release: vi.fn(),
}));

vi.mock("@/lib/ingresso-db", () => ({
  getIngressoDbPool: () => ({
    connect,
  }),
}));

describe("ops-job-runs", () => {
  const realDateNow = Date.now;

  beforeEach(() => {
    vi.clearAllMocks();
    Date.now = realDateNow;
    connect.mockResolvedValue({
      query,
      release,
    });
  });

  afterEach(() => {
    Date.now = realDateNow;
  });

  it("records a job execution", async () => {
    query.mockImplementation(async (sql: string) => {
      if (sql.includes("INSERT INTO ops_job_runs")) {
        return { rows: [{ id: 77 }] };
      }

      return { rows: [] };
    });

    await expect(
      recordOperationalJobRun({
        jobName: "daily-run",
        triggerSource: "scheduled",
        initiatedBy: "scheduler",
        status: "success",
        message: "ok",
        summary: { action: "daily_jobs" },
        startedAt: "2026-04-23T23:00:00.000Z",
        finishedAt: "2026-04-23T23:00:02.000Z",
      }),
    ).resolves.toBe(77);
  });

  it("lists recent job executions", async () => {
    query.mockImplementation(async (sql: string, values?: unknown[]) => {
      if (sql.includes("SELECT COUNT(*)::text AS total")) {
        return { rows: [{ total: "1" }] };
      }

      if (sql.includes("FROM ops_job_runs")) {
        expect(values).toEqual(["daily-run", 10, 0]);

        return {
          rows: [
            {
              id: 77,
              job_name: "daily-run",
              trigger_source: "scheduled",
              initiated_by: "scheduler",
              status: "success",
              message: "ok",
              summary_json: '{"action":"daily_jobs"}',
              started_at: "2026-04-23T23:00:00.000Z",
              finished_at: "2026-04-23T23:00:02.000Z",
              created_at: "2026-04-23T23:00:02.000Z",
            },
          ],
        };
      }

      return { rows: [] };
    });

    await expect(
      listOperationalJobRuns({
        jobName: "daily-run",
        limit: 10,
        offset: 0,
      }),
    ).resolves.toEqual({
      items: [
        {
          id: 77,
          jobName: "daily-run",
          triggerSource: "scheduled",
          initiatedBy: "scheduler",
          status: "success",
          message: "ok",
          summary: {
            action: "daily_jobs",
          },
          startedAt: "2026-04-23T23:00:00.000Z",
          finishedAt: "2026-04-23T23:00:02.000Z",
          createdAt: "2026-04-23T23:00:02.000Z",
        },
      ],
      meta: {
        limit: 10,
        offset: 0,
        total: 1,
        jobName: "daily-run",
      },
    });
  });

  it("returns health for the latest scheduled run", async () => {
    query.mockImplementation(async (sql: string, values?: unknown[]) => {
      if (
        sql.includes("FROM ops_job_runs") &&
        sql.includes("trigger_source = $2") &&
        sql.includes("ORDER BY id DESC") &&
        sql.includes("LIMIT 1")
      ) {
        expect(values).toEqual(["daily-run", "scheduled"]);

        return {
          rows: [
            {
              id: 88,
              job_name: "daily-run",
              trigger_source: "scheduled",
              initiated_by: "scheduler",
              status: "success",
              message: "ok",
              summary_json: '{"action":"daily_jobs"}',
              started_at: new Date(Date.now() - 15 * 60000).toISOString(),
              finished_at: new Date(Date.now() - 10 * 60000).toISOString(),
              created_at: new Date(Date.now() - 10 * 60000).toISOString(),
            },
          ],
        };
      }

      if (sql.includes("AND status = 'success'")) {
        return {
          rows: [
            {
              finished_at: new Date(Date.now() - 10 * 60000).toISOString(),
            },
          ],
        };
      }

      return { rows: [] };
    });

    const result = await getOperationalJobHealth({
      jobName: "daily-run",
      triggerSource: "scheduled",
      maxAgeMinutes: 30,
    });

    expect(result.status).toBe("healthy");
    expect(result.healthy).toBe(true);
    expect(result.recommendedActions).toEqual([]);
    expect(result.latestRun?.id).toBe(88);
  });

  it("returns missing health when no scheduled run exists", async () => {
    query.mockResolvedValue({ rows: [] });

    const result = await getOperationalJobHealth({
      jobName: "daily-run",
      triggerSource: "scheduled",
      maxAgeMinutes: 30,
    });

    expect(result.status).toBe("missing");
    expect(result.healthy).toBe(false);
    expect(result.latestRun).toBeNull();
    expect(result.recommendedActions).toEqual([
      "Confirmar se a rota agendada ja foi ligada no scheduler externo.",
      "Executar a rotina diaria manualmente para criar a primeira evidencia.",
      "Validar o historico de jobs e o health check apos a primeira execucao.",
    ]);
  });

  it("returns failed health when the latest scheduled run did not succeed", async () => {
    Date.now = vi.fn(() => new Date("2026-04-24T12:00:00.000Z").getTime());
    query.mockImplementation(async (sql: string) => {
      if (sql.includes("AND status = 'success'")) {
        return {
          rows: [
            {
              finished_at: "2026-04-24T08:00:00.000Z",
            },
          ],
        };
      }

      if (sql.includes("FROM ops_job_runs")) {
        return {
          rows: [
            {
              id: 89,
              job_name: "daily-run",
              trigger_source: "scheduled",
              initiated_by: "scheduler",
              status: "partial",
              message: "cash failed",
              summary_json: '{"action":"daily_jobs"}',
              started_at: "2026-04-24T11:45:00.000Z",
              finished_at: "2026-04-24T11:50:00.000Z",
              created_at: "2026-04-24T11:50:00.000Z",
            },
          ],
        };
      }

      return { rows: [] };
    });

    const result = await getOperationalJobHealth({
      jobName: "daily-run",
      triggerSource: "scheduled",
      maxAgeMinutes: 30,
    });

    expect(result.status).toBe("failed");
    expect(result.healthy).toBe(false);
    expect(result.ageMinutes).toBe(10);
    expect(result.lastSuccessAt).toBe("2026-04-24T08:00:00.000Z");
    expect(result.recommendedActions).toContain(
      "Rerodar a rotina diaria manualmente pela console operacional.",
    );
  });

  it("returns stale health when the latest successful scheduled run is too old", async () => {
    Date.now = vi.fn(() => new Date("2026-04-24T12:00:00.000Z").getTime());
    query.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM ops_job_runs")) {
        return {
          rows: [
            {
              id: 90,
              job_name: "daily-run",
              trigger_source: "scheduled",
              initiated_by: "scheduler",
              status: "success",
              message: "ok",
              summary_json: '{"action":"daily_jobs"}',
              started_at: "2026-04-24T10:00:00.000Z",
              finished_at: "2026-04-24T10:05:00.000Z",
              created_at: "2026-04-24T10:05:00.000Z",
            },
          ],
        };
      }

      return { rows: [] };
    });

    const result = await getOperationalJobHealth({
      jobName: "daily-run",
      triggerSource: "scheduled",
      maxAgeMinutes: 30,
    });

    expect(result.status).toBe("stale");
    expect(result.healthy).toBe(false);
    expect(result.ageMinutes).toBe(115);
    expect(result.recommendedActions).toContain(
      "Confirmar que o scheduler externo esta ativo.",
    );
  });
});
