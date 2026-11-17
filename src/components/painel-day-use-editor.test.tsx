import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PainelDayUseEditor } from "./painel-day-use-editor";
import type { OperationalDay } from "@/lib/operational-day";

const day: OperationalDay = { date: "2099-01-31", version: null, priceTableId: 1, dayUseAgendaId: null, dayUseOpen: false, validity: "7_days", onlineLimit: 0, ticketTypes: ["norma", "infan", "isent"], serviceIds: [], closed: false };
const props = { day, priceTables: [{ id: 1, label: "Tabela padrão", prices: { siteAdult: "70.00", siteChild: "50.00", gateAdult: "80.00", gateChild: "60.00" } }], services: [], canEdit: true };

describe("PainelDayUseEditor", () => {
  it("shows the selected table prices separately for site and gate with current ages", () => {
    const html = renderToStaticMarkup(<PainelDayUseEditor {...props} />);
    for (const value of ["70,00", "50,00", "80,00", "60,00", "10 anos ou mais", "4 a 9 anos", "0 a 3 anos"]) expect(html).toContain(value);
    expect(html).toContain("Site"); expect(html).toContain("Bilheteria");
    const missing = renderToStaticMarkup(<PainelDayUseEditor {...props} priceTables={[{id:1,label:"Sem preço"}]} />);
    expect(missing).toContain("Não informado");
  });
  it("shows service prices for both channels and distinguishes unavailable site sale from free", () => {
    const services = [{id:1,name:"Almoço",description:"",active:true,version:1,sitePriceCents:2500,gatePriceCents:3000},
      {id:2,name:"Estacionamento",description:"",active:true,version:1,sitePriceCents:null,gatePriceCents:2000}];
    const html=renderToStaticMarkup(<PainelDayUseEditor {...props} services={services} />);
    for(const value of ["25,00","30,00","20,00","não vendido online"]) expect(html).toContain(value);
  });
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
