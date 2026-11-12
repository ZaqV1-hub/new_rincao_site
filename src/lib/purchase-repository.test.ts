import { buildStandardTicketProducts } from "@/lib/standard-ticket-products";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createOnlinePurchase } from "@/lib/purchase-repository";

const mocks = vi.hoisted(() => ({
  offer: vi.fn(),
  query: vi.fn(),
  systemQuery: vi.fn(),
  clientQuery: vi.fn(),
  release: vi.fn(),
  generateUniqueVoucherNumber: vi.fn(),
  getPublicAgendaReservationById: vi.fn(),
  isAgendaDateExpired: vi.fn(),
}));

vi.mock("@/lib/operational-day-offer", () => ({
  loadOperationalDayOffer: mocks.offer,
  OperationalDayOfferError: class extends Error {},
}));
const standardOffer = (agenda?: { priceTable: { normal: string; child: string } }) => ({ products: buildStandardTicketProducts({ siteNormal: agenda?.priceTable.normal ?? "100.00", siteChild: agenda?.priceTable.child ?? "70.00" }), validity: null });
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
    mocks.offer.mockImplementation(standardOffer);
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

  it.each([501, Number.MAX_SAFE_INTEGER + 1, -1, 1.5])("rejects unsafe legacy quantities before inserting a purchase (%s)", async (exempt) => {
    mocks.clientQuery.mockResolvedValue({ rows: [] });
    await expect(createOnlinePurchase("52998224725", 123, {
      normal: 1, child: 0, discountedNormal: 0, discountedChild: 0, exempt,
    })).rejects.toMatchObject({ code: "invalid_purchase", status: 400 });
    expect(mocks.clientQuery.mock.calls.some(([sql]) => String(sql).includes("INSERT INTO compra"))).toBe(false);
  });

  it("includes a service at full price with an indication code and stores its identity", async () => {
    mocks.offer.mockResolvedValueOnce({ ...standardOffer(), products: [...standardOffer().products, {
      id: "servico:7", operationalServiceId: 7, type: "addon", title: "Armário", description: "Armário",
      subtitle: "Serviço", imageSrc: "", sitePrice: "17.35", boxOfficePrice: "20.00",
      voucherType: "espec", voucherPrefix: "S", active: true,
    }] });
    mocks.systemQuery.mockImplementation(async (sql: string) => ({ rows: sql.includes("FROM codindica") ? [{
      codindica: "ISAQUE", stcodindica: "ati", validade: "2099-12-31", tpdesconto: "fixo", flpromocional: "n",
      vlvendanormal: "90.00", vlvendainfant: "70.00", vldescnormal: "0.00", vldescinfant: "0.00",
      vldescpromonormal: "0.00", vldescpromoinfant: "0.00", vlcashback: "0.00", vlcashbacknormal: "0.00", vlcashbackinfant: "0.00",
    }] : [] }));
    const items: unknown[][] = [];
    mocks.clientQuery.mockImplementation(async (sql: string, values: unknown[]) => {
      if (sql.includes("INSERT INTO compra")) { expect(values).toEqual(["52998224725", "124.70", "10.00", "ISAQUE"]); return { rows: [{ idcompra: 903 }] }; }
      if (sql.includes("INSERT INTO voucher")) items.push(values);
      return mocks.systemQuery(sql, values);
    });
    const result = await createOnlinePurchase("52998224725", 123, { lineItems: [
      { productId: "ingresso-adulto", quantity: 1 }, { productId: "servico:7", quantity: 2 },
    ] }, "ISAQUE");
    expect(result).toMatchObject({ totalValue: "124.70", voucherCount: 3 });
    expect(mocks.offer).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ query: mocks.clientQuery }));
    expect(items.filter((values) => values[3] === "espec").map((values) => [values[4], values[5], values[6], values.at(-1)]))
      .toEqual([["17.35", "0.00", null, 7], ["17.35", "0.00", null, 7]]);
  });

  it("creates vouchers with B2C product descriptions from cart line items", async () => {
    const voucherInserts: Array<{ sql: string; values?: unknown[] }> = [];

    mocks.clientQuery.mockImplementation(async (sql: string, values?: unknown[]) => {
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
        return { rows: [] };
      }

      if (sql.includes("INSERT INTO compra")) {
        expect(values).toEqual(["52998224725", "270.00", null, null]);
        expect(sql).toContain("origem_checkout");
        expect(sql).toContain("'site'");
        return { rows: [{ idcompra: 901 }] };
      }

      if (sql.includes("INSERT INTO voucher")) {
        voucherInserts.push({ sql, values });
        return { rows: [] };
      }

      return mocks.systemQuery(sql, values);
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
    expect(voucherInserts.map((insert) => insert.values?.[8])).toEqual([
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
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
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

      return mocks.systemQuery(sql, values);
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
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      "Adulto",
      null, null, null,
    ]);
    expect(voucherInserts[1]).toEqual([
      902,
      "C-0001",
      123,
      "infan",
      "105.00",
      "35.00",
      "ISAQUE",
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      "Criança",
      null, null, null,
    ]);
  });
});

