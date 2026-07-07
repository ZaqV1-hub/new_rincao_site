type PurchaseSettlementInput = {
  purchaseTypeCode: string | null | undefined;
  statusCode: string | null | undefined;
  paymentMethodCode: string | null | undefined;
  paymentStatusCode?: number | null | undefined;
};

type VoucherVisibilityPurchase = PurchaseSettlementInput;

type VoucherVisibilityItem = {
  voucherTypeCode: string | null | undefined;
};

type SelectionVoucher = {
  voucherId: number;
  statusCode: string | null | undefined;
};

export function isPainelBilheteriaPurchasePaymentSettled(
  input: PurchaseSettlementInput,
) {
  const purchaseTypeCode = String(input.purchaseTypeCode ?? "").trim().toLowerCase();
  const statusCode = String(input.statusCode ?? "").trim().toLowerCase();
  const paymentMethodCode = String(input.paymentMethodCode ?? "").trim().toLowerCase();
  const paymentStatusCode = Number(input.paymentStatusCode ?? 0);

  if (statusCode !== "conc") {
    return false;
  }

  if (purchaseTypeCode === "ponli") {
    return paymentStatusCode === 3 || paymentStatusCode === 4;
  }

  if (purchaseTypeCode === "reser") {
    return paymentMethodCode !== "" && paymentMethodCode !== "n/a";
  }

  return true;
}

export function isPainelBilheteriaVoucherVisibleForValidation(
  purchase: VoucherVisibilityPurchase,
  voucher: VoucherVisibilityItem,
) {
  const voucherTypeCode = String(voucher.voucherTypeCode ?? "").trim().toLowerCase();

  if (voucherTypeCode === "escol") {
    return false;
  }

  return isPainelBilheteriaPurchasePaymentSettled(purchase);
}

export function getPainelBilheteriaSelectionCapabilities(
  vouchers: SelectionVoucher[],
  selectedVoucherIds: number[],
) {
  const selectedIds = [...new Set(selectedVoucherIds.filter((voucherId) => voucherId > 0))];

  if (selectedIds.length === 0) {
    return {
      selectedCount: 0,
      canValidate: false,
      canUnvalidate: false,
      canPrint: false,
      canWhatsapp: false,
    };
  }

  const selectedVouchers = selectedIds
    .map((voucherId) => vouchers.find((voucher) => voucher.voucherId === voucherId) ?? null)
    .filter((voucher): voucher is SelectionVoucher => voucher !== null);

  if (selectedVouchers.length !== selectedIds.length) {
    return {
      selectedCount: selectedVouchers.length,
      canValidate: false,
      canUnvalidate: false,
      canPrint: false,
      canWhatsapp: false,
    };
  }

  const allUnused = selectedVouchers.every(
    (voucher) => String(voucher.statusCode ?? "").trim().toLowerCase() === "n",
  );
  const allUsed = selectedVouchers.every(
    (voucher) => String(voucher.statusCode ?? "").trim().toLowerCase() === "s",
  );

  return {
    selectedCount: selectedVouchers.length,
    canValidate: allUnused,
    canUnvalidate: allUsed,
    canPrint: allUnused,
    canWhatsapp: allUnused,
  };
}
