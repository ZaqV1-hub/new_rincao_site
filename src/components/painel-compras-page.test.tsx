import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PainelComprasPage } from "@/components/painel-compras-page";

describe("PainelComprasPage", () => {
  it("renderiza a lista principal com colunas e sidebar do legado", () => {
    const html = renderToStaticMarkup(
      React.createElement(PainelComprasPage, {
        actorName: "WAGNER",
        actorCpf: "00000000191",
        result: {
          total: 1,
          page: 1,
          perPage: 30,
          totalPages: 1,
          filters: {
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
          items: [
            {
              purchaseId: 551,
              purchaseDate: "06/05/2026",
              paymentDate: "07/05/2026",
              paymentTime: "14:32:11",
              type: "bilhe",
              typeLabel: "Bilheteria",
              status: "conc",
              statusLabel: "Concluida",
              paymentMethodLabel: "PIX",
              paymentLabel: "Bilheteria",
              cpf: "12345678901",
              userName: "DEV",
              totalValue: "80,00",
            },
          ],
        },
      }),
    );

    expect(html).toContain("Lista de compras e reservas");
    expect(html).toContain("Forma de pgto");
    expect(html).toContain("Pagamento");
    expect(html).toContain(">Bilheteria<");
    expect(html).toContain("Limpar filtros");
    expect(html).toContain("Filtrar");
    expect(html).toContain("Bilheteria");
    expect(html).toContain("DEV");
    expect(html).toContain("/ingresso/painel/usuario-site/detalhe/cpf/MTIzNDU2Nzg5MDE=");
    expect(html).toContain("Exportar");
    expect(html).toContain("Atualizacao manual em fase futura");
  });

  it("nao renderiza remover filtros quando nao ha filtros ativos", () => {
    const html = renderToStaticMarkup(
      React.createElement(PainelComprasPage, {
        actorName: "Operador",
        actorCpf: "11111111111",
        result: {
          total: 0,
          page: 1,
          perPage: 30,
          totalPages: 1,
          filters: {
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
          items: [],
        },
      }),
    );

    expect(html).toContain("Nenhuma compra encontrada.");
    expect(html).not.toContain("Limpar filtros");
    expect(html).toContain("Lista de compras e reservas");
    expect(html).toContain("Exportar");
  });
});
