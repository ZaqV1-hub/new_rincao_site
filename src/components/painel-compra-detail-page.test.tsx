import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PainelCompraDetailPage } from "@/components/painel-compra-detail-page";
import type { PainelPurchaseDetail } from "@/lib/painel-compras";

vi.mock("@/components/painel-compra-detail-actions", () => ({
  PainelCompraDetailActions: () =>
    React.createElement("div", null, "PainelCompraDetailActions"),
}));

describe("PainelCompraDetailPage", () => {
  it.each([
    { snapshot: "2026-05-12", expected: "12/05/2026" },
    { snapshot: null, expected: "Não informado" },
    { snapshot: undefined, expected: "08/05/2026" },
  ])("uses the snapshot visit date ($snapshot), with legacy fallback only when missing", ({ snapshot, expected }) => {
    const detail = {
      purchaseId: 1, purchaseDate: null, type: "bilhe", typeLabel: "Bilheteria", status: "conc", statusLabel: "Concluída",
      paymentLabel: "Pix", paymentMethodLabel: "Pix", paymentDate: null, paymentTime: null, totalValue: "10,00",
      cpf: null, userName: null, referralCode: null, gatewayPaymentId: null, gatewayStatusCode: null, gatewayStatusLabel: null,
      vouchers: [{ voucherId: 10, voucherNumber: "A10", visitDate: "08/05/2026", voucherType: "norma", voucherTypeLabel: "Adulto",
        schoolName: null, studentName: null, className: null, periodName: null, unitValue: "10,00", used: "n", usedLabel: "Não", usedDate: null, usedTime: null, schoolTripHref: null }],
      ...(snapshot === undefined ? {} : { operational: { park: "rincao", purchasedOn: null, totalCents: 1000, origin: null,
        customerCpf: null, payments: [], history: [], vouchers: [{ purchaseId: 1, voucherId: 10, agendaId: 2, schoolId: null, serviceId: null,
          visitDate: snapshot, validFrom: null, validUntil: null, validityMode: "legacy", unitAmountCents: 1000, validation: null }] } }),
    } as PainelPurchaseDetail; // Also exercises a response created before the operational DTO existed.
    const html = renderToStaticMarkup(<PainelCompraDetailPage detail={detail} actorName={null} actorCpf={null} />);
    expect(html).toContain(`>${expected}</td>`);
    if (snapshot !== undefined) expect(html).not.toContain(">08/05/2026</td>");
  });
  it("renderiza os blocos legados de dados, pagamento e vouchers", () => {
    const html = renderToStaticMarkup(
      React.createElement(PainelCompraDetailPage, {
        actorName: "WAGNER",
        actorCpf: "00000000191",
        canAccessCustomer: true,
        canAccessSchool: true,
        returnContext: { date: "2026-05-08", page: 2, filters: { origin: "site", type: "group", query: "Ana" } },
        detail: {
          operational: { park: "rincao", purchasedOn: "2026-05-06", totalCents: 8000, origin: "ponli", customerCpf: "12345678901", payments: [{ id: 1, method: "pix", amountCents: 3000, periodId: 4, receivedAt: "2026-05-07T17:32:11Z" }, { id: 2, method: "dinhe", amountCents: 5000, periodId: 4, receivedAt: "2026-05-07T17:32:11Z" }], history: [{ id: 1, occurredAt: "2026-05-07T17:32:11Z", action: "receipt", description: "Recebimento registrado", reason: "Conferência", actorName: "Operador" }], vouchers: [{ purchaseId: 551, voucherId: 9001, agendaId: 1, schoolId: 2306, serviceId: null, visitDate: "2026-05-08", validFrom: "2026-05-08", validUntil: "2026-05-14", validityMode: "operational", unitAmountCents: 4000, validation: null }] },
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
              studentName: "Ana Souza",
              className: "7A",
              periodName: "Manha",
              unitValue: "40,00",
              used: "n",
              usedLabel: "Nao",
              usedDate: null,
              usedTime: null,
              schoolTripHref: "/painel/clientes/detalhe?id=2306",
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
    expect(html).toContain("Ana Souza");
    expect(html).not.toContain("Período");
    expect(html).toContain("/painel/clientes/detalhe?id=2306");
    expect(html).toContain('/painel/usuario-site/12345678901');
    expect(html).toContain("08/05/2026 até 14/05/2026");
    expect(html).toContain("Recebimentos registrados");
    expect(html).toContain("30,00"); expect(html).toContain("50,00");
    expect(html).toContain("Histórico da compra"); expect(html).toContain("Recebimento registrado");
    expect(html).toContain("Voltar às compras da data");
    expect(html).toContain("tab=compras&amp;page=2&amp;origin=site&amp;type=group&amp;query=Ana");
  });
});
