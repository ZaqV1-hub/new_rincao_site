import { describe, expect, it, vi } from "vitest";
import { getOperationalCalendar, mapOperationalCalendarDay, OPERATIONAL_CALENDAR_SQL } from "./painel-operational-calendar";
import type { OperationalDaySummary } from "./operational-day-summary";
const row = () => ({ date: "2026-11-16", closed: false, frozen: null as OperationalDaySummary | null, scheduled: true, counting: true, vehicleCount: "3",
  sales: { tickets: "7", admitted: "2", site: "12000", gate: "3000", services: "1000", invalidAmounts: "0", unclassifiedCount: "0" },
  metadata: { groupCount: "2", plannedPeople: "40", missingPlans: "0", cashCount: "1" }, financial: { revenue: "15000", invalidReceipts: "0" } });
describe("monthly operational calendar", () => {
  it("combines canonical visit revenues and forecasts without turning agendas into groups", () => {
    expect(mapOperationalCalendarDay(row(), "rincao", "2026-11-16")).toEqual({ date: "2026-11-16", plannedPeople: 47, groupCount: 2, vehicleCount: 3, counting: true, revenueCents: 31000, closed: false, closurePending: true });
    expect(mapOperationalCalendarDay(row(), "rincao", "2026-11-15").closurePending).toBe(false);
  });
  it("keeps missing plans and unclassified or invalid money unavailable", () => {
    const r = row(); r.metadata.missingPlans = "1"; r.sales.unclassifiedCount = "1";
    expect(mapOperationalCalendarDay(r, "rincao", r.date)).toMatchObject({ plannedPeople: null, revenueCents: null });
    r.sales.unclassifiedCount = "0"; r.financial.invalidReceipts = "1";
    expect(mapOperationalCalendarDay(r, "rincao", r.date).revenueCents).toBeNull();
  });
  it("uses frozen values and never falls back to mutable money for closed days", () => {
    const r = row(); r.closed = true;
    expect(mapOperationalCalendarDay(r, "rincao", r.date)).toMatchObject({ plannedPeople: null, revenueCents: null, groupCount: null, closurePending: false, counting: false });
    r.frozen = { park: "rincao", date: r.date, groupCount: 1, forecast: { ticketsForSelectedDate: { status: "available", value: 3 }, plannedGroupPeople: { status: "available", value: 5 } }, revenue: { totalCents: { status: "available", value: 9000 } } } as OperationalDaySummary;
    expect(mapOperationalCalendarDay(r, "rincao", r.date)).toMatchObject({ plannedPeople: 8, revenueCents: 9000, groupCount: 1 });
    r.frozen.date = "2026-11-15";
    expect(() => mapOperationalCalendarDay(r, "rincao", r.date)).toThrow(/outra data/);
  });
  it("issues one bounded query and rejects excessive or invalid ranges", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    await getOperationalCalendar("2026-11-01", "2026-11-30", { query });
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toBe(OPERATIONAL_CALENDAR_SQL);
    expect(query.mock.calls[0][1]).toEqual(["2026-11-01", "2026-11-30", "rincao"]);
    await expect(getOperationalCalendar("2026-11-01", "2026-12-02", { query })).rejects.toThrow(/31 datas/);
    await expect(getOperationalCalendar("2026-02-30", "2026-03-01", { query })).rejects.toThrow(/31 datas/);
    expect(query).toHaveBeenCalledTimes(1);
  });
});
