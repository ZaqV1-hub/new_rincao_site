import { describe, expect, it } from "vitest";
import {
  buildPainelAgendaCalendar,
  formatPainelAgendaDateLabel,
  formatPainelAgendaMonthLabel,
  getPainelAgendaTypeOptions,
} from "@/lib/painel-agenda-ui";

describe("painel-agenda helpers", () => {
  it("builds a complete month grid including padding days", () => {
    const cells = buildPainelAgendaCalendar(4, 2026);

    expect(cells.length).toBe(35);
    expect(cells[0]).toMatchObject({
      day: 29,
      inMonth: false,
      date: "2026-03-29",
    });
    expect(cells.at(-1)).toMatchObject({
      day: 2,
      inMonth: false,
      date: "2026-05-02",
    });
  });

  it("formats labels in pt-BR", () => {
    expect(formatPainelAgendaMonthLabel(4, 2026)).toBe("Abril de 2026");
    expect(formatPainelAgendaDateLabel("2026-04-27")).toBe("27/04/2026");
  });

  it("locks type options to school when editing a school agenda", () => {
    expect(getPainelAgendaTypeOptions("escol")).toEqual([
      { value: "escol", label: "Data escolar" },
    ]);
  });
});
