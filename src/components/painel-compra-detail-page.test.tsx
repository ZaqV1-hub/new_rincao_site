import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PainelCompraDetailPage } from "@/components/painel-compra-detail-page";

vi.mock("@/components/painel-compra-detail-actions", () => ({
  PainelCompraDetailActions: () =>
    React.createElement("div", null, "PainelCompraDetailActions"),
}));

describe("PainelCompraDetailPage", () => {
  it("renderiza os blocos legados de dados, pagamento e vouchers", () => {
    const html = renderToStaticMarkup(
      React.createElement(PainelCompraDetailPage, {
        actorName: "WAGNER",
        actorCpf: "00000000191",
        canManageHistory: true,
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
          vouchers: [
            {
              voucherId: 9001,
              voucherNumber: "ABC-123",
              visitDate: "08/05/2026",
              voucherType: "escol",
              voucherTypeLabel: "Escolar",
              schoolName: "Colegio Rincao",
              className: "7A",
              periodName: "Manha",
              unitValue: "40,00",
              used: "n",
              usedLabel: "Nao",
              usedDate: null,
              usedTime: null,
              schoolTripHref: "/painel/clientes/passeios/2306/alunos",
            },
          ],
        },
      }),
    );

    expect(html).toContain("Dados Compra / Reserva");
    expect(html).toContain("Pagamento");
    expect(html).toContain("ID Pagamento");
    expect(html).toContain("Vouchers");
    expect(html).toContain("Consultar pagamento (Cielo)");
    expect(html).toContain("PainelCompraDetailActions");
    expect(html).toContain("Colegio Rincao");
    expect(html).toContain("/painel/clientes/passeios/2306/alunos");
  });
});
