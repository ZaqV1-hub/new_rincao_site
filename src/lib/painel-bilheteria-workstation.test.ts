import { describe, expect, it } from "vitest";
import {
  getPainelBilheteriaSelectionCapabilities,
  isPainelBilheteriaPurchasePaymentSettled,
  isPainelBilheteriaVoucherVisibleForValidation,
} from "@/lib/painel-bilheteria-validation";

describe("painel-bilheteria-workstation helpers", () => {
  it("treats paid online, reservation and box-office purchases as settled", () => {
    expect(
      isPainelBilheteriaPurchasePaymentSettled({
        purchaseTypeCode: "ponli",
        statusCode: "conc",
        paymentMethodCode: "pgseg",
        paymentStatusCode: 3,
      }),
    ).toBe(true);

    expect(
      isPainelBilheteriaPurchasePaymentSettled({
        purchaseTypeCode: "reser",
        statusCode: "conc",
        paymentMethodCode: "pix",
        paymentStatusCode: null,
      }),
    ).toBe(true);

    expect(
      isPainelBilheteriaPurchasePaymentSettled({
        purchaseTypeCode: "bilhe",
        statusCode: "conc",
        paymentMethodCode: "corte",
        paymentStatusCode: null,
      }),
    ).toBe(true);
  });

  it("treats pending online or unpaid reservations as unsettled", () => {
    expect(
      isPainelBilheteriaPurchasePaymentSettled({
        purchaseTypeCode: "ponli",
        statusCode: "pend",
        paymentMethodCode: "pgseg",
        paymentStatusCode: 2,
      }),
    ).toBe(false);

    expect(
      isPainelBilheteriaPurchasePaymentSettled({
        purchaseTypeCode: "ponli",
        statusCode: "conc",
        paymentMethodCode: "pgseg",
        paymentStatusCode: 2,
      }),
    ).toBe(false);

    expect(
      isPainelBilheteriaPurchasePaymentSettled({
        purchaseTypeCode: "reser",
        statusCode: "conc",
        paymentMethodCode: "N/A",
        paymentStatusCode: null,
      }),
    ).toBe(false);
  });

  it("hides school vouchers and vouchers from unsettled purchases", () => {
    expect(
      isPainelBilheteriaVoucherVisibleForValidation(
        {
          purchaseTypeCode: "ponli",
          statusCode: "conc",
          paymentMethodCode: "pgseg",
          paymentStatusCode: 4,
        },
        {
          voucherTypeCode: "norma",
        },
      ),
    ).toBe(true);

    expect(
      isPainelBilheteriaVoucherVisibleForValidation(
        {
          purchaseTypeCode: "ponli",
          statusCode: "conc",
          paymentMethodCode: "pgseg",
          paymentStatusCode: 4,
        },
        {
          voucherTypeCode: "escol",
        },
      ),
    ).toBe(false);

    expect(
      isPainelBilheteriaVoucherVisibleForValidation(
        {
          purchaseTypeCode: "ponli",
          statusCode: "pend",
          paymentMethodCode: "pgseg",
          paymentStatusCode: 2,
        },
        {
          voucherTypeCode: "norma",
        },
      ),
    ).toBe(false);
  });

  it("enables actions only when the selected vouchers share a compatible status", () => {
    const vouchers = [
      { voucherId: 10, statusCode: "n" },
      { voucherId: 11, statusCode: "s" },
    ];

    expect(getPainelBilheteriaSelectionCapabilities(vouchers, [10])).toEqual({
      selectedCount: 1,
      canValidate: true,
      canUnvalidate: false,
      canPrint: true,
      canWhatsapp: true,
    });

    expect(getPainelBilheteriaSelectionCapabilities(vouchers, [11])).toEqual({
      selectedCount: 1,
      canValidate: false,
      canUnvalidate: true,
      canPrint: false,
      canWhatsapp: false,
    });

    expect(getPainelBilheteriaSelectionCapabilities(vouchers, [10, 11])).toEqual({
      selectedCount: 2,
      canValidate: false,
      canUnvalidate: false,
      canPrint: false,
      canWhatsapp: false,
    });
  });
});
