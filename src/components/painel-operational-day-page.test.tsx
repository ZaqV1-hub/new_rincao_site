import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { OperationalDaySummary, SummarySourceValue, UnavailableSummarySource } from "@/lib/operational-day-summary";
import { PainelOperationalDayPage, DayPurchaseSummary } from "./painel-operational-day-page";

const available = (value: number): SummarySourceValue<number> => ({ status: "available", value, source: "fixture" });
const unavailable: UnavailableSummarySource = { status: "unavailable", value: null, source: "fixture", reason: "Fonte ainda não integrada." };
function summary(): OperationalDaySummary {
  return {
    park: "rincao", date: "2099-01-02", generatedAt: "2099-01-02T12:00:00Z",
    configuration: { date: "2099-01-02", version: 1, priceTableId: 9, dayUseAgendaId: 8, dayUseOpen: true, validity: "day", onlineLimit: 100, ticketTypes: ["norma"], serviceIds: [], closed: false }, configurationRevision: 1,
    navigation: { previousDate: "2098-12-26", nextDate: "2099-01-06" },
    revenue: { basis: "selected_visit_date", siteNetCents: available(0), gateNetCents: available(2500), servicesNetCents: available(500), unclassifiedNetCents: available(1200), knownSubtotalCents: 3000, totalCents: unavailable, finalizedTripsNetCents: unavailable },
    attendance: { basis: "actual_use_date", dayUseAdmitted: available(3), completedVehiclePeople: unavailable, totalAdmitted: unavailable },
    forecast: { ticketsForSelectedDate: available(8), plannedGroupPeople: unavailable },
    groupCount: 2, receipts: unavailable, cash: available(2), expenses: unavailable, closure: unavailable,
    warnings: [{ code: "partial", message: "Subtotal das fontes disponíveis." }],
  };
}
const render = (data = summary(), canManage = true) => renderToStaticMarkup(<PainelOperationalDayPage summary={data} canManage={canManage} />);

