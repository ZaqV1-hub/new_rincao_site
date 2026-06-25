import { beforeEach, describe, expect, it, vi } from "vitest";
import { createOnlinePurchase } from "@/lib/purchase-repository";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  clientQuery: vi.fn(),
  release: vi.fn(),
  generateUniqueVoucherNumber: vi.fn(),
  getPublicAgendaReservationById: vi.fn(),
  isAgendaDateExpired: vi.fn(),
}));

vi.mock("@/lib/agenda-repository", () => ({
  getPublicAgendaReservationById: mocks.getPublicAgendaReservationById,
  isAgendaDateExpired: mocks.isAgendaDateExpired,
}));

vi.mock("@/lib/ingresso-db", () => ({
  getIngressoDbPool: () => ({
    query: mocks.query,
    connect: async () => ({
      query: mocks.clientQuery,
      release: mocks.release,
    }),
  }),
}));

vi.mock("@/lib/voucher-number", () => ({
  generateUniqueVoucherNumber: mocks.generateUniqueVoucherNumber,
}));

describe("purchase-repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPublicAgendaReservationById.mockResolvedValue({
      id: 123,
      legacyEncodedId: "MTIz",
      date: "2026-07-20",
      type: "padra",
      title: "Day use",
      information: [],
      priceTable: {
        normal: "100.00",
        child: "70.00",
      },
    });
    mocks.isAgendaDateExpired.mockReturnValue(false);
    mocks.query.mockResolvedValue({ rows: [] });
    mocks.generateUniqueVoucherNumber.mockImplementation(async (_client, prefix) => {
      return `${prefix}-0001`;
    });
  });

  it("creates vouchers with B2C product descriptions from cart line items", async () => {
    const voucherInserts: Array<{ sql: string; values?: unknown[] }> = [];

    mocks.clientQuery.mockImplementation(async (sql: string, values?: unknown[]) => {
      if (sql === "BEGIN" || sql === "COMMIT") {
        return { rows: [] };
      }

      if (sql.includes("INSERT INTO compra")) {
        expect(values).toEqual(["52998224725", "345.00", null, null]);
        return { rows: [{ idcompra: 901 }] };
      }

      if (sql.includes("INSERT INTO voucher")) {
        voucherInserts.push({ sql, values });
        return { rows: [] };
      }

      throw new Error(`Unexpected query: ${sql}`);
    });

    await expect(
      createOnlinePurchase(
        "52998224725",
        123,
        {
          lineItems: [
            { productId: "passaporte-explorador", quantity: 2 },
            { productId: "passaporte-infantil", quantity: 1 },
            { productId: "cafe-da-manha", quantity: 3 },
          ],
        },
      ),
    ).resolves.toMatchObject({
      purchaseId: 901,
      totalValue: "345.00",
      voucherCount: 6,
    });

    expect(voucherInserts).toHaveLength(6);
    expect(voucherInserts.map((insert) => insert.sql)).toEqual(
      expect.arrayContaining([expect.stringContaining("descricao")]),
    );
    expect(voucherInserts.map((insert) => insert.values?.at(-1))).toEqual([
      "Passaporte Explorador",
      "Passaporte Explorador",
      "Passaporte Infantil",
      "Café da Manhã",
      "Café da Manhã",
      "Café da Manhã",
    ]);
  });
});
