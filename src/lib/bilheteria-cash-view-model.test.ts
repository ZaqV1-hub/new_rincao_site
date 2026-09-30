import { describe, expect, it } from "vitest";
import { buildBilheteriaCashClosureReportModel } from "@/lib/bilheteria-cash-view-model";

describe("bilheteria-cash-view-model", () => {
  it("uses the same allocated purchase payments in the summary and discount details", () => {
    const model = buildBilheteriaCashClosureReportModel({
      period: { openedAt: null, closedAt: null },
      siteRows: [],
      boxOfficeRows: [{ voucherType: "Adulto", quantity: 2, totalValue: 70 }],
      discountGroups: [
        {
          label: "Descontos - Convenio - Parceiro",
          rows: [{ voucherType: "Adulto", quantity: 1, totalValue: 30 }],
          paymentRows: [
            { method: "dinhe", value: 10 },
            { method: "pix", value: 20 },
          ],
        },
      ],
      courtesyRows: [],
      funds: [],
      sangrias: [],
      forms: { pix: 50, dinhe: 20 },
      formsDesc: { pix: 20, dinhe: 10 },
      totalFund: 0,
      totalSangria: 0,
      cashInDrawer: 30,
    });

    expect(model.discountPanels[0].paymentRows).toEqual([
      { label: "Dinheiro", method: "dinhe", value: 10 },
      { label: "Pix", method: "pix", value: 20 },
    ]);
    expect(model.summaryPaymentRows).toEqual([
      { label: "Dinheiro", method: "dinhe", value: 30 },
      { label: "Pix", method: "pix", value: 70 },
    ]);
    expect(model.kpis.billing.boxOffice).toBe(100);
  });

  it("normalizes and consolidates equivalent ticket labels", () => {
    const model = buildBilheteriaCashClosureReportModel({
      period: { openedAt: null, closedAt: null },
      siteRows: [
        { voucherType: "Adulto", quantity: 2, totalValue: 100 },
        { voucherType: "Ingresso padrão", voucherTypeCode: "norma", quantity: 3, totalValue: 150 },
        { voucherType: "Criança", quantity: 1, totalValue: 20 },
        { voucherType: "Ingresso infantil", voucherTypeCode: "infan", quantity: 4, totalValue: 80 },
        { voucherType: "Isento", quantity: 1, totalValue: 0 },
        { voucherType: "Isenção cadastrada", voucherTypeCode: "isent", quantity: 2, totalValue: 0 },
      ],
      boxOfficeRows: [],
      discountGroups: [],
      courtesyRows: [],
      funds: [],
      sangrias: [],
      forms: {},
      formsDesc: {},
      totalFund: 0,
      totalSangria: 0,
      cashInDrawer: 0,
    });

    expect(model.siteRows).toEqual([
      { quantity: 5, totalValue: 250, voucherType: "adulto", voucherTypeLabel: "Adulto", paymentMethod: null },
      { quantity: 5, totalValue: 100, voucherType: "crianca", voucherTypeLabel: "Criança", paymentMethod: null },
      { quantity: 3, totalValue: 0, voucherType: "isento", voucherTypeLabel: "Isento", paymentMethod: null },
    ]);
  });

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
        quantity: 2,
        totalValue: 50,
        voucherType: "adulto",
        voucherTypeLabel: "Adulto",
      },
      {
        quantity: 1,
        totalValue: 20,
        voucherType: "crianca",
        voucherTypeLabel: "Criança",
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
            voucherType: "crianca",
            voucherTypeLabel: "Criança",
          },
        ],
      },
    ]);
  });
});
