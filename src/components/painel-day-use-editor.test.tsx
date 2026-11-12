import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PainelDayUseEditor } from "./painel-day-use-editor";
import type { OperationalDay } from "@/lib/operational-day";

const day: OperationalDay = { date: "2099-01-31", version: null, priceTableId: 1, dayUseAgendaId: null, dayUseOpen: false, validity: "7_days", onlineLimit: 0, ticketTypes: ["norma", "infan", "isent"], serviceIds: [], closed: false };
const props = { day, priceTables: [{ id: 1, label: "Tabela padrão" }], services: [], canEdit: true };

describe("PainelDayUseEditor", () => {
  it("shows the actual inclusive interval and any-open-day rule", () => {
    const html = renderToStaticMarkup(<PainelDayUseEditor {...props} />);
    expect(html).toContain("31/01/2099");
    expect(html).toContain("06/02/2099");
    expect(html).toContain("qualquer dia com day use aberto");
    expect(html).toContain("sem reagendamento");
    expect(html).toContain('value="0"');
  });
  it("keeps a finalized day read-only", () => {
    const html = renderToStaticMarkup(<PainelDayUseEditor {...props} day={{ ...day, closed: true }} />);
    expect(html).toContain("Dia finalizado");
    expect(html).toContain("disabled");
    expect(html).not.toContain("Salvar day use");
  });
  it("shows a consultation-only view to a non-manager", () => {
    const html = renderToStaticMarkup(<PainelDayUseEditor {...props} canEdit={false} />);
    expect(html).not.toContain("Salvar day use");
  });
});
