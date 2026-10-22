// Taxas administrativas observadas nas vendas da API E-commerce Cielo do
// estabelecimento entre maio e outubro de 2026. A antecipação é opcional e
// não integra o preço informado ao comprador.
export const CIELO_INSTALLMENT_RATES_BPS: Record<string, number> = {
  Visa: 230,
  Mastercard: 230,
  Elo: 330,
  Amex: 330,
};

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
  if (!Number.isInteger(installments) || installments < 1 || installments > 3 ||
      installments > Math.max(1, Math.floor(baseCents / 10000))) {
    throw new Error("invalid_installments");
  }
  const rateBps = installments === 1 ? 0 : CIELO_INSTALLMENT_RATES_BPS[canonicalBrand];
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
  };
}
