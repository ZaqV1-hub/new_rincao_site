import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BilheteriaCashFundPage } from "@/components/bilheteria-cash-fund-page";

const summary = {
  period: {
    id: 7,
    openedAt: "2026-05-05 08:00:00+00",
    closedAt: null,
    closureSheetId: null,
    operator: null,
  },
  funds: [
    {
      id: 12,
      type: "fundo" as const,
      responsible: "Tesouraria",
      value: "50.00",
      createdAt: "2026-05-05 08:10:00+00",
    },
  ],
  sangrias: [
    {
      id: 13,
      type: "sangria" as const,
      responsible: "Gerencia",
      value: "20.00",
      createdAt: "2026-05-05 17:10:00+00",
    },
  ],
  totals: {
    cashSales: "100.00",
    fund: "50.00",
    sangria: "20.00",
    cashInDrawer: "130.00",
  },
};

describe("BilheteriaCashFundPage", () => {
  it("renders the legacy fund surface with manager actions", () => {
    const html = renderToStaticMarkup(
      React.createElement(BilheteriaCashFundPage, {
        actorCpf: "52998224725",
        actorName: "Gestor Teste",
        isManager: true,
        summary,
      }),
    );

    expect(html).toContain("FUNDO DE CAIXA");
    expect(html).toContain("Dinheiro do Fundo de Caixa");
    expect(html).toContain("Dinheiro total no caixa");
    expect(html).toContain("FAZER FUNDO DE CAIXA");
    expect(html).toContain("FAZER SANGRIA");
    expect(html).toContain("Editar lancamento");
    expect(html).toContain("Excluir lancamento");
  });

  it("hides manager-only row actions for operators", () => {
    const html = renderToStaticMarkup(
      React.createElement(BilheteriaCashFundPage, {
        actorCpf: "52998224725",
        actorName: "Operador Teste",
        isManager: false,
        summary,
      }),
    );

    expect(html).not.toContain("Editar lancamento");
    expect(html).not.toContain("Excluir lancamento");
  });
});
