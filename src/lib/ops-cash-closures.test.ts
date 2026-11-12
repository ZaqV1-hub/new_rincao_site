import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  autoCloseOperationalCashClosures,
  closeOperationalCashClosure,
  getOperationalCashClosureDetail,
  listOperationalCashClosures,
} from "@/lib/ops-cash-closures";

const { query, connect, release, registerOpsAuditLog, ensureOpsAuditLogTable, autoCloseExpiredCashSessions } = vi.hoisted(() => ({
  autoCloseExpiredCashSessions: vi.fn(),
  query: vi.fn(),
  connect: vi.fn(),
  release: vi.fn(),
  registerOpsAuditLog: vi.fn(),
  ensureOpsAuditLogTable: vi.fn(),
}));

vi.mock("@/lib/ingresso-db", () => ({
  getIngressoDbPool: () => ({
    connect,
  }),
  getIngressoSistemaDbPool: () => ({
    connect,
  }),
}));

vi.mock("@/lib/ops-audit-log", () => ({
  registerOpsAuditLog,
  ensureOpsAuditLogTable,
}));

vi.mock("@/lib/operational-cash-session", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/operational-cash-session")>(),
  autoCloseExpiredCashSessions,
}));

describe("ops-cash-closures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    connect.mockResolvedValue({
      query,
      release,
    });
    registerOpsAuditLog.mockResolvedValue(981);
  });

  it("lists recent cash closures without schema writes", async () => {
    query.mockImplementation(async (sql: string, values?: unknown[]) => {
      expect(sql).toMatch(/^\s*SELECT/);
      if (sql.includes("SELECT COUNT(*)::text AS total")) {
        expect(sql).toContain("fechamento.modelo_operacional = FALSE");
        expect(sql).toContain("COALESCE(periodo.fechamento_auto, FALSE)");
        expect(sql).toContain("COALESCE(fechamento.totals_geral, 0) = 0");
        return {
          rows: [{ total: "1" }],
        };
      }

      if (sql.includes("FROM caixa_fechamentos")) {
        expect(sql).toContain("fechamento.modelo_operacional = FALSE");
        expect(sql).toContain("COALESCE(periodo.fechamento_auto, FALSE)");
        expect(sql).toContain("COALESCE(fechamento.totals_geral, 0) = 0");
        expect(values).toEqual([10, 0]);

        return {
          rows: [
            {
              id: 44,
              periodo_id: 7,
              data_caixa: "2026-04-22",
              snapshot_json:
                '{"period":{"ini":"2026-04-22 08:00:00+00","fim":"2026-04-22 18:00:00+00"},"operador":"Gestor Teste"}',
              totals_dinheiro: "320.00",
              totals_fundo: "50.00",
              totals_geral: "470.00",
              created_at: "2026-04-22 18:00:00+00",
              periodo_aberto_em: "2026-04-22 08:00:00+00",
              periodo_fechado_em: "2026-04-22 18:00:00+00",
              periodo_operador: "Gestor Teste",
            },
          ],
        };
      }

      return { rows: [] };
    });

    await expect(
      listOperationalCashClosures({ limit: 10, offset: 0 }),
    ).resolves.toEqual({
      items: [
        {
          id: 44,
          periodId: 7,
          cashDate: "2026-04-22",
          openedAt: "2026-04-22 08:00:00+00",
          closedAt: "2026-04-22 18:00:00+00",
          operator: "Gestor Teste",
          totals: {
            cash: "320.00",
            fund: "50.00",
            overall: "470.00",
          },
          createdAt: "2026-04-22 18:00:00+00",
        },
      ],
      meta: {
        limit: 10,
        offset: 0,
        total: 1,
      },
    });
  });

  it("returns the closure detail with parsed snapshot", async () => {
    query.mockImplementation(async (sql: string, values?: unknown[]) => {
      if (sql.includes("WHERE fechamento.id = $1")) {
        expect(values).toEqual([44]);

        return {
          rows: [
            {
              id: 44,
              periodo_id: 7,
              snapshot_json:
                '{"period":{"ini":"2026-04-22 08:00:00+00","fim":"2026-04-22 18:00:00+00"},"operador":"Gestor Teste","totalFundo":50}',
              totals_dinheiro: "320.00",
              totals_fundo: "50.00",
              totals_geral: "470.00",
              created_at: "2026-04-22 18:00:00+00",
              periodo_aberto_em: "2026-04-22 08:00:00+00",
              periodo_fechado_em: "2026-04-22 18:00:00+00",
              periodo_operador: "Gestor Teste",
            },
          ],
        };
      }

      return { rows: [] };
    });

    await expect(getOperationalCashClosureDetail(44)).resolves.toEqual({
      id: 44,
      periodId: 7,
      openedAt: "2026-04-22 08:00:00+00",
      closedAt: "2026-04-22 18:00:00+00",
      operator: "Gestor Teste",
      totals: {
        cash: "320.00",
        fund: "50.00",
        overall: "470.00",
      },
      createdAt: "2026-04-22 18:00:00+00",
      snapshot: {
        period: {
          ini: "2026-04-22 08:00:00+00",
          fim: "2026-04-22 18:00:00+00",
        },
        operador: "Gestor Teste",
        totalFundo: 50,
      },
    });
  });

  it("rejects invalid closure ids", async () => {
    await expect(getOperationalCashClosureDetail(0)).rejects.toMatchObject({
      code: "invalid_cash_closure_id",
      status: 400,
    });
  });

  it("closes only the existing legacy period and links its closure", async () => {
    let openPeriodId = 7;
    let closureCreated = false;

    query.mockImplementation(async (sql: string, values?: unknown[]) => {
      if (sql === "BEGIN" || sql === "COMMIT") {
        return { rows: [] };
      }

      if (sql === "SELECT NOW()::text AS current_at") {
        return {
          rows: [{ current_at: "2026-04-23 18:00:00+00" }],
        };
      }

      if (
        sql.includes("FROM caixa_periodos") &&
        sql.includes("fechado_em IS NULL") &&
        sql.includes("ORDER BY id DESC")
      ) {
        return {
          rows: [
            {
              id: openPeriodId,
              aberto_em: closureCreated ?
                "2026-04-23 18:00:00+00" :
                "2026-04-23 08:00:00+00",
              fechado_em: null,
              operador: null,
              folha_id: null,
            },
          ],
        };
      }

      if (sql.includes("FROM caixa_periodos") && sql.includes("FOR UPDATE")) {
        return {
          rows: [
            {
              id: 7,
              aberto_em: "2026-04-23 08:00:00+00",
              fechado_em: null,
              operador: null,
              folha_id: null,
            },
          ],
        };
      }

      if (sql.includes("FROM movimentacao_caixa") && values?.[0] === "fundo") {
        return closureCreated ?
          { rows: [] } :
          {
            rows: [
              {
                id: 12,
                tipo: "fundo",
                responsavel: "Tesouraria",
                valor: "50.00",
                data_hora: "2026-04-23 09:00:00+00",
              },
            ],
          };
      }

      if (sql.includes("FROM movimentacao_caixa") && values?.[0] === "sangria") {
        return closureCreated ?
          { rows: [] } :
          {
            rows: [
              {
                id: 13,
                tipo: "sangria",
                responsavel: "Gerencia",
                valor: "20.00",
                data_hora: "2026-04-23 12:00:00+00",
              },
            ],
          };
      }

      if (sql.includes("WITH voucher_totals AS")) {
        return {
          rows: [{ total: closureCreated ? "0.00" : "320.00" }],
        };
      }

      if (sql.includes("INSERT INTO caixa_fechamentos")) {
        closureCreated = true;

        expect(values?.[0]).toBe(7);

        return {
          rows: [{ id: 44 }],
        };
      }

      if (
        sql.includes("UPDATE caixa_periodos") &&
        sql.includes("fechado_em = $4") &&
        values?.[0] === 7
      ) {
        expect(values).toEqual([
          7,
          "Gestor Teste",
          44,
          "2026-04-23 18:00:00+00",
          false,
        ]);
        return { rows: [] };
      }

      if (sql.includes("UPDATE voucher v") || sql.includes("UPDATE edicoes_log")) {
        return { rows: [] };
      }

      if (sql.includes("INSERT INTO caixa_periodos")) {
        openPeriodId = 8;
        return {
          rows: [{ id: 8 }],
        };
      }

      if (sql.includes("WHERE fechamento.id = $1")) {
        expect(values).toEqual([44]);

        return {
          rows: [
            {
              id: 44,
              periodo_id: 7,
              snapshot_json:
                '{"period":{"ini":"2026-04-23 08:00:00+00","fim":"2026-04-23 18:00:00+00"},"operador":"Gestor Teste"}',
              totals_dinheiro: "320.00",
              totals_fundo: "50.00",
              totals_geral: "350.00",
              created_at: "2026-04-23 18:00:00+00",
              periodo_aberto_em: "2026-04-23 08:00:00+00",
              periodo_fechado_em: "2026-04-23 18:00:00+00",
              periodo_operador: "Gestor Teste",
            },
          ],
        };
      }

      return { rows: [] };
    });

    await expect(
      closeOperationalCashClosure({
        reason: "Fechamento manual",
        operatorName: "Gestor Teste",
        actor: {
          name: "Gestor Teste",
        },
      }),
    ).resolves.toEqual({
      action: "close",
      periodId: 7,
      nextPeriodId: null,
      closure: {
        id: 44,
        periodId: 7,
        openedAt: "2026-04-23 08:00:00+00",
        closedAt: "2026-04-23 18:00:00+00",
        operator: "Gestor Teste",
        totals: {
          cash: "320.00",
          fund: "50.00",
          overall: "350.00",
        },
        createdAt: "2026-04-23 18:00:00+00",
        snapshot: {
          period: {
            ini: "2026-04-23 08:00:00+00",
            fim: "2026-04-23 18:00:00+00",
          },
          operador: "Gestor Teste",
        },
      },
      closedSummary: {
        period: {
          id: 7,
          openedAt: "2026-04-23 08:00:00+00",
          closedAt: "2026-04-23 18:00:00+00",
          operator: "Gestor Teste",
          closureSheetId: null,
        },
        funds: [
          {
            id: 12,
            type: "fundo",
            responsible: "Tesouraria",
            value: "50.00",
            createdAt: "2026-04-23 09:00:00+00",
          },
        ],
        sangrias: [
          {
            id: 13,
            type: "sangria",
            responsible: "Gerencia",
            value: "20.00",
            createdAt: "2026-04-23 12:00:00+00",
          },
        ],
        totals: {
          cashSales: "320.00",
          fund: "50.00",
          sangria: "20.00",
          cashInDrawer: "350.00",
        },
      },
      currentSummary: null,
      auditLogId: 981,
      message: "Caixa fechado com sucesso.",
    });

    expect(query.mock.calls.some(([sql]) => /INSERT INTO caixa_periodos|UPDATE voucher/.test(sql))).toBe(false);
    expect(ensureOpsAuditLogTable).toHaveBeenCalled();
    expect(registerOpsAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        origem: "caixa",
        acao: "fechar",
        periodoId: 7,
        folhaId: 44,
      }),
      "postgres",
    );
  });

  it("rejects a new operational closure ID without schema changes", async () => {
    query.mockResolvedValue({ rows: [] });
    await expect(getOperationalCashClosureDetail(99)).rejects.toMatchObject({ code: "cash_closure_not_found", status: 404 });
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toContain("fechamento.modelo_operacional = FALSE");
    expect(query.mock.calls[0][0]).toContain("periodo.parque IS NULL");
  });

  it("preserves recorded legacy dates before snapshot dates, then falls back to opening date", async () => {
    query.mockImplementation(async (sql: string) => {
      if (/^\s*(CREATE|ALTER|UPDATE|INSERT|DELETE)/i.test(sql)) throw new Error("Read attempted mutation");
      if (sql.includes("COUNT(*)")) return { rows: [{ total: "3" }] };
      expect(sql).toContain("to_jsonb(fechamento)->>'data_caixa'");
      return { rows: [
        { id: 1, data_caixa: "2026-01-01", snapshot_json: { cashDate: "2026-01-02" }, fallback_data_caixa: "2026-01-03" },
        { id: 2, snapshot_json: { cashDate: "2026-01-02" }, fallback_data_caixa: "2026-01-03" },
        { id: 3, snapshot_json: null, fallback_data_caixa: "2026-01-03" },
      ] };
    });
    const result = await listOperationalCashClosures();
    expect(result.items.map(item => item.cashDate)).toEqual(["2026-01-01", "2026-01-02", "2026-01-03"]);
  });

  it("delegates expired sessions without opening successors or fabricating identifiers", async () => {
    autoCloseExpiredCashSessions.mockResolvedValueOnce({ closedCount: 2, closedPeriodIds: [9, 10] })
      .mockResolvedValueOnce({ closedCount: 0, closedPeriodIds: [] });
    const input = { reason: "Rotina", actor: { name: "Job", cpf: null } };
    expect(await autoCloseOperationalCashClosures(input)).toMatchObject({
      action: "auto_close", closedCount: 2, closedPeriodIds: [9, 10], currentSummary: null,
    });
    const replay = await autoCloseOperationalCashClosures(input);
    expect(replay.closedCount).toBe(0);
    expect(replay).not.toHaveProperty("closureIds");
    expect(replay).not.toHaveProperty("auditLogIds");
    expect(autoCloseExpiredCashSessions).toHaveBeenCalledWith(input.actor);
    expect(connect).not.toHaveBeenCalled();
  });
});
