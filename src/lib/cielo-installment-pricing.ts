// Taxas totais por parcela confirmadas para a afiliação E-commerce em
// 12/11/2026 (Vendeu, Tá na Conta). Não somar antecipação novamente.
export const CIELO_INSTALLMENT_RATES_BPS: Record<string, Record<number, number>> = {
  Visa: { 2: 540, 3: 665, 4: 794, 5: 920, 6: 1046 },
  Mastercard: { 2: 540, 3: 665, 4: 794, 5: 920, 6: 1046 },
  Elo: { 2: 640, 3: 765, 4: 894, 5: 1020, 6: 1146 },
  Amex: { 2: 640, 3: 765, 4: 894, 5: 1020, 6: 1146 },
};

export function getMaxCieloInstallments(amountCents: number) {
  return amountCents >= 20_000 ? 6 : 1;
}

export function quoteCieloInstallments(
  baseAmount: string | number,
  installments: number,
  brand: string,
) {
  const canonicalBrand = ({
    visa: "Visa",
    master: "Mastercard",
    mastercard: "Mastercard",
    elo: "Elo",
    amex: "Amex",
    americanexpress: "Amex",
  } as Record<string, string>)[brand.replace(/[^a-z]/gi, "").toLowerCase()] ?? brand;
  const baseCents = Math.round(Number(baseAmount) * 100);
  if (!Number.isSafeInteger(baseCents) || baseCents <= 0) {
    throw new Error("invalid_purchase_amount");
  }
  if (!Number.isInteger(installments) || installments < 1 ||
      installments > getMaxCieloInstallments(baseCents)) {
    throw new Error("invalid_installments");
  }
  const rateBps = installments === 1 ? 0 : CIELO_INSTALLMENT_RATES_BPS[canonicalBrand]?.[installments];
  if (rateBps === undefined) {
    throw new Error("unsupported_installment_brand");
  }
  // A taxa é descontada do total cobrado. Arredondar para cima mantém o
  // valor líquido da compra sem cobrar menos que o anunciado.
  const chargedCents = Math.ceil(baseCents * 10000 / (10000 - rateBps));
  return {
    baseCents,
    chargedCents,
    feeCents: chargedCents - baseCents,
    installments,
    brand: canonicalBrand,
    rateBps,
    surchargePercent: Math.round((chargedCents - baseCents) * 10000 / baseCents) / 100,
  };
}
