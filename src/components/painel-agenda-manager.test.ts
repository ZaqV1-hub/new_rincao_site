import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { applyAgendaPriceSelection, canSelectAgendaDate, getAgendaToneClasses, groupAgendaEntries, PainelAgendaManager } from "@/components/painel-agenda-manager";

describe("PainelAgendaManager tone helpers", () => {
  it("keeps open standard agendas lime green when selected", () => {
    const classes = getAgendaToneClasses(
      {
        status: "abe",
        type: "padra",
      },
      true,
    );

    expect(classes).toContain("bg-[#84bd00]");
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

import type { PainelAgendaMonthEntry, PainelAgendaScreenData } from "@/lib/painel-agenda";
import type { OperationalDay } from "@/lib/operational-day";
const day: OperationalDay = { date: "2099-01-02", version: 3, priceTableId: 2, dayUseAgendaId: null,
  dayUseOpen: false, validity: "day", onlineLimit: null, ticketTypes: ["norma"], serviceIds: [], closed: false };
function entry(id: number, type: PainelAgendaMonthEntry["type"]): PainelAgendaMonthEntry {
  return { id, date: "2099-01-03", day: 3, month: 1, year: 2099, type,
    typeLabel: type === "padra" ? "Data padrão" : "Data escolar", status: "abe", statusLabel: "Aberta",
    priceTableId: 1, priceTableName: "Tabela padrão", normalValue: null, childValue: null,
    gateNormalValue: null, gateChildValue: null, informationId: null, informationName: null,
    promotionName: null, promotionDescription: null };
}
const data: PainelAgendaScreenData = { month: 1, year: 2099, selectedDate: "2099-01-02", selectedDay: null,
  entries: [entry(1, "padra"), entry(2, "escol")], priceTables: [{ id: 1, label: "Padrão" }, { id: 2, label: "Alta temporada" }], informationOptions: [] };
const props = { data, operationalDays: [day], today: "2099-01-02", canEdit: true };
afterEach(() => vi.unstubAllGlobals());

describe("operational agenda calendar", () => {
  it("groups all agenda entries by civil date instead of losing the group beside day use", () => {
    expect(groupAgendaEntries(data.entries).get("2099-01-03")?.map((item) => item.id)).toEqual([1, 2]);
    const html = renderToStaticMarkup(React.createElement(PainelAgendaManager, props));
    expect(html).toContain("Day use aberto");
    expect(html).toContain("1 agenda de grupos");
    expect(html).toContain("Alta temporada");
    expect(html).toContain('href="/painel/agenda/2099-01-03?mes=1&amp;ano=2099"');
    expect(html).toContain('/painel/agenda/2099-01-02/editar');
  });
  it("uses refreshed configuration instead of a stale sold-out agenda status", () => {
    const html = renderToStaticMarkup(React.createElement(PainelAgendaManager, {
      ...props,
      data: { ...data, selectedDate: "2099-01-03", entries: [{ ...entry(1, "padra"), status: "lot" }] },
      operationalDays: [{ ...day, date: "2099-01-03", dayUseAgendaId: 1, dayUseOpen: false }],
    }));
    expect(html).toContain("Day use fechado");
    expect(html).not.toContain("Day use esgotado");
    expect(html).not.toContain("vendas esgotadas");
  });
  it("disallows past and finalized dates but permits empty future days and today", () => {
    expect(canSelectAgendaDate("2099-01-01", props.today)).toBe(false);
    expect(canSelectAgendaDate(props.today, props.today)).toBe(true);
    expect(canSelectAgendaDate("2099-01-03", props.today, { ...day, closed: true })).toBe(false);
    const html = renderToStaticMarkup(React.createElement(PainelAgendaManager, { ...props, operationalDays: [{ ...day, closed: true }] }));
    expect(html).not.toContain('aria-label="Selecionar 01/01/2099"');
    expect(html).not.toContain('aria-label="Selecionar 02/01/2099"');
    expect(html).toContain('aria-label="Selecionar 03/01/2099"');
    expect(html).toContain("Dia finalizado");
  });
  it("shows saved prices without requiring an existing day-use agenda", () => {
    const html = renderToStaticMarkup(React.createElement(PainelAgendaManager, props));
    expect(html).toContain("Tabela de preço da data");
    expect(html).toContain("Alta temporada");
    expect(html).toContain("Abrir day use");
  });
  it("hides mutations from non-managers and blocks them while configuration is unavailable", () => {
    const readOnly = renderToStaticMarkup(React.createElement(PainelAgendaManager, { ...props, canEdit: false }));
    expect(readOnly).not.toContain('type="checkbox"');
    expect(readOnly).not.toContain("Abrir day use");
    const unavailable = renderToStaticMarkup(React.createElement(PainelAgendaManager, { ...props, operationalDays: null }));
    expect(unavailable).toContain("Programação indisponível");
    expect(unavailable).not.toContain('type="checkbox"');
  });
  it("submits only dates, expected versions, price and reason, then returns confirmed days", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ ok: true, data: [{ ...day, version: 4 }] }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await applyAgendaPriceSelection(["2099-01-02", "2099-01-03"], [day], 2, "Temporada", props.today)).toEqual([{ ...day, version: 4 }]);
    const [url, request] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/painel/dias");
    expect(request.method).toBe("PATCH");
    expect(JSON.parse(request.body)).toEqual({ dates: [{ date: "2099-01-02", version: 3 }, { date: "2099-01-03", version: null }], priceTableId: 2, reason: "Temporada" });
  });
  it("keeps the selected dates and current versions intact on conflict", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ ok: false, error: { message: "Programação alterada" } }, { status: 409 })));
    const dates = ["2099-01-02"];
    const days = [{ ...day }];
    await expect(applyAgendaPriceSelection(dates, days, 2, "Temporada", props.today)).rejects.toMatchObject({ status: 409 });
    expect(dates).toEqual(["2099-01-02"]);
    expect(days[0].version).toBe(3);
  });
  it("rejects a stale selection of past or finalized days before sending it", async () => {
    vi.stubGlobal("fetch", () => { throw new Error("Unexpected request"); });
    await expect(applyAgendaPriceSelection(["2099-01-01"], [], 2, "Temporada", props.today)).rejects.toThrow("não pode");
    await expect(applyAgendaPriceSelection([day.date], [{ ...day, closed: true }], 2, "Temporada", props.today)).rejects.toThrow("não pode");
  });
});
