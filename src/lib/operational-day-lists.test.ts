import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_DAY_PURCHASE_FILTERS, normalizeDayPurchaseFilters, readOperationalDayList, type DayPurchaseFilters } from "./operational-day-lists";

describe("day purchase filters", () => {
  beforeEach(() => vi.stubEnv("OPERATIONAL_PARK_ID", "rincao"));
  afterEach(() => vi.unstubAllEnvs());
  it("normalizes optional fields without exposing mutable shared defaults", () => {
    expect(normalizeDayPurchaseFilters({ query: "  Ana  " })).toEqual({ origin: "all", type: "all", query: "Ana" });
    const first = normalizeDayPurchaseFilters();
    first.origin = "gate";
    expect(normalizeDayPurchaseFilters()).toEqual({ origin: "all", type: "all", query: "" });
    expect(Object.isFrozen(DEFAULT_DAY_PURCHASE_FILTERS)).toBe(true);
    expect(normalizeDayPurchaseFilters({ query: "a".repeat(120) }).query).toHaveLength(120);
  });
  it.each([null, [], "site", { origin: "other" }, { type: "service" }, { query: 1 }, { query: "a".repeat(121) }, { origin: null }, { type: null }, { page: 2 }])("rejects malformed filter input %j", async (filters) => {
    const client = { query: vi.fn() };
    await expect(readOperationalDayList(client, "2099-11-15", "purchases", 1, filters as Partial<DayPurchaseFilters>)).rejects.toMatchObject({ code: "invalid_input" });
    expect(client.query).not.toHaveBeenCalled();
  });
  it.each([0, -1, 1.5, 1000001, NaN])("rejects invalid page %s before SQL", async (page) => {
    const client = { query: vi.fn() };
    await expect(readOperationalDayList(client, "2099-11-15", "purchases", page)).rejects.toMatchObject({ code: "invalid_input" });
    expect(client.query).not.toHaveBeenCalled();
  });
  it("rejects invalid dates and purchase filters on group reads", async () => {
    const client = { query: vi.fn() };
    await expect(readOperationalDayList(client, "2099-02-30", "purchases", 1)).rejects.toMatchObject({ code: "invalid_input" });
    await expect(readOperationalDayList(client, "2099-11-15", "groups", 1, {})).rejects.toMatchObject({ code: "invalid_input" });
    expect(client.query).not.toHaveBeenCalled();
  });
  it("uses one parameterized aggregate and validates returned counter precision", async () => {
    const client = { query: vi.fn().mockResolvedValue({ rows: [{ total: "0", items: [], counters: { origin: { all: "9007199254740992", site: "0", gate: "0" }, type: { all: "0", dayuse: "0", group: "0" } } }] }) };
    const query = "100%_! ' OR 1=1";
    await expect(readOperationalDayList(client, "2099-11-15", "purchases", 2, { query })).rejects.toMatchObject({ code: "invalid_data" });
    expect(client.query).toHaveBeenCalledTimes(1);
    const [sql, parameters] = client.query.mock.calls[0];
    expect(sql).not.toContain(query);
    expect(parameters).toEqual(["2099-11-15", "rincao", 20, "all", "all", "%100!%!_!! ' OR 1=1%", "", ""]);
  });
});
