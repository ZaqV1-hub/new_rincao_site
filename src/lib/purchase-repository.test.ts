import { beforeEach, describe, expect, it, vi } from "vitest";
import { createOnlinePurchase } from "@/lib/purchase-repository";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  systemQuery: vi.fn(),
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
  getIngressoSistemaDbPool: () => ({
    query: mocks.systemQuery,
    connect: async () => ({
      query: mocks.clientQuery,
      release: mocks.release,
    }),
  }),
}));

vi.mock("@/lib/rincao-content-store", () => ({
  getManagedB2cProducts: vi.fn(async () => []),
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
    mocks.systemQuery.mockResolvedValue({ rows: [] });
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
        expect(values).toEqual(["52998224725", "270.00", null, null]);
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
            { productId: "ingresso-adulto", quantity: 2 },
            { productId: "ingresso-crianca", quantity: 1 },
            { productId: "ingresso-isento", quantity: 3 },
          ],
        },
      ),
    ).resolves.toMatchObject({
      purchaseId: 901,
      totalValue: "270.00",
      voucherCount: 6,
    });

    expect(voucherInserts).toHaveLength(6);
    expect(voucherInserts.map((insert) => insert.sql)).toEqual(
      expect.arrayContaining([expect.stringContaining("descricao")]),
    );
    expect(voucherInserts.map((insert) => insert.values?.at(-1))).toEqual([
      "Adulto",
      "Adulto",
      "Criança",
      "Isento",
      "Isento",
      "Isento",
    ]);
  });
  it("applies codindica unit prices to B2C adult and child vouchers", async () => {
    const voucherInserts: Array<unknown[] | undefined> = [];

    mocks.systemQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM codindica")) {
        return {
          rows: [
            {
              codindica: "ISAQUE",
              stcodindica: "ati",
              validade: "2099-12-31",
              nmrepresentante: "Equipe",
              tpdesconto: "fixo",
              flpromocional: "n",
              vldescnormal: "0.00",
              vldescinfant: "0.00",
              vldescpromonormal: "0.00",
              vldescpromoinfant: "0.00",
              vlvendanormal: "50.00",
              vlvendainfant: "105.00",
              vlcashback: "0.00",
              vlcashbacknormal: "1.00",
              vlcashbackinfant: "1.00",
            },
          ],
        };
      }

      return { rows: [] };
    });

    mocks.clientQuery.mockImplementation(async (sql: string, values?: unknown[]) => {
      if (sql === "BEGIN" || sql === "COMMIT") {
        return { rows: [] };
      }

      if (sql.includes("INSERT INTO compra")) {
        expect(values).toEqual(["52998224725", "155.00", "15.00", "ISAQUE"]);
        return { rows: [{ idcompra: 902 }] };
      }

      if (sql.includes("INSERT INTO voucher")) {
        voucherInserts.push(values);
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
            { productId: "ingresso-adulto", quantity: 1 },
            { productId: "ingresso-crianca", quantity: 1 },
          ],
        },
        "ISAQUE",
      ),
    ).resolves.toMatchObject({
      purchaseId: 902,
      totalValue: "155.00",
      voucherCount: 2,
    });

    expect(voucherInserts).toHaveLength(2);
    expect(voucherInserts[0]).toEqual([
      902,
      "A-0001",
      123,
      "norma",
      "50.00",
      "-50.00",
      "ISAQUE",
      "2027-01-06",
      "Adulto",
    ]);
    expect(voucherInserts[1]).toEqual([
      902,
      "C-0001",
      123,
      "infan",
      "105.00",
      "35.00",
      "ISAQUE",
      "2027-01-06",
      "Criança",
    ]);
  });
});
