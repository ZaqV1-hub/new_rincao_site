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

    expect(html).toContain("Lista de compras / reservas");
    expect(html).toContain("Forma Pag.");
    expect(html).toContain("Pagamento");
    expect(html).toContain(">Compra<");
    expect(html).toContain("Remover Filtros");
    expect(html).toContain("Filtrar");
    expect(html).toContain("Bilheteria");
    expect(html).toContain("DEV");
    expect(html).toContain("/ingresso/painel/usuario-site/detalhe/cpf/MTIzNDU2Nzg5MDE=");
    expect(html).toContain("Lista de vouchers");
    expect(html).toContain("Disponivel na proxima fase da migracao.");
    expect(html).toContain("Atualizar compras");
    expect(html).toContain("Acao liberada junto da fase de sincronizacao.");
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
    expect(html).not.toContain("Remover Filtros");
    expect(html).toContain("Lista de vouchers");
    expect(html).not.toContain("Atualizar compras");
  });
});