describe("operational day summary UI", () => {
  it("distinguishes actual zero from unavailable totals and marks known money partial", () => {
    const html = render();
    expect(html).toMatch(/Ingressos no site<\/dt><dd[^>]*>R\$\s*0,00<\/dd>/);
    expect(html).toMatch(/Faturamento total do dia<\/dt><dd[^>]*>Indisponível<\/dd>/);
    expect(html).toContain("Subtotal conhecido · parcial");
    expect(html).toContain("30,00");
    expect(html).toContain('style="width:100%"');
    expect(html).toContain('style="width:20%"');
    expect(html).toContain("Valores sem classificação, fora do subtotal");
    expect(html).toContain("Day use: entradas reais no parque");
    expect(html).toContain("Não representam recebimentos do dia nem saldo em caixa");
  });
  it("keeps the four metrics prominent without changing their data sources", () => {
    const data = summary();
    data.forecast.plannedGroupPeople = available(12);
    data.attendance.completedVehiclePeople = available(7);
    data.revenue.totalCents = available(3000);
    data.closure = available(0);
    const html = render(data);
    expect(html).toMatch(/Pessoas previstas<\/dt><dd[^>]*text-\[32px\][^>]*>20<\/dd>/);
    expect(html).toMatch(/Já no parque<\/dt><dd[^>]*text-\[32px\][^>]*>10<\/dd>/);
    expect(html).toMatch(/Faturamento do dia<\/dt><dd[^>]*text-\[32px\][^>]*>R\$\s*30,00<\/dd>/);
    expect(html).toContain("12 em grupos · 8 de day use");
    expect(html).toContain("7 contadas no app · 3 ingressos lidos");
    expect(html).toContain("Fechamento diário: em aberto.");
    expect(html).not.toContain("Subtotal conhecido · parcial");
    expect(html).toContain("Conferência do faturamento");
    data.closure = available(2);
    expect(render(data)).toContain("Fechamento diário: revisão 2.");
  });
  it("uses only backend movement dates and preserves calendar selection", () => {
    const html = render();
    expect(html).toContain('href="/painel/agenda/2098-12-26"');
    expect(html).toContain('href="/painel/agenda/2099-01-06"');
    expect(html).not.toContain('href="/painel/agenda/2099-01-03"');
    expect(html).toContain('href="/painel/agenda?mes=1&amp;ano=2099&amp;dia=2099-01-02"');
    const data = summary();
    data.navigation = { previousDate: null, nextDate: null };
    expect(render(data)).toContain('disabled="" aria-label="Sem próxima data com movimento"');
  });
  it("keeps ambiguous configuration visible without losing money or inventing a closed day", () => {
    const data = summary();
    data.configuration = null;
    const html = render(data, false);
    expect(html).toContain("Configuração pendente de conferência");
    expect(html).toContain("30,00");
    expect(html).not.toContain("Day use fechado");
    expect(html).not.toContain("Editar day use");
    expect(render()).toContain('href="/painel/agenda/2099-01-02/editar"');
  });
  it.each([
    ["uncreated", "Criar", "A criar"], ["created", "Alterar", "Criado"], ["exported", "Alterar", "Arquivos gerados · envio manual"],
    ["past_created", "Abrir", "Já ocorreu"], ["past_uncreated", "Abrir", "Já ocorreu e não criado"],
  ] as const)("shows %s program status and the appropriate action", (programStatus, action, label) => {
    const html = renderToStaticMarkup(<PainelOperationalDayPage summary={summary()} canManage canAccessProgram programStatus={programStatus} />);
    expect(html).toContain(`${action} dia seguinte`); expect(html).toContain(label);
    expect(html).toContain('href="/painel/agenda/2099-01-02/dia-seguinte?returnTo=2099-01-02"');
    expect(html).toContain("Fechamento diário: indisponível."); expect(html).not.toContain("Dia seguinte, caixas");
  });
  it("shows session counts separately from revenue and links the selected date only with cash permission", () => {
    const html = renderToStaticMarkup(<PainelOperationalDayPage summary={summary()} canManage={false} canAccessCash />);
    expect(html).toContain('href="/painel/caixas?date=2099-01-02"');
    expect(html).toMatch(/Sessões de caixa<\/dt><dd[^>]*>2<\/dd>/);
    expect(html).not.toContain("Caixas e fechamento: integração pendente.");
    expect(render()).not.toContain('href="/painel/caixas');
  });
  it("does not expose program links without permission or imply creation after an error", () => {
    expect(render()).not.toContain("/dia-seguinte");
    const unavailable = renderToStaticMarkup(<PainelOperationalDayPage summary={summary()} canManage canAccessProgram programStatus={null} />);
    expect(unavailable).toContain("Programação do dia indisponível"); expect(unavailable).not.toContain("Criar dia seguinte"); expect(unavailable).toContain("30,00");
    const operator = renderToStaticMarkup(<PainelOperationalDayPage summary={summary()} canManage={false} canAccessProgram programStatus="uncreated" />);
    expect(operator).toContain("Abrir dia seguinte"); expect(operator).not.toContain("Criar dia seguinte");
    const closed = summary(); closed.configuration!.closed = true;
    expect(renderToStaticMarkup(<PainelOperationalDayPage summary={closed} canManage canAccessProgram programStatus="created" />)).toContain("Abrir dia seguinte");
  });
  it("starts on summary with accessible tabs and no eager list requests", () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    try {
      const html = render();
      expect(html).toContain('role="tablist"');
      expect(html).toContain('id="day-tab-resumo" role="tab" type="button" aria-selected="true"');
      expect(html).toContain('role="tabpanel" aria-labelledby="day-tab-resumo"');
      expect(html).toContain("Fechamento do dia");
      expect(fetch).not.toHaveBeenCalled();
    } finally { vi.unstubAllGlobals(); }
  });
});


describe("purchase row operational status", () => {
  const purchase = {purchaseId:1,buyerName:"Cliente",status:"conc",channel:"bilhe",itemCount:3,dateAmountCents:16000,purchaseType:"dayuse" as const,
    peopleCount:2,usedPeopleCount:1,invalidPeopleCount:0,groupPeopleCount:0,refundRequestedCount:0,refundPaidCount:0,rescheduled:true,
    composition:[{label:"Adulto",quantity:1},{label:"Criança",quantity:1},{label:"Estacionamento",quantity:1}]};
  it("shows partial admission and service composition without treating services as people", () => {
    const html=renderToStaticMarkup(<DayPurchaseSummary item={purchase} />);
    for(const expected of ["Day use","2 pessoa(s)","1 de 2 usados","Reagendada","Estacionamento"]) expect(html).toContain(expected);
    expect(html).not.toContain("3 pessoa(s)");
  });
  it("distinguishes registered refunds from absence requests and does not invent attendance", () => {
    const html=renderToStaticMarkup(<DayPurchaseSummary item={{...purchase,purchaseType:'group',groupPeopleCount:2,usedPeopleCount:0,refundRequestedCount:2,refundPaidCount:1}} />);
    expect(html).toContain("2 ausente(s)");expect(html).toContain("1 devolução(ões) registrada(s)");expect(html).not.toContain("Presente");
    expect(renderToStaticMarkup(<DayPurchaseSummary item={{...purchase,purchaseType:'items',peopleCount:0,usedPeopleCount:0}} />)).toContain("Só itens");
  });
});
