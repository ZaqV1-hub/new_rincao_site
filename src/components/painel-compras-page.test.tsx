import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PainelComprasPage } from "@/components/painel-compras-page";

vi.mock("@/components/painel-compras-page-content", () => ({
  PainelComprasPageContent: (props: unknown) =>
    React.createElement("div", {
      "data-testid": "painel-compras-page-content",
      "data-props": JSON.stringify(props),
    }),
}));

describe("PainelComprasPage", () => {
  it("renderiza cabecalho, exportacao e limpeza quando ha filtros ativos", () => {
    const html = renderToStaticMarkup(
      React.createElement(PainelComprasPage, {
        actorName: "WAGNER",
        actorCpf: "00000000191",
        initialPage: 1,
        initialFilters: {
          purchaseId: null,
          type: "ponli",
          purchaseStatus: null,
          paymentMethod: null,
          ticketPaymentMethod: null,
          gatewayPaymentMethod: null,
          gatewayStatus: "3",
          cpf: "12345678901",
          userName: null,
          dateFrom: "01/05/2026",
          dateTo: null,
        },
      }),
    );

    expect(html).toContain("Lista de compras e reservas");
    expect(html).toContain("Operador: WAGNER");
    expect(html).toContain("Exportar");
    expect(html).toContain("Limpar filtros");
    expect(html).toContain("/api/painel/compras/export?dtcompra%5Bde%5D=01%2F05%2F2026");
    expect(html).toContain("data-testid=\"painel-compras-page-content\"");
  });

  it("nao renderiza remover filtros quando nao ha filtros ativos", () => {
    const html = renderToStaticMarkup(
      React.createElement(PainelComprasPage, {
        actorName: "Operador",
        actorCpf: "11111111111",
        initialPage: 1,
        initialFilters: {
          purchaseId: null,
          type: null,
          purchaseStatus: null,
          paymentMethod: null,
          ticketPaymentMethod: null,
          gatewayPaymentMethod: null,
          gatewayStatus: null,
          cpf: null,
          userName: null,
          dateFrom: null,
          dateTo: null,
        },
      }),
    );

    expect(html).not.toContain("Limpar filtros");
    expect(html).toContain("Lista de compras e reservas");
    expect(html).toContain("Exportar");
  });
});
