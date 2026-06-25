import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PainelConvenioDetailPage } from "@/components/painel-convenio-detail-page";

describe("PainelConvenioDetailPage", () => {
  it("renderiza os blocos principais do detalhe legado", () => {
    const html = renderToStaticMarkup(
      React.createElement(PainelConvenioDetailPage, {
        agreement: {
          id: 7,
          name: "Convenio Alfa",
          startDate: "01/05/2026",
          endDate: "31/05/2026",
          priceTableId: 5,
          priceTableName: "Tabela Bronze",
          statusCode: "ati",
          statusLabel: "Ativo",
          totalMembers: 5,
          activeMembers: 3,
          inactiveMembers: 2,
          createdAt: "06/05/2026",
        },
      }),
    );

    expect(html).toContain("Convenio Alfa");
    expect(html).toContain("Qtd Conveniados");
    expect(html).toContain("Importar conveniados");
    expect(html).toContain("Tabela de Preco");
  });
});
