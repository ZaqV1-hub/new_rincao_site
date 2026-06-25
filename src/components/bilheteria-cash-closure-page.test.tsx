import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BilheteriaCashClosurePage } from "@/components/bilheteria-cash-closure-page";
import { buildBilheteriaCashClosureReportModel } from "@/lib/bilheteria-cash-view-model";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

const report = buildBilheteriaCashClosureReportModel({
  period: {
    openedAt: "2026-05-05 08:00:00+00",
    closedAt: "2026-05-05 18:00:00+00",
  },
  siteRows: [],
  boxOfficeRows: [],
  discountGroups: [],
  courtesyRows: [],
  funds: [],
  sangrias: [],
  forms: {},
  formsDesc: {},
  totalFund: 0,
  totalSangria: 0,
  cashInDrawer: 0,
});

describe("BilheteriaCashClosurePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the open-period closure workspace with tabs and manager links", () => {
    const html = renderToStaticMarkup(
      React.createElement(BilheteriaCashClosurePage, {
        actorCpf: "52998224725",
        actorName: "Gestor Teste",
        closureId: null,
        isHistorical: false,
        isManager: true,
        printHref: "/painel/fechamentos/imprimir",
        report,
      }),
    );

    expect(html).toContain("FECHAMENTO DE CAIXA");
    expect(html).toContain("Resumo");
    expect(html).toContain("Detalhado");
    expect(html).toContain("Imprimir fechamento");
    expect(html).toContain("FECHAR CAIXA");
    expect(html).toContain("Ver historico de fechamentos");
    expect(html).toContain("Ver edicoes");
  });

  it("renders the historical variant without the close action", () => {
    const html = renderToStaticMarkup(
      React.createElement(BilheteriaCashClosurePage, {
        actorCpf: "52998224725",
        actorName: "Gestor Teste",
        closureId: 44,
        isHistorical: true,
        isManager: true,
        printHref: "/painel/fechamentos/44/imprimir",
        report,
      }),
    );

    expect(html).toContain("Visualizacao de um fechamento ja concluido.");
    expect(html).toContain("Voltar");
    expect(html).not.toContain("FECHAR CAIXA");
  });
});
