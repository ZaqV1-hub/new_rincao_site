import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadOperationalDayOffer } from "@/lib/operational-day-offer";
import type { PurchaseAgendaDetail } from "@/lib/purchase-contracts";
const mock = vi.hoisted(() => ({ query: vi.fn(), transactionQuery: vi.fn() }));
vi.mock("@/lib/ingresso-db", () => ({ getIngressoSistemaDbPool: () => ({ query: mock.query }) }));
vi.mock("@/lib/rincao-content-store", () => ({ getManagedB2cProducts: () => { throw new Error("JSON catalog must not supply date offers"); } }));
const agenda: Pick<PurchaseAgendaDetail, "id" | "date" | "priceTable"> = {
  id: 12, date: "2099-01-31", priceTable: { id: 7, name: "Dia", normal: "110.00", child: "80.00", gateNormal: "120.00", gateChild: "90.00" },
};
const configuration = { agendaId: 12, priceTableId: 7, validity: "7_days", ticketTypes: ["norma", "isent"], state: "open" };
const service = { id: "17", name: "Armário", description: "Uso de um armário.", sitePrice: "12.50", gatePrice: "15.00" };

describe("operational date offer", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("OPERATIONAL_PARK_ID", "rincao"); });
  afterEach(() => vi.unstubAllEnvs());
  it("keeps the three standard tickets only when there is no managed day", async () => {
    mock.query.mockResolvedValue({ rows: [] });
    const offer = await loadOperationalDayOffer(agenda);
    expect(offer.validity).toBeNull();
    expect(offer.products.map(({ id }) => id)).toEqual(["ingresso-adulto", "ingresso-crianca", "ingresso-isento"]);
    expect(offer.products[0].sitePrice).toBe("110.00");
    expect(mock.query).toHaveBeenCalledTimes(1);
  });
  it("uses only enabled tickets and assigned DB services, including a free service", async () => {
    mock.query.mockImplementation(async (sql: string, values: unknown[]) => {
      expect(values).toEqual(["rincao", agenda.date]);
      if (sql.includes("FROM operacao_dias")) return { rows: [configuration] };
      expect(sql).toContain("JOIN servico_datas");
      expect(sql).toContain("s.ativo=TRUE");
      expect(sql).toContain("s.preco_site IS NOT NULL");
      expect(sql).not.toContain("FOR SHARE");
      return { rows: [service, { ...service, id: "18", name: "Cortesia adicional", sitePrice: "0.00" }] };
    });
    const offer = await loadOperationalDayOffer(agenda);
    expect(offer.validity).toEqual({ validFrom: "2099-01-31", validUntil: "2099-02-06" });
    expect(offer.products.map(({ id }) => id)).toEqual(["ingresso-adulto", "ingresso-isento", "servico:17", "servico:18"]);
    expect(offer.products[2]).toMatchObject({ operationalServiceId: 17, type: "addon", title: "Armário", description: "Uso de um armário.", sitePrice: "12.50", boxOfficePrice: "15.00", voucherType: "espec", voucherPrefix: "S" });
    expect(offer.products[3].sitePrice).toBe("0.00");
  });
  it("does not fall back to standard tickets for an explicitly empty type selection", async () => {
    mock.query.mockImplementation(async (sql: string) => ({ rows: sql.includes("FROM operacao_dias") ? [{ ...configuration, ticketTypes: [] }] : [] }));
    expect((await loadOperationalDayOffer(agenda)).products).toEqual([]);
  });
  it.each([{ state: "closed" }, { agendaId: 99 }, { priceTableId: 99 }, { ticketTypes: ["escol"] }, { ticketTypes: null }])("refuses inconsistent or closed configuration %j", async (change) => {
    mock.query.mockResolvedValue({ rows: [{ ...configuration, ...change }] });
    await expect(loadOperationalDayOffer(agenda)).rejects.toMatchObject({ code: "agenda_unavailable", status: 409 });
  });
  it("reads through the transaction client and locks service prices there", async () => {
    vi.stubEnv("OPERATIONAL_PARK_ID", "estancia");
    mock.transactionQuery.mockImplementation(async (sql: string, values: unknown[]) => {
      expect(values).toEqual(["estancia", agenda.date]);
      if (sql.includes("FROM operacao_dias")) return { rows: [configuration] };
      expect(sql).toContain("FOR SHARE OF s");
      return { rows: [service] };
    });
    expect((await loadOperationalDayOffer(agenda, { query: mock.transactionQuery })).products.at(-1)?.id).toBe("servico:17");
    expect(mock.query).not.toHaveBeenCalled();
  });
});
