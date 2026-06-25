import { describe, expect, it } from "vitest";
import { buildBilheteriaCashClosureReportModel } from "@/lib/bilheteria-cash-view-model";
import { buildCashClosurePrintModel } from "@/lib/ops-cash-print";

describe("ops-cash-print", () => {
  it("builds printable model from closure detail and cash report", () => {
    const report = buildBilheteriaCashClosureReportModel({
      period: {
        openedAt: "2026-04-23 08:00:00+00",
        closedAt: "2026-04-23 18:00:00+00",
      },
      siteRows: [
        { quantity: 3, totalValue: 120, voucherType: "norma" },
      ],
      boxOfficeRows: [
        { quantity: 4, totalValue: 200, voucherType: "norma" },
      ],
      discountGroups: [
        {
          label: "Descontos - Escola",
          rows: [
            {
              paymentMethod: "pix",
              quantity: 2,
              totalValue: 40,
              voucherType: "escol",
            },
          ],
        },
      ],
      courtesyRows: [
        { authorizedBy: "Gestor", identification: "Convidado", quantity: 1 },
      ],
      funds: [
        {
          createdAt: "2026-04-23 09:00:00+00",
          id: 12,
          responsible: "Tesouraria",
          type: "fundo",
          value: "50.00",
        },
      ],
      sangrias: [
        {
          createdAt: "2026-04-23 12:00:00+00",
          id: 13,
          responsible: "Gerencia",
          type: "sangria",
          value: "20.00",
        },
      ],
      forms: {
        credi: 80,
        debit: 120,
        dinhe: 200,
      },
      formsDesc: {
        pix: 40,
      },
      totalFund: 50,
      totalSangria: 20,
      cashInDrawer: 230,
    });

    expect(
      buildCashClosurePrintModel(
        {
          id: 44,
          periodId: 7,
          openedAt: "2026-04-23 08:00:00+00",
          closedAt: "2026-04-23 18:00:00+00",
          operator: "Gestor Teste",
          createdAt: "2026-04-23 18:00:00+00",
        },
        report,
      ),
    ).toMatchObject({
      closureId: 44,
      periodId: 7,
      operator: "Gestor Teste",
      openedAt: "2026-04-23 08:00:00+00",
      closedAt: "2026-04-23 18:00:00+00",
      createdAt: "2026-04-23 18:00:00+00",
      report: {
        boxOfficeBaseCount: 4,
        boxOfficeCount: 6,
        boxOfficePaymentRows: [
          { method: "dinhe", value: 200 },
          { method: "debit", value: 120 },
          { method: "credi", value: 80 },
        ],
        courtesyCount: 1,
        discountPanels: [
          expect.objectContaining({
            label: "Escola",
            quantity: 2,
          }),
        ],
        kpis: {
          billing: {
            total: 560,
          },
          people: {
            total: 10,
          },
        },
      },
    });
  });
});
