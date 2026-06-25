import { describe, expect, it } from "vitest";
import type { PublicAgendaEvent } from "@/lib/agenda-contracts";
import {
  buildPublicAgendaPurchaseHref,
  buildPublicAgendaSelectionHref,
  resolveSelectedAgendaId,
} from "@/lib/public-agenda-selection";

const events: PublicAgendaEvent[] = [
  {
    id: 2270,
    legacyEncodedId: "MjI3MA==",
    date: "2026-05-09",
    day: 9,
    month: 5,
    year: 2026,
    type: "padra",
    status: "abe",
    statusLabel: "Aberto",
    priceTable: {
      id: 26,
      name: "Tabela",
      normal: "49.90",
      child: "49.90",
      gateNormal: "80.00",
      gateChild: "60.00",
    },
    promotional: {
      name: null,
      description: null,
    },
  },
];

describe("public-agenda-selection", () => {
  it("keeps the selected agenda id when it belongs to the current month payload", () => {
    expect(resolveSelectedAgendaId(events, "2270")).toBe(2270);
  });

  it("drops the selected agenda id when it is not present in the current month payload", () => {
    expect(resolveSelectedAgendaId(events, "9999")).toBeNull();
    expect(resolveSelectedAgendaId(events, "abc")).toBeNull();
  });

  it("builds a href that preserves month/year and selected agenda id", () => {
    expect(buildPublicAgendaSelectionHref(5, 2026, 2270)).toBe(
      "/agenda?mes=5&ano=2026&agendaId=2270",
    );
  });

  it("builds the purchase href for the selected date step", () => {
    expect(buildPublicAgendaPurchaseHref(events[0])).toBe("/comprar/MjI3MA==");
  });
});
