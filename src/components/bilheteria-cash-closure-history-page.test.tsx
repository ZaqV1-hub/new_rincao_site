import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BilheteriaCashClosureHistoryPage } from "@/components/bilheteria-cash-closure-history-page";

const history = {
  items: [
    {
      id: 44,
      periodId: 12,
      openedAt: "2026-05-05 08:00:00+00",
      closedAt: "2026-05-05 18:00:00+00",
      operator: "Gestor Teste",
      totals: {
        cash: "100.00",
        fund: "50.00",
        overall: "150.00",
      },
    },
  ],
  page: 1,
  total: 1,
  totalPages: 1,
};

describe("BilheteriaCashClosureHistoryPage", () => {
  it("matches the legacy closure history surface", () => {
    const html = renderToStaticMarkup(
      React.createElement(BilheteriaCashClosureHistoryPage, {
        actorName: "Gestor Teste",
        history,
      }),
    );

    expect(html).toContain("HISTORICO DE FECHAMENTOS");
    expect(html).toContain("Data do fechamento");
    expect(html).toContain("Acoes");
    expect(html).toContain("Visualizar");
    expect(html).not.toContain("Operador");
    expect(html).not.toContain("Totais");
    expect(html).not.toContain("Imprimir");
  });

  it("renders the legacy empty state", () => {
    const html = renderToStaticMarkup(
      React.createElement(BilheteriaCashClosureHistoryPage, {
        actorName: "Gestor Teste",
        history: {
          ...history,
          items: [],
          total: 0,
        },
      }),
    );

    expect(html).toContain("- Nenhum fechamento encontrado -");
  });
});
