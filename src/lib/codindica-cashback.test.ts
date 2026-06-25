import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  cancelCodindicaCashback,
  processCodindicaCashback,
  resetCodindicaCashbackTableCacheForTests,
} from "@/lib/codindica-cashback";

const dbQuery = vi.fn();

vi.mock("@/lib/ingresso-db", () => ({
  getIngressoDbPool: () => ({
    query: dbQuery,
  }),
}));

describe("codindica-cashback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCodindicaCashbackTableCacheForTests();
  });

  it("calculates percentage cashback from legacy percomissao and updates vlcomiss", async () => {
    dbQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM compra")) {
        return {
          rows: [
            {
              idcompra: 456,
              codindica: "ABC123",
              stcompra: "conc",
              vltotcompra: "200.00",
              vltotdesc: "20.00",
              vlcomiss: "0.00",
            },
          ],
        };
      }

      if (sql.includes("FROM codindica")) {
        return {
          rows: [
            {
              codindica: "ABC123",
              percomissao: "10.00",
              email: "rep@example.com",
            },
          ],
        };
      }

      if (sql.includes("COUNT(*) FILTER")) {
        return {
          rows: [
            {
              total_itens: "2",
              total_normal: "1",
              total_infantil: "1",
              tpagenda: "padra",
            },
          ],
        };
      }

      if (sql.includes("to_regclass")) {
        return {
          rows: [{ regclass: null }],
        };
      }

      return { rows: [] };
    });

    const result = await processCodindicaCashback(456);

    expect(result).toEqual({
      status: "processed",
      purchaseId: 456,
      amount: "20.00",
    });
    expect(dbQuery).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE compra"),
      [456, "20.00"],
    );
  });

  it("cancels cashback by zeroing vlcomiss", async () => {
    dbQuery.mockResolvedValue({ rows: [{ regclass: null }] });

    const result = await cancelCodindicaCashback(456);

    expect(result).toEqual({
      status: "processed",
      purchaseId: 456,
      amount: "0.00",
    });
    expect(dbQuery).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE compra"),
      [456, "0.00"],
    );
  });

  it("queues representative email when cashback history and email queue exist", async () => {
    dbQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql.includes("FROM compra")) {
        return {
          rows: [
            {
              idcompra: 456,
              codindica: "ABC123",
              stcompra: "conc",
              cpf: "52998224725",
              dtpagamento: "2026-04-23",
              nmusuario: "Cliente Teste",
              vltotcompra: "200.00",
              vltotdesc: "20.00",
              vlcomiss: "0.00",
            },
          ],
        };
      }

      if (sql.includes("FROM codindica WHERE")) {
        return {
          rows: [
            {
              codindica: "ABC123",
              percomissao: "10.00",
              email: "rep@example.com",
              nmrepresentante: "Equipe",
            },
          ],
        };
      }

      if (sql.includes("COUNT(*) FILTER")) {
        return {
          rows: [
            {
              total_itens: "2",
              total_normal: "1",
              total_infantil: "1",
              tpagenda: "padra",
            },
          ],
        };
      }

      if (sql.includes("to_regclass")) {
        const table = params?.[0];

        if (table === "public.codindica_cashback") {
          return {
            rows: [{ regclass: "codindica_cashback" }],
          };
        }

        if (table === "public.email") {
          return {
            rows: [{ regclass: "email" }],
          };
        }

        if (table === "public.codindica_cashback_pagamento") {
          return {
            rows: [{ regclass: "codindica_cashback_pagamento" }],
          };
        }
      }

      if (sql.includes("SELECT idcompra FROM codindica_cashback")) {
        return { rowCount: 0, rows: [] };
      }

      if (sql.includes("SELECT idcompra, stemail, email")) {
        return {
          rows: [
            {
              idcompra: 456,
              stemail: "falha",
              email: "rep@example.com",
            },
          ],
        };
      }

      if (sql.includes("SUM(hist.vlcashback)")) {
        return {
          rows: [{ total: "20.00" }],
        };
      }

      if (sql.includes("SUM(vlpagamento)")) {
        return {
          rows: [{ total: "5.00" }],
        };
      }

      return { rowCount: 0, rows: [] };
    });

    await processCodindicaCashback(456);

    expect(dbQuery).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO email"),
      expect.arrayContaining([
        "ingressos@estancia.local",
        "Ingressos Estancia",
        "rep@example.com",
        "Equipe",
        "ingressos@estancia.local",
        "Estancia - Compra Finalizada",
      ]),
    );
    expect(dbQuery).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE codindica_cashback"),
      [456, "pendente", "Email do representante enfileirado no BFF."],
    );
  });
});
