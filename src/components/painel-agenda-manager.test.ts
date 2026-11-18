import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { applyAgendaPriceSelection, canSelectAgendaDate, getAgendaToneClasses, groupAgendaEntries, PainelAgendaManager, EmptyAgendaDateDialog } from "@/components/painel-agenda-manager";

describe("PainelAgendaManager tone helpers", () => {
  it("keeps open standard agendas blue when selected", () => {
    const classes = getAgendaToneClasses(
      {
        status: "abe",
        type: "padra",
      },
      true,
    );

    expect(classes).toContain("bg-[#eaf2fb]");
    expect(classes).toContain("ring-2");
  });

  it("renders closed agendas with the neutral calendar styling", () => {
    const classes = getAgendaToneClasses(
      {
        status: "fec",
        type: "padra",
      },
      true,
    );

    expect(classes).toContain("bg-white");
    expect(classes).toContain("text-[#0f2d52]");
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
    expect(html).toContain("1 passeio");
    expect(html).not.toContain("Alta temporada");
    expect(html).toContain('href="/painel/agenda/2099-01-03?mes=1&amp;ano=2099"');
    expect(html).not.toContain('/painel/agenda/2099-01-02/editar');
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
    expect(html).toContain("Fechado");
  });
  it("opens empty future dates through a dialog instead of linking directly to day-use editing", () => {
    const html = renderToStaticMarkup(React.createElement(PainelAgendaManager, { ...props, indicators: [] }));
    expect(html).toContain('aria-label="Abrir opções de 02/01/2099" aria-haspopup="dialog"');
    expect(html).toContain("group-hover:opacity-100");
    expect(html).not.toContain("Tabela de preço da data");
    expect(html).not.toContain("Alta temporada");
    expect(html).not.toContain('/painel/agenda/2099-01-02/editar');
  });
  it("offers the selected date and both real destinations in the empty-date dialog", () => {
    const html = renderToStaticMarkup(React.createElement(EmptyAgendaDateDialog, { date: "2099-01-02", canEdit: true, canAccessClients: true, onClose: () => {} }));
    expect(html).toContain("Ainda não há nada aberto nesta data.");
    expect(html).toContain("2 de janeiro de 2099");
    expect(html).toContain("Abrir Day Use");
    expect(html).toContain('href="/painel/agenda/2099-01-02/editar"');
    expect(html).toContain("Agendar passeio de grupo");
    expect(html).toContain('href="/painel/clientes"');
    expect(html).toContain("Cancelar");
    const readOnly = renderToStaticMarkup(React.createElement(EmptyAgendaDateDialog, { date: "2099-01-02", canEdit: false, canAccessClients: false, onClose: () => {} }));
    expect(readOnly).not.toContain("/editar");
    expect(readOnly).not.toContain("/painel/clientes");
  });
  it("keeps existing dates with pending closure navigable and uses neutral styling for group-only dates", () => {
    const indicators = [{ date: "2099-01-04", plannedPeople: 20, groupCount: 1, vehicleCount: 1, counting: false, revenueCents: 0, closed: false, closurePending: true }];
    const html = renderToStaticMarkup(React.createElement(PainelAgendaManager, { ...props, indicators }));
    expect(html).toContain('href="/painel/agenda/2099-01-04?mes=1&amp;ano=2099"');
    expect(html).not.toContain('aria-label="Abrir opções de 04/01/2099"');
    expect(html).toContain("Fechamento pendente");
    expect(getAgendaToneClasses({ type: "escol", status: "abe" }, false)).toContain("bg-white");
  });
  it("hides mutations from non-managers and blocks them while configuration is unavailable", () => {
    const readOnly = renderToStaticMarkup(React.createElement(PainelAgendaManager, { ...props, canEdit: false }));
    expect(readOnly).not.toContain('type="checkbox"');
    expect(readOnly).not.toContain("+ Abrir day use");
    const unavailable = renderToStaticMarkup(React.createElement(PainelAgendaManager, { ...props, operationalDays: null }));
    expect(unavailable).toContain("Programação indisponível");
    expect(unavailable).not.toContain('type="checkbox"');
    expect(unavailable).not.toContain('aria-haspopup="dialog"');
    expect(unavailable).toContain('href="/painel/agenda/2099-01-02?mes=1&amp;ano=2099"');
  });
  it("only marks created day programs without adding past-program noise to the calendar", () => {
    const programStatuses = { "2099-01-02": "uncreated", "2099-01-03": "created", "2099-01-04": "exported", "2099-01-05": "past_created", "2099-01-06": "past_uncreated" } as const;
    const indicators = [2, 3, 4, 5, 6, 7].map(day => ({ date: `2099-01-0${day}`, plannedPeople: 20, groupCount: 1, vehicleCount: 1, counting: false, revenueCents: 0, closed: false, closurePending: false }));
    const html = renderToStaticMarkup(React.createElement(PainelAgendaManager, { ...props, indicators, programStatuses, canAccessProgram: true }));
    expect(html.match(/title="Dia seguinte criado"/g)).toHaveLength(3);
    for (const status of ["A criar", "Já ocorreu", "Programação:", "Programação indisponível"]) expect(html).not.toContain(status);
    const denied = renderToStaticMarkup(React.createElement(PainelAgendaManager, { ...props, programStatuses, canAccessProgram: false }));
    expect(denied).not.toContain("Dia seg.");
    const failed = renderToStaticMarkup(React.createElement(PainelAgendaManager, { ...props, programStatuses: null, canAccessProgram: true }));
    expect(failed).toContain("Programação do dia indisponível");
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
