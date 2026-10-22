import type { QueryClient } from "@/lib/payment-reconciliation-contract";

async function ensureQuoteTable(client: QueryClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS checkout_installment_quotes (
      id BIGSERIAL PRIMARY KEY,
      idcompra INTEGER NOT NULL,
      base_amount NUMERIC(15,2) NOT NULL,
      charged_amount NUMERIC(15,2) NOT NULL,
      fee_amount NUMERIC(15,2) NOT NULL,
      installments INTEGER NOT NULL,
      card_brand VARCHAR(32) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS checkout_installment_quotes_purchase_idx
      ON checkout_installment_quotes (idcompra, charged_amount, installments)
  `);
}

export async function saveCheckoutInstallmentQuote(
  client: QueryClient,
  quote: {
    purchaseId: number;
    baseCents: number;
    chargedCents: number;
    feeCents: number;
    installments: number;
    brand: string;
  },
) {
  if (quote.feeCents === 0) return;
  await ensureQuoteTable(client);
  await client.query(
    `INSERT INTO checkout_installment_quotes
      (idcompra, base_amount, charged_amount, fee_amount, installments, card_brand)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [quote.purchaseId, quote.baseCents / 100, quote.chargedCents / 100,
      quote.feeCents / 100, quote.installments, quote.brand],
  );
}

export async function checkoutAmountMatches(
  client: QueryClient,
  purchaseId: number,
  baseAmount: number,
  paidAmount: number,
  installmentCount: number,
) {
  if (Math.abs(Math.round(baseAmount * 100) - Math.round(paidAmount * 100)) <= 1) {
    return true;
  }
  try {
    const result = await client.query(
      `SELECT 1 FROM checkout_installment_quotes
       WHERE idcompra = $1 AND base_amount = $2 AND charged_amount = $3
         AND installments = $4 LIMIT 1`,
      [purchaseId, baseAmount.toFixed(2), paidAmount.toFixed(2), installmentCount],
    );
    return Boolean(result.rowCount);
  } catch (error) {
    if ((error as { code?: string }).code === "42P01") return false;
    throw error;
  }
}
