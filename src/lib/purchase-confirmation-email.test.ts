import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  queuePurchaseConfirmationEmail,
  resetPurchaseConfirmationEmailCacheForTests,
} from "@/lib/purchase-confirmation-email";

const dbQuery = vi.fn();
const originalEnv = process.env;

vi.mock("@/lib/ingresso-db", () => ({
  getIngressoDbPool: () => ({
    query: dbQuery,
  }),
}));

describe("purchase-confirmation-email", () => {
  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SITE_URL: "https://www.example.test",
    };
    vi.clearAllMocks();
    resetPurchaseConfirmationEmailCacheForTests();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("queues the buyer confirmation email and marks flenvio", async () => {
    dbQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM compra")) {
        return {
          rows: [
            {
              idcompra: 456,
              stcompra: "conc",
              flenvio: "nao",
              dtpagamento: "2026-04-23",
              email: "cliente@example.com",
              nmusuario: "Cliente Teste",
            },
          ],
        };
      }

      if (sql.includes("to_regclass")) {
        return {
          rows: [{ regclass: "email" }],
        };
      }

      return { rows: [] };
    });

    const result = await queuePurchaseConfirmationEmail(456);

    expect(result).toEqual({
      status: "queued",
      purchaseId: 456,
    });
    expect(dbQuery).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO email"),
      expect.arrayContaining([
        "ingressos@estancia.local",
        "Ingressos Estancia",
        "cliente@example.com",
        "Cliente Teste",
        "ingressos@estancia.local",
        "Estancia - Compra",
      ]),
    );
    expect(dbQuery).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE compra"),
      [456],
    );
  });

  it("skips when the purchase email was already queued", async () => {
    dbQuery.mockResolvedValue({
      rows: [
        {
          idcompra: 456,
          stcompra: "conc",
          flenvio: "sim",
          dtpagamento: "2026-04-23",
          email: "cliente@example.com",
          nmusuario: "Cliente Teste",
        },
      ],
    });

    await expect(queuePurchaseConfirmationEmail(456)).resolves.toEqual({
      status: "skipped",
      purchaseId: 456,
      reason: "purchase_email_already_queued",
    });
  });

  it("skips when the email queue table does not exist", async () => {
    dbQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM compra")) {
        return {
          rows: [
            {
              idcompra: 456,
              stcompra: "conc",
              flenvio: "nao",
              dtpagamento: "2026-04-23",
              email: "cliente@example.com",
              nmusuario: "Cliente Teste",
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

    await expect(queuePurchaseConfirmationEmail(456)).resolves.toEqual({
      status: "skipped",
      purchaseId: 456,
      reason: "email_queue_unavailable",
    });
  });
});
