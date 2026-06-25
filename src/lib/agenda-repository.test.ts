import { describe, expect, it } from "vitest";
import { isAgendaDateExpired } from "@/lib/agenda-repository";

describe("agenda availability", () => {
  it("marks dates before today as expired", () => {
    const now = new Date("2026-04-27T10:00:00");

    expect(isAgendaDateExpired("2026-04-26", now)).toBe(true);
    expect(isAgendaDateExpired("2026-04-27", now)).toBe(false);
    expect(isAgendaDateExpired("2026-04-28", now)).toBe(false);
  });
});
