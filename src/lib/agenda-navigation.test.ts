import { describe, expect, it } from "vitest";
import {
  buildAgendaMonthRange,
  buildNavigableAgendaMonths,
  compareAgendaMonths,
  resolveAgendaMonthInRange,
} from "@/lib/agenda-navigation";

describe("agenda-navigation", () => {
  it("compares months by year and month", () => {
    expect(compareAgendaMonths({ month: 4, year: 2026 }, { month: 4, year: 2026 })).toBe(0);
    expect(compareAgendaMonths({ month: 4, year: 2026 }, { month: 5, year: 2026 })).toBeLessThan(0);
    expect(compareAgendaMonths({ month: 1, year: 2027 }, { month: 12, year: 2026 })).toBeGreaterThan(0);
  });

  it("builds a contiguous month range", () => {
    expect(
      buildAgendaMonthRange({ month: 11, year: 2026 }, { month: 2, year: 2027 }),
    ).toEqual([
      { month: 11, year: 2026 },
      { month: 12, year: 2026 },
      { month: 1, year: 2027 },
      { month: 2, year: 2027 },
    ]);
  });

  it("includes empty months between the current month and the last available month", () => {
    expect(
      buildNavigableAgendaMonths(
        { month: 4, year: 2026 },
        [
          { month: 4, year: 2026 },
          { month: 7, year: 2026 },
        ],
      ),
    ).toEqual([
      { month: 4, year: 2026 },
      { month: 5, year: 2026 },
      { month: 6, year: 2026 },
      { month: 7, year: 2026 },
    ]);
  });

  it("never returns months before the current month", () => {
    expect(
      buildNavigableAgendaMonths(
        { month: 4, year: 2026 },
        [{ month: 3, year: 2026 }],
        { month: 2, year: 2026 },
      ),
    ).toEqual([{ month: 4, year: 2026 }]);
  });

  it("clamps requested months to the navigable range", () => {
    const months = [
      { month: 4, year: 2026 },
      { month: 5, year: 2026 },
      { month: 6, year: 2026 },
    ];

    expect(resolveAgendaMonthInRange({ month: 3, year: 2026 }, months)).toEqual({
      month: 4,
      year: 2026,
    });
    expect(resolveAgendaMonthInRange({ month: 5, year: 2026 }, months)).toEqual({
      month: 5,
      year: 2026,
    });
    expect(resolveAgendaMonthInRange({ month: 9, year: 2026 }, months)).toEqual({
      month: 6,
      year: 2026,
    });
  });
});
