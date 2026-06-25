import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PainelCompraConvenioPage } from "@/components/painel-compra-convenio-page";

describe("PainelCompraConvenioPage", () => {
  it("renderiza indicadores, tabela e sidebar de filtros", () => {
    const html = renderToStaticMarkup(
      React.createElement(PainelCompraConvenioPage, {
        result: {
          filters: {
            agreementName: "Convenio Alfa",
            voucherNumber: null,
            visitDateFrom: null,
            visitDateTo: null,
            usedDateFrom: null,
            usedDateTo: null,
            voucherType: null,
            purchaseType: null,
            usedStatus: null,
            paymentStatus: null,
            purchaseStatus: null,
            paymentMethodType: null,
          },
          indicators: {
            qtdnormal: 5,
            vlnormal: "250.00",
            qtdinfantil: 2,
            vlinfantil: "60.00",
            qtdisento: 1,
            qtdescola: 3,
            vlescola: "45.00",
            qtdconvenio: 11,
            vlconvenio: "355.00",
            totalCount: 11,
            totalValue: "355,00",
          },
          agreementOptions: [{ name: "Convenio Alfa" }],
          rows: [
            {
              agreementName: "Convenio Alfa",
              adultQuantity: 5,
              adultValue: "250,00",
              childQuantity: 2,
              childValue: "60,00",
              schoolQuantity: 3,
              schoolValue: "45,00",
              exemptQuantity: 1,
              totalQuantity: 11,
              totalValue: "355,00",
            },
          ],
        },
      }),
    );

    expect(html).toContain("Lista de Compras Convenio");
    expect(html).toContain("Exportar (.xls)");
    expect(html).toContain("Tipo de Convenio");
    expect(html).toContain("Convenio Alfa");
  });
});
