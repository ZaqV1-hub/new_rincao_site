import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PainelCompraVouchersPage } from "@/components/painel-compra-vouchers-page";

describe("PainelCompraVouchersPage", () => {
  it("renderiza indicadores, tabela e filtros da tela legado", () => {
    const html = renderToStaticMarkup(
      React.createElement(PainelCompraVouchersPage, {
        result: {
          items: [
            {
              purchaseId: 551,
              voucherId: 9001,
              voucherNumber: "ABC-123",
              purchaseDate: "06/05/2026",
              visitDate: "08/05/2026",
              ticketTypeLabel: "Passaporte",
              name: "Cliente Teste",
              location: "ponli",
              locationLabel: "SITE",
              unitValue: "40,00",
              purchaseStatusLabel: "Concluida",
              usedLabel: "Nao",
              usedDate: null,
              usedTime: null,
              purchaseTypeLabel: "Compra",
            },
          ],
          total: 1,
          page: 1,
          perPage: 100,
          totalPages: 1,
          filters: {
            voucherId: "9001",
            purchaseDateFrom: "01/05/2026",
            purchaseDateTo: null,
            usedDateFrom: null,
            usedDateTo: null,
            visitDateFrom: null,
            visitDateTo: null,
            voucherType: null,
            purchaseLocation: "site",
            purchaseStatus: null,
            usedStatus: null,
          },
          indicators: {
            qtdnormal_site: 1,
            vlnormal_site: "40,00",
            qtdinfantil_site: 0,
            vlinfantil_site: "0,00",
            qtdnormal_parque: 0,
            vlnormal_parque: "0,00",
            qtdinfantil_parque: 0,
            vlinfantil_parque: "0,00",
            qtdescola: 0,
            vlescola: "0,00",
            qtdadulto_reserva: 0,
            vladulto_reserva: "0,00",
            qtdinfantil_reserva: 0,
            vlinfantil_reserva: "0,00",
            qtespecial: 0,
            vlespecial: "0,00",
            qtdcortesia: 0,
            qtdisento: 0,
            totalCount: 1,
            totalValue: "40,00",
          },
        },
      }),
    );

    expect(html).toContain("Passaporte SITE");
    expect(html).toContain("&gt;</span><span>Vouchers</span>");
    expect(html).toContain("Passaporte</th>");
    expect(html).toContain("ABC-123");
    expect(html).toContain("Passaporte</option>");
    expect(html).toContain("Remover Filtros");
    expect(html).toContain("Exportar (.xls)");
  });
});
