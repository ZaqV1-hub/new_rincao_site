import { describe, expect, it } from "vitest";
import { getSaoPauloToday, isCivilDate, voucherValidityRange } from "./operational-date";

describe("operational civil dates", () => {
  it.each(["2024-02-29", "2000-02-29", "2099-12-31"])("accepts real civil date %s", (date) => {
    expect(isCivilDate(date)).toBe(true);
  });
  it.each(["2023-02-29", "1900-02-29", "2024-04-31", "2024-1-01", "0000-01-01", "2024-01-01T00:00:00Z", null])("rejects invalid date %j", (date) => {
    expect(isCivilDate(date)).toBe(false);
  });
  it("uses the Sao Paulo date before the UTC midnight boundary", () => {
    expect(getSaoPauloToday(new Date("2026-11-12T02:59:59Z"))).toBe("2026-11-11");
    expect(getSaoPauloToday(new Date("2026-11-12T03:00:00Z"))).toBe("2026-11-12");
  });
  it.each([
    ["2026-12-31", "day", "2026-12-31"],
    ["2026-12-31", "7_days", "2027-01-06"],
    ["2024-02-01", "30_days", "2024-03-01"],
    ["2024-08-31", "6_months", "2025-02-28"],
    ["2023-08-31", "6_months", "2024-02-29"],
    ["2026-04-15", "6_months", "2026-10-15"],
  ] as const)("computes inclusive %s / %s", (date, validity, until) => {
    expect(voucherValidityRange(date, validity)).toEqual({ validFrom: date, validUntil: until });
  });
  it("refuses invalid dates and unsupported validity", () => {
    expect(() => voucherValidityRange("2026-02-30", "day")).toThrow();
    expect(() => voucherValidityRange("2026-01-01", "unknown" as never)).toThrow();
  });
});
