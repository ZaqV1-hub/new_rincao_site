import { describe, expect, it } from "vitest";
import {
  calculateCodindicaTotals,
  CodindicaValidationError,
} from "@/lib/codindica";

describe("codindica", () => {
  it("applies fixed discounts on regular agendas", () => {
    const result = calculateCodindicaTotals({
      code: "ABC123",
      record: {
        codindica: "ABC123",
        stcodindica: "ati",
        validade: "2099-12-31",
        nmrepresentante: "Equipe",
        tpdesconto: "fixo",
        flpromocional: "n",
        vldescnormal: "20.00",
        vldescinfant: "10.00",
        vldescpromonormal: "0.00",
        vldescpromoinfant: "0.00",
        vlvendanormal: "0.00",
        vlvendainfant: "0.00",
        vlcashback: "0.00",
        vlcashbacknormal: "0.00",
        vlcashbackinfant: "0.00",
      },
      parameters: [],
      agendaType: "padra",
      normalUnitPrice: 120,
      childUnitPrice: 80,
      normalQuantity: 2,
      childQuantity: 1,
    });

    expect(result.totalGross).toBe(320);
    expect(result.totalDiscount).toBe(50);
    expect(result.totalPaid).toBe(270);
    expect(result.fixedPriceMode).toBe(false);
  });

  it("uses fixed sale prices in the new rule", () => {
    const result = calculateCodindicaTotals({
      code: "FUNC01",
      record: {
        codindica: "FUNC01",
        stcodindica: "ati",
        validade: "2099-12-31",
        nmrepresentante: "Equipe",
        tpdesconto: "fixo",
        flpromocional: "n",
        vldescnormal: "0.00",
        vldescinfant: "0.00",
        vldescpromonormal: "0.00",
        vldescpromoinfant: "0.00",
        vlvendanormal: "75.00",
        vlvendainfant: "45.00",
        vlcashback: "0.00",
        vlcashbacknormal: "1.00",
        vlcashbackinfant: "1.00",
      },
      parameters: [],
      agendaType: "padra",
      normalUnitPrice: 120,
      childUnitPrice: 80,
      normalQuantity: 1,
      childQuantity: 1,
    });

    expect(result.totalGross).toBe(200);
    expect(result.totalDiscount).toBe(80);
    expect(result.reportedDiscountTotal).toBe(0);
    expect(result.totalPaid).toBe(120);
    expect(result.fixedPriceMode).toBe(true);
  });

  it("blocks promotional agendas when the code does not allow them", () => {
    expect(() =>
      calculateCodindicaTotals({
        code: "PROMO1",
        record: {
          codindica: "PROMO1",
          stcodindica: "ati",
          validade: "2099-12-31",
          nmrepresentante: "Equipe",
          tpdesconto: "fixo",
          flpromocional: "n",
          vldescnormal: "10.00",
          vldescinfant: "10.00",
          vldescpromonormal: "0.00",
          vldescpromoinfant: "0.00",
          vlvendanormal: "0.00",
          vlvendainfant: "0.00",
          vlcashback: "0.00",
          vlcashbacknormal: "0.00",
          vlcashbackinfant: "0.00",
        },
        parameters: [],
        agendaType: "promo",
        normalUnitPrice: 120,
        childUnitPrice: 80,
        normalQuantity: 1,
        childQuantity: 0,
      }),
    ).toThrowError(CodindicaValidationError);
  });
});
