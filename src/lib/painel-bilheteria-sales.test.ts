import { describe, expect, it } from "vitest";
import { cashInputCents, discountedCashUnitCents, previewCashPayments, saleCommandPayload, saleDraftStorageKey, type PainelBilheteriaSaleDraft } from "./painel-bilheteria-sales";
describe("cash sale draft and payment preview", () => {
  it("uses integer cents and validates Brazilian separators and fractional precision", () => {
    expect(cashInputCents("R$ 1.234,56")).toBe(123456); expect(cashInputCents("0.01")).toBe(1);
    for (const invalid of ["1.23,45", "0.001", "-1", "1e2", "", "NaN"]) expect(cashInputCents(invalid)).toBeNull();
    expect(previewCashPayments(30, [{ method: "pix", value: "0.10" }, { method: "credi", value: "0.20" }])).toMatchObject({ ok: true, receivedCents: 30, changeCents: 0 });
  });
  it("calculates mixed-payment change from cash actually delivered", () => {
    expect(previewCashPayments(10000, [{ method: "pix", value: "40" }, { method: "dinhe", value: "100" }])).toMatchObject({ ok: true, receivedCents: 14000, changeCents: 4000 });
    expect(previewCashPayments(10000, [{ method: "pix", value: "110" }]).ok).toBe(false);
    expect(previewCashPayments(10000, [{ method: "pix", value: "110" }, { method: "dinhe", value: "5" }]).ok).toBe(false);
    expect(previewCashPayments(0, [])).toMatchObject({ ok: true, changeCents: 0 });
    for (const method of ["chequ", "tranb", ""]) expect(previewCashPayments(100, [{ method, value: "1" }]).ok).toBe(false);
  });
  it("matches payable-unit rounding and keeps service payload free of discounts", () => {
    expect(discountedCashUnitCents(1, 5000, "percentual")).toBe(1);
    expect(discountedCashUnitCents(101, 5000, "percentual")).toBe(51);
    expect(discountedCashUnitCents(100, 500, "valor_fixo")).toBe(0);
    const draft: PainelBilheteriaSaleDraft = { agendaLabel: "Hoje", discountValue: "0.00", subtotalValue: "20.00", totalValue: "20.00", createdAt: "2099-01-01T12:00:00Z", periodId: 9, agendaId: 1, cpf: "52998224725", items: [], courtesies: [], services: [{ serviceId: 7, quantity: 2, label: "Armário", unitValue: "10.00", totalValue: "20.00" }], reason: "Venda" };
    expect(saleCommandPayload(draft, [])).toEqual({ periodId: 9, agendaId: 1, cpf: draft.cpf, items: [], courtesies: [], services: [{ serviceId: 7, quantity: 2 }], payments: [], reason: "Venda" });
    expect(saleDraftStorageKey(1)).not.toBe(saleDraftStorageKey(2));
  });
});
