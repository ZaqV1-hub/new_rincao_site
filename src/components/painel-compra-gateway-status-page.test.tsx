import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PainelCompraGatewayStatusPage } from "@/components/painel-compra-gateway-status-page";

describe("PainelCompraGatewayStatusPage", () => {
  it("renderiza a consulta de pagamento com a tabela legado", () => {
    const html = renderToStaticMarkup(
      React.createElement(PainelCompraGatewayStatusPage, {
        detail: {
          purchaseId: 551,
          purchaseDate: "06/05/2026",
          type: "ponli",
          typeLabel: "Compra",
          status: "conc",
          statusLabel: "Concluida",
          paymentLabel: "Cielo 3 - Paga",
          paymentMethodLabel: "Cartao de credito",
          paymentDate: "07/05/2026",
          paymentTime: "14:32:11",
          totalValue: "80,00",
          cpf: "12345678901",
          userName: "DEV",
          referralCode: null,
          gatewayPaymentId: "pay-551",
          gatewayStatusCode: "3",
          gatewayStatusLabel: "Paga",
          vouchers: [],
        },
        consult: {
          purchaseId: 551,
          found: true,
          message: "Consulta manual do gateway executada com sucesso.",
          statusCode: 3,
          statusLabel: "Paga",
          paymentMethodType: 1,
          paymentMethodLabel: "Cartao de credito",
          grossAmount: "80,00",
          feeAmount: "0,00",
          netAmount: "80,00",
          paymentDate: "2026-05-07T14:32:11.000Z",
          startedAt: "2026-05-07T14:20:00.000Z",
          finishedAt: "2026-05-07T14:32:11.000Z",
          senderName: "Cliente Teste",
          senderEmail: "cliente@example.com",
          senderPhone: "51 999999999",
        },
      }),
    );

    expect(html).toContain("Consulta pagamento");
    expect(html).toContain("Cielo 3 - Paga");
    expect(html).toContain("Valor total");
    expect(html).toContain("Cliente Teste");
    expect(html).toContain("Voltar");
  });

  it("renderiza o estado legado de dados nao encontrados", () => {
    const html = renderToStaticMarkup(
      React.createElement(PainelCompraGatewayStatusPage, {
        detail: {
          purchaseId: 551,
          purchaseDate: "06/05/2026",
          type: "ponli",
          typeLabel: "Compra",
          status: "pend",
          statusLabel: "Em processamento",
          paymentLabel: "-",
          paymentMethodLabel: "-",
          paymentDate: null,
          paymentTime: null,
          totalValue: "80,00",
          cpf: "12345678901",
          userName: "DEV",
          referralCode: null,
          gatewayPaymentId: null,
          gatewayStatusCode: null,
          gatewayStatusLabel: null,
          vouchers: [],
        },
        consult: {
          purchaseId: 551,
          found: false,
          message: "Dados nao encontrados na Cielo",
          statusCode: null,
          statusLabel: null,
          paymentMethodType: null,
          paymentMethodLabel: null,
          grossAmount: "0,00",
          feeAmount: "0,00",
          netAmount: "0,00",
          paymentDate: null,
          startedAt: null,
          finishedAt: null,
          senderName: null,
          senderEmail: null,
          senderPhone: null,
        },
      }),
    );

    expect(html).toContain("Dados nao encontrados na Cielo");
  });
});
