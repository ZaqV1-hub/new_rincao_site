import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createOperationalCashMovement,
  deleteOperationalCashMovement,
  getOperationalCashSummary,
  updateOperationalCashMovement,
} from "@/lib/ops-cash-management";

const { query, connect, release, registerOpsAuditLog } = vi.hoisted(() => ({
  query: vi.fn(),
  connect: vi.fn(),
  release: vi.fn(),
  registerOpsAuditLog: vi.fn(),
}));

vi.mock("@/lib/ingresso-db", () => ({
  getIngressoDbPool: () => ({
    connect,
  }),
}));

vi.mock("@/lib/ops-audit-log", () => ({
  registerOpsAuditLog,
}));

describe("ops-cash-management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    connect.mockResolvedValue({
      query,
      release,
    });
    registerOpsAuditLog.mockResolvedValue(911);
  });

  it("returns the current cash summary for the open period", async () => {
    query.mockImplementation(async (sql: string, values?: unknown[]) => {
      if (sql.includes("FROM caixa_periodos") && sql.includes("fechado_em IS NULL")) {
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
        return {
          rows: [
            {
              id: 1,
              tipo: "fundo",
              responsavel: "Tesouraria",
              valor: "150.00",
              data_hora: "2026-04-23 08:05:00+00",
            },
          ],
        };
      }

      if (sql.includes("FROM movimentacao_caixa") && values?.[0] === "sangria") {
        return {
          rows: [
            {
              id: 2,
              tipo: "sangria",
              responsavel: "Gerencia",
              valor: "20.00",
              data_hora: "2026-04-23 10:00:00+00",
            },
          ],
        };
      }

      if (sql.includes("WITH voucher_totals AS")) {
        return {
          rows: [{ total: "320.00" }],
        };
      }

      return { rows: [] };
    });

    await expect(getOperationalCashSummary()).resolves.toEqual({
      period: {
        id: 7,
        openedAt: "2026-04-23 08:00:00+00",
        closedAt: null,
        operator: null,
        closureSheetId: null,
      },
      funds: [
        {
          id: 1,
          type: "fundo",
          responsible: "Tesouraria",
          value: "150.00",
          createdAt: "2026-04-23 08:05:00+00",
        },
      ],
      sangrias: [
        {
          id: 2,
          type: "sangria",
          responsible: "Gerencia",
          value: "20.00",
          createdAt: "2026-04-23 10:00:00+00",
        },
      ],
      totals: {
        cashSales: "320.00",
        fund: "150.00",
        sangria: "20.00",
        cashInDrawer: "450.00",
      },
    });
  });

  it("creates a fundo movement and persists audit details", async () => {
    let movementInserted = false;

    query.mockImplementation(async (sql: string, values?: unknown[]) => {
      const normalizedSql = sql.replace(/\s+/g, " ");

      if (sql === "BEGIN" || sql === "COMMIT") {
        return { rows: [] };
      }

      if (
        normalizedSql.includes("ALTER TABLE movimentacao_caixa") ||
        normalizedSql.includes("UPDATE movimentacao_caixa SET created_at = data_hora")
      ) {
        return { rows: [] };
      }

      if (normalizedSql.includes("FROM caixa_periodos") && normalizedSql.includes("fechado_em IS NULL")) {
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
        return {
          rows: movementInserted ?
            [
              {
                id: 12,
                tipo: "fundo",
                responsavel: "Tesouraria",
                valor: "50.00",
                data_hora: "2026-04-23 11:00:00+00",
              },
            ] :
            [],
        };
      }

      if (sql.includes("FROM movimentacao_caixa") && values?.[0] === "sangria") {
        return { rows: [] };
      }

      if (sql.includes("WITH voucher_totals AS")) {
        return {
          rows: [{ total: "320.00" }],
        };
      }

      if (sql.includes("INSERT INTO movimentacao_caixa")) {
        movementInserted = true;

        expect(values).toEqual(["fundo", "Tesouraria", "50.00"]);

        return {
          rows: [
            {
              id: 12,
              tipo: "fundo",
              responsavel: "Tesouraria",
              valor: "50.00",
              data_hora: "2026-04-23 11:00:00+00",
            },
          ],
        };
      }

      return { rows: [] };
    });

    await expect(
      createOperationalCashMovement({
        type: "fundo",
        responsible: "Tesouraria",
        value: "50,00",
        reason: "Reforco do caixa",
        actor: {
          name: "Gestor Teste",
          cpf: "52998224725",
        },
      }),
    ).resolves.toEqual({
      action: "create",
      movement: {
        id: 12,
        type: "fundo",
        responsible: "Tesouraria",
        value: "50.00",
        createdAt: "2026-04-23 11:00:00+00",
      },
      summary: {
        period: {
          id: 7,
          openedAt: "2026-04-23 08:00:00+00",
          closedAt: null,
          operator: null,
          closureSheetId: null,
        },
        funds: [
          {
            id: 12,
            type: "fundo",
            responsible: "Tesouraria",
            value: "50.00",
            createdAt: "2026-04-23 11:00:00+00",
          },
        ],
        sangrias: [],
        totals: {
          cashSales: "320.00",
          fund: "50.00",
          sangria: "0.00",
          cashInDrawer: "370.00",
        },
      },
      auditLogId: 911,
      message: "Fundo de caixa registrado com sucesso.",
    });

    expect(registerOpsAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        origem: "caixa",
        acao: "criar",
        periodoId: 7,
        motivo: "Reforco do caixa",
      }),
    );
  });

  it("rejects sangria above the available cash", async () => {
    query.mockImplementation(async (sql: string) => {
      if (sql === "BEGIN") {
        return { rows: [] };
      }

      if (sql === "ROLLBACK") {
        return { rows: [] };
      }

      if (sql.includes("FROM caixa_periodos") && sql.includes("fechado_em IS NULL")) {
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

      if (sql.includes("FROM movimentacao_caixa")) {
        return { rows: [] };
      }

      if (sql.includes("WITH voucher_totals AS")) {
        return {
          rows: [{ total: "20.00" }],
        };
      }

      return { rows: [] };
    });

    await expect(
      createOperationalCashMovement({
        type: "sangria",
        responsible: "Gerencia",
        value: "50.00",
        reason: "Retirada",
      }),
    ).rejects.toMatchObject({
      code: "cash_movement_exceeds_available",
      status: 409,
    });

    expect(registerOpsAuditLog).not.toHaveBeenCalled();
  });

  it("updates a sangria movement and keeps the audit trail", async () => {
    let movementValue = "20.00";
    let movementResponsible = "Gerencia";

    query.mockImplementation(async (sql: string, values?: unknown[]) => {
      const normalizedSql = sql.replace(/\s+/g, " ");

      if (sql === "BEGIN" || sql === "COMMIT") {
        return { rows: [] };
      }

      if (
        normalizedSql.includes("ALTER TABLE movimentacao_caixa") ||
        normalizedSql.includes("UPDATE movimentacao_caixa SET created_at = data_hora")
      ) {
        return { rows: [] };
      }

      if (normalizedSql.includes("FROM caixa_periodos") && normalizedSql.includes("fechado_em IS NULL")) {
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

      if (normalizedSql.includes("FROM movimentacao_caixa") && normalizedSql.includes("WHERE tipo = $1")) {
        if (values?.[0] === "fundo") {
          return { rows: [] };
        }

        return {
          rows: [
            {
              id: 2,
              tipo: "sangria",
              responsavel: movementResponsible,
              valor: movementValue,
              data_hora: "2026-04-23 10:00:00+00",
            },
          ],
        };
      }

      if (normalizedSql.includes("WHERE id = $1") && normalizedSql.includes("FOR UPDATE")) {
        return {
          rows: [
            {
              id: 2,
              tipo: "sangria",
              responsavel: movementResponsible,
              valor: movementValue,
              data_hora: "2026-04-23 10:00:00+00",
            },
          ],
        };
      }

      if (normalizedSql.includes("WITH voucher_totals AS")) {
        return {
          rows: [{ total: "320.00" }],
        };
      }

      if (normalizedSql.includes("UPDATE movimentacao_caixa")) {
        movementResponsible = String(values?.[1] ?? "");
        movementValue = String(values?.[2] ?? "");

        return {
          rows: [
            {
              id: 2,
              tipo: "sangria",
              responsavel: movementResponsible,
              valor: movementValue,
              data_hora: "2026-04-23 10:00:00+00",
            },
          ],
        };
      }

      return { rows: [] };
    });

    await expect(
      updateOperationalCashMovement({
        movementId: 2,
        responsible: "Gerencia Central",
        value: "30,00",
        reason: "Correcao manual",
        actor: {
          name: "Gestor Teste",
        },
      }),
    ).resolves.toEqual({
      action: "update",
      movement: {
        id: 2,
        type: "sangria",
        responsible: "Gerencia Central",
        value: "30.00",
        createdAt: "2026-04-23 10:00:00+00",
      },
      summary: {
        period: {
          id: 7,
          openedAt: "2026-04-23 08:00:00+00",
          closedAt: null,
          operator: null,
          closureSheetId: null,
        },
        funds: [],
        sangrias: [
          {
            id: 2,
            type: "sangria",
            responsible: "Gerencia Central",
            value: "30.00",
            createdAt: "2026-04-23 10:00:00+00",
          },
        ],
        totals: {
          cashSales: "320.00",
          fund: "0.00",
          sangria: "30.00",
          cashInDrawer: "290.00",
        },
      },
      auditLogId: 911,
      message: "Lancamento atualizado.",
    });

    expect(registerOpsAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        origem: "caixa",
        acao: "editar",
        movimentacaoId: 2,
        movimentacaoTipo: "sangria",
      }),
    );
  });

  it("deletes a cash movement and returns the new summary", async () => {
    let hasMovement = true;

    query.mockImplementation(async (sql: string, values?: unknown[]) => {
      const normalizedSql = sql.replace(/\s+/g, " ");

      if (sql === "BEGIN" || sql === "COMMIT") {
        return { rows: [] };
      }

      if (
        normalizedSql.includes("ALTER TABLE movimentacao_caixa") ||
        normalizedSql.includes("UPDATE movimentacao_caixa SET created_at = data_hora")
      ) {
        return { rows: [] };
      }

      if (normalizedSql.includes("FROM caixa_periodos") && normalizedSql.includes("fechado_em IS NULL")) {
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

      if (normalizedSql.includes("FROM movimentacao_caixa") && normalizedSql.includes("WHERE tipo = $1")) {
        if (values?.[0] === "fundo") {
          return hasMovement ?
            {
              rows: [
                {
                  id: 12,
                  tipo: "fundo",
                  responsavel: "Tesouraria",
                  valor: "50.00",
                  data_hora: "2026-04-23 11:00:00+00",
                },
              ],
            } :
            { rows: [] };
        }

        return { rows: [] };
      }

      if (normalizedSql.includes("WHERE id = $1") && normalizedSql.includes("FOR UPDATE")) {
        return hasMovement ?
          {
            rows: [
              {
                id: 12,
                tipo: "fundo",
                responsavel: "Tesouraria",
                valor: "50.00",
                data_hora: "2026-04-23 11:00:00+00",
              },
            ],
          } :
          { rows: [] };
      }

      if (normalizedSql.includes("WITH voucher_totals AS")) {
        return {
          rows: [{ total: "320.00" }],
        };
      }

      if (sql.startsWith("DELETE FROM movimentacao_caixa")) {
        hasMovement = false;
        return { rows: [] };
      }

      return { rows: [] };
    });

    await expect(
      deleteOperationalCashMovement({
        movementId: 12,
        reason: "Lancamento duplicado",
        actor: {
          name: "Gestor Teste",
        },
      }),
    ).resolves.toEqual({
      action: "delete",
      movementId: 12,
      movementType: "fundo",
      summary: {
        period: {
          id: 7,
          openedAt: "2026-04-23 08:00:00+00",
          closedAt: null,
          operator: null,
          closureSheetId: null,
        },
        funds: [],
        sangrias: [],
        totals: {
          cashSales: "320.00",
          fund: "0.00",
          sangria: "0.00",
          cashInDrawer: "320.00",
        },
      },
      auditLogId: 911,
      message: "Lancamento excluido.",
    });

    expect(registerOpsAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        origem: "caixa",
        acao: "excluir",
        movimentacaoId: 12,
        movimentacaoTipo: "fundo",
      }),
    );
  });
});
