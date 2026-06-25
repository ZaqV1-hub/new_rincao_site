import { describe, expect, it } from "vitest";
import { getAgendaToneClasses } from "@/components/painel-agenda-manager";

describe("PainelAgendaManager tone helpers", () => {
  it("keeps open standard agendas green when selected", () => {
    const classes = getAgendaToneClasses(
      {
        status: "abe",
        type: "padra",
      },
      true,
    );

    expect(classes).toContain("bg-[#8dc72b]");
    expect(classes).toContain("ring-2");
  });

  it("renders closed agendas with muted legacy styling", () => {
    const classes = getAgendaToneClasses(
      {
        status: "fec",
        type: "padra",
      },
      true,
    );

    expect(classes).toContain("bg-[#dce8f2]");
    expect(classes).toContain("text-[#24455d]");
    expect(classes).toContain("ring-2");
  });
});
