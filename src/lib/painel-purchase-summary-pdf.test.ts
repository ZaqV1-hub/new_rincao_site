import { describe, expect, it } from "vitest";
import { renderPainelPurchaseSummaryPdf } from "@/lib/painel-purchase-summary-pdf";
import type { PainelPurchaseDetail } from "@/lib/painel-compras";

const detail: PainelPurchaseDetail = {
  purchaseId: 190505,
  purchaseDate: "25/09/2026",
  type: "ponli",
  typeLabel: "Compra",
  status: "conc",
  statusLabel: "Concluída",
  paymentLabel: "Cielo 3 - Paga",
  paymentMethodLabel: "PIX",
  paymentDate: "25/09/2026",
  paymentTime: "14:59:50",
  totalValue: "70,00",
  cpf: "237.875.948-76",
  userName: "Thalia Alves da Silva",
  referralCode: null,
  gatewayPaymentId: "2707be66-2d59-4a3a-9f20-77a5b42f03b6",
  gatewayStatusCode: "3",
  gatewayStatusLabel: "Paga",
  vouchers: [
    {
      voucherId: 607112,
      voucherNumber: "A2ZZY",
      visitDate: "26/09/2026",
      voucherType: "norma",
      voucherTypeLabel: "Adulto",
      schoolName: null,
      className: null,
      periodName: null,
      unitValue: "70,00",
      used: "n",
      usedLabel: "Não",
      usedDate: null,
      usedTime: null,
      schoolTripHref: null,
    },
  ],
};

describe("painel purchase summary PDF", () => {
  it("renders a one-page PDF with the purchase summary", async () => {
    const pdf = await renderPainelPurchaseSummaryPdf(detail);
    const source = Buffer.from(pdf).toString("latin1");

    expect(source.startsWith("%PDF-")).toBe(true);
    expect(source.match(/\/Type\s*\/Page\b/g)).toHaveLength(1);
  });
});
