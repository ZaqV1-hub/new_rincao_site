import { describe, expect, it } from "vitest";
import { buildBilheteriaCashClosureReportModel } from "@/lib/bilheteria-cash-view-model";

describe("bilheteria-cash-view-model", () => {
  it("builds closure KPIs, grouped discounts and merged payment summaries", () => {
    const model = buildBilheteriaCashClosureReportModel({
      period: {
        openedAt: "2026-05-05 08:00:00+00",
        closedAt: "2026-05-05 18:00:00+00",
      },
      siteRows: [
        {
          voucherType: "norma",
          quantity: 4,
          totalValue: 120,
        },
      ],
      boxOfficeRows: [
        {
          voucherType: "norma",
          quantity: 2,
          totalValue: 50,
        },
      ],
      discountGroups: [
        {
          label: "Descontos - Convenio - Parceiro",
          rows: [
            {
              voucherType: "infan",
              quantity: 1,
              totalValue: 20,
              paymentMethod: "pix",
            },
          ],
        },
      ],
      courtesyRows: [
        {
          authorizedBy: "Bilheteria",
          identification: "Convidado A",
          quantity: 2,
        },
        {
          authorizedBy: "Bilheteria",
          identification: "Convidado B",
          quantity: 1,
        },
      ],
      funds: [
        {
          id: 10,
          responsible: "Tesouraria",
          value: "30.00",
          createdAt: "2026-05-05 08:05:00+00",
          type: "fundo",
        },
      ],
      sangrias: [
        {
          id: 11,
          responsible: "Gerencia",
          value: "10.00",
          createdAt: "2026-05-05 17:10:00+00",
          type: "sangria",
        },
      ],
      forms: {
        dinhe: 50,
        debit: 15,
      },
      formsDesc: {
        dinhe: 10,
        pix: 20,
      },
      totalFund: 30,
      totalSangria: 10,
      cashInDrawer: 80,
    });

    expect(model.kpis.people).toEqual({
      siteValidatedCount: 4,
      boxOfficeCount: 3,
      courtesyCount: 3,
      total: 10,
    });
    expect(model.kpis.billing.total).toBe(215);
    expect(model.kpis.billing.site).toBe(120);
    expect(model.kpis.billing.boxOffice).toBe(95);
    expect(model.kpis.cashInDrawer).toBe(80);
    expect(model.kpis.averageTicket).toBe(21.5);
    expect(model.summaryPaymentRows).toEqual([
      { label: "Dinheiro", method: "dinhe", value: 60 },
      { label: "Debito", method: "debit", value: 15 },
      { label: "Pix", method: "pix", value: 20 },
    ]);
    expect(model.courtesySummaryRows).toEqual([
      {
        authorizedBy: "Bilheteria",
        quantity: 3,
      },
    ]);
    expect(model.boxOfficeSummaryRows).toEqual([
      {
        quantity: 1,
        totalValue: 20,
        voucherType: "infan",
        voucherTypeLabel: "infan",
      },
      {
        quantity: 2,
        totalValue: 50,
        voucherType: "norma",
        voucherTypeLabel: "norma",
      },
    ]);
    expect(model.discountPanels).toEqual([
      {
        label: "Convenio - Parceiro",
        quantity: 1,
        totalValue: 20,
        paymentRows: [{ label: "Pix", method: "pix", value: 20 }],
        rows: [
          {
            paymentMethod: "pix",
            quantity: 1,
            totalValue: 20,
            voucherType: "infan",
            voucherTypeLabel: "infan",
          },
        ],
      },
    ]);
  });
});
