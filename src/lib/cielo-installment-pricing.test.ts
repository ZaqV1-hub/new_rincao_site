import { describe, expect, it } from "vitest";
import { quoteCieloInstallments } from "./cielo-installment-pricing";

describe("Cielo installment pricing", () => {
  it.each(["Visa", "Mastercard", "Master"])("quotes each installment count for %s", (brand) => {
    const expected = [36998, 37494, 38019, 38547, 39089];
    expected.forEach((chargedCents, index) => {
      expect(quoteCieloInstallments("350.00", index + 2, brand).chargedCents).toBe(chargedCents);
    });
  });

  it.each(["Elo", "Amex", "AmericanExpress"])("quotes each installment count for %s", (brand) => {
    const expected = [37394, 37900, 38437, 38976, 39531];
    expected.forEach((chargedCents, index) => {
      expect(quoteCieloInstallments("350.00", index + 2, brand).chargedCents).toBe(chargedCents);
    });
  });

  it("reports the actual increase over the base, including cent rounding", () => {
    expect(quoteCieloInstallments("350.00", 2, "Visa")).toMatchObject({
      baseCents: 35000, chargedCents: 36998, feeCents: 1998,
      rateBps: 540, surchargePercent: 5.71,
    });
    expect(quoteCieloInstallments("350.00", 6, "Visa").surchargePercent).toBe(11.68);
  });

  it("keeps one installment unchanged and rejects unsupported installments", () => {
    expect(quoteCieloInstallments("350.00", 1, "Diners").chargedCents).toBe(35000);
    for (const brand of ["Diners", "Hipercard", "Banescard", "Agiplan", "unknown"]) {
      expect(() => quoteCieloInstallments("350.00", 2, brand)).toThrow("unsupported_installment_brand");
    }
    expect(() => quoteCieloInstallments("199.99", 2, "Visa")).toThrow("invalid_installments");
    expect(() => quoteCieloInstallments("350.00", 7, "Visa")).toThrow("invalid_installments");
    expect(() => quoteCieloInstallments("350.00", 2.5, "Visa")).toThrow("invalid_installments");
  });

  it.each(["0", "-1", "NaN"])("rejects an invalid purchase amount %s", (amount) => {
    expect(() => quoteCieloInstallments(amount, 2, "Visa")).toThrow("invalid_purchase_amount");
  });
});