describe("transactional day-use purchase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.offer.mockImplementation(standardOffer);
    mocks.getPublicAgendaReservationById.mockResolvedValue({ id: 123, date: "2099-07-20", type: "padra", priceTable: { id: 1, normal: "100.00", child: "70.00" } });
    mocks.isAgendaDateExpired.mockReturnValue(false);
    mocks.systemQuery.mockResolvedValue({ rows: [] });
    mocks.generateUniqueVoucherNumber.mockResolvedValue("A-0001");
    mocks.clientQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("SELECT dtagenda")) return { rows: [{ date: "2099-07-20" }] };
      if (sql.includes("FROM operacao_dias")) return { rows: [{ park: "rincao", date: "2099-07-20", agendaId: 123, priceTableId: 1, validity: "7_days", ticketTypes: ["norma", "infan", "isent"], onlineLimit: 4, closed: false }] };
      if (sql.includes("SUM(")) return { rows: [{ occupied: "0" }] };
      if (sql.includes("INSERT INTO compra")) return { rows: [{ idcompra: 901 }] };
      return { rows: [] };
    });
  });
  it.each([
    { lineItems: [{ productId: "ingresso-adulto", quantity: 1 }, { productId: "ingresso-isento", quantity: 3 }] },
    { normal: 1, child: 0, exempt: 3, discountedNormal: 0, discountedChild: 0 },
  ])("reserves all people and snapshots validity after transactional pricing: %j", async (selection) => {
    await createOnlinePurchase("52998224725", 123, selection);
    expect(mocks.systemQuery).not.toHaveBeenCalled();
    expect(mocks.getPublicAgendaReservationById).toHaveBeenCalledWith(123, expect.objectContaining({ query: mocks.clientQuery }));
    const queries = mocks.clientQuery.mock.calls;
    expect(queries.find(([sql]) => sql.includes("INSERT INTO online_capacity_reservations"))?.[1]).toEqual([901, "rincao", "2099-07-20", 4]);
    const inserts = queries.filter(([sql]) => sql.includes("INSERT INTO voucher"));
    expect(inserts).toHaveLength(4);
    for (const [sql, values] of inserts) {
      expect(sql).toContain("dtinicio_validade");
      expect(values).toEqual(expect.arrayContaining(["2099-07-20", "2099-07-26", "rincao"]));
    }
  });
  it.each([
    { lineItems: [{ productId: "ingresso-isento", quantity: 1 }] },
    { normal: 0, child: 0, exempt: 1, discountedNormal: 0, discountedChild: 0 },
  ])("rejects an exclusively free purchase without orphan rows: %j", async (selection) => {
    await expect(createOnlinePurchase("52998224725", 123, selection)).rejects.toMatchObject({ code: "invalid_purchase" });
    expect(mocks.clientQuery.mock.calls.some(([sql]) => sql.includes("INSERT INTO"))).toBe(false);
    expect(mocks.clientQuery).toHaveBeenCalledWith("ROLLBACK");
  });
  it("rejects changed configuration and disabled types before inserting anything", async () => {
    const normalQuery = mocks.clientQuery.getMockImplementation()!;
    mocks.clientQuery.mockImplementation(async (sql: string, ...args: unknown[]) => {
      if (sql.includes("FROM operacao_dias")) return { rows: [{ park: "rincao", date: "2099-07-20", agendaId: 123, priceTableId: 2, validity: "7_days", ticketTypes: ["norma"], onlineLimit: 4 }] };
      return normalQuery(sql, ...args);
    });
    await expect(createOnlinePurchase("52998224725", 123, { lineItems: [{ productId: "ingresso-adulto", quantity: 1 }] })).rejects.toMatchObject({ code: "agenda_changed" });
    expect(mocks.clientQuery.mock.calls.some(([sql]) => sql.includes("INSERT INTO"))).toBe(false);
    mocks.clientQuery.mockImplementation(async (sql: string, ...args: unknown[]) => {
      if (sql.includes("FROM operacao_dias")) return { rows: [{ park: "rincao", date: "2099-07-20", agendaId: 123, priceTableId: 1, validity: "7_days", ticketTypes: ["norma"], onlineLimit: 4 }] };
      return normalQuery(sql, ...args);
    });
    await expect(createOnlinePurchase("52998224725", 123, { normal: 1, child: 0, exempt: 1, discountedNormal: 0, discountedChild: 0 })).rejects.toMatchObject({ code: "ticket_type_unavailable" });
    expect(mocks.clientQuery.mock.calls.some(([sql]) => sql.includes("INSERT INTO"))).toBe(false);
  });
  it.each([
    { lineItems: [{ productId: "ingresso-adulto", quantity: 1 }] },
    { normal: 1, child: 0, exempt: 0, discountedNormal: 0, discountedChild: 0 },
  ])("refuses a zero priced paid ticket in both selection shapes: %j", async (selection) => {
    mocks.getPublicAgendaReservationById.mockResolvedValue({ id: 123, date: "2099-07-20", type: "padra", priceTable: { id: 1, normal: "0.00", child: "70.00" } });
    await expect(createOnlinePurchase("52998224725", 123, selection)).rejects.toMatchObject({ code: "invalid_purchase" });
    expect(mocks.clientQuery.mock.calls.some(([sql]) => sql.includes("INSERT INTO"))).toBe(false);
  });

});
