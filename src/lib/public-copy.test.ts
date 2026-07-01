import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { homeHighlights, infoPages } from "@/lib/site-content";

describe("public agenda copy", () => {
  it("describes the public Day-Use journey as agenda and purchase, not scheduling", () => {
    expect(homeHighlights.map((item) => item.text).join(" ")).not.toMatch(
      /agendamento/i,
    );
    expect(infoPages.agenda.seoDescription).not.toMatch(/agendamento/i);
    expect(infoPages.agenda.summary).not.toMatch(/agendamento/i);
    expect(infoPages.agenda.highlights.join(" ")).not.toMatch(/agendamento/i);
    expect(infoPages.agenda.cta.label).toBe("Comprar ingressos");
    expect(infoPages["day-use-familia"].cta.label).toBe("Comprar ingressos");
  });

  it("does not show scheduling labels in the public ticket agenda UI", () => {
    const publicAgenda = readFileSync(
      "src/components/public-agenda.tsx",
      "utf8",
    );
    const ingressoShell = readFileSync(
      "src/components/ingresso-shell.tsx",
      "utf8",
    );
    const legacyEventPage = readFileSync(
      "src/components/legacy-event-page.tsx",
      "utf8",
    );

    expect(publicAgenda).not.toMatch(/Agendamento|agendamento/);
    expect(ingressoShell).not.toMatch(/Agendamento|agendamento/);
    expect(legacyEventPage).not.toMatch(/agendamento/);
  });
});
