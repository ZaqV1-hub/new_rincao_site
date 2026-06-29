import {
  DEFAULT_B2C_PRODUCTS,
  type B2cProduct,
} from "@/lib/b2c-catalog-defaults";

type StandardTicketPricing = {
  siteNormal: string | null | undefined;
  siteChild: string | null | undefined;
  gateNormal?: string | null | undefined;
  gateChild?: string | null | undefined;
};

const STANDARD_TICKET_LABELS = {
  "ingresso-adulto": {
    title: "Adulto",
    subtitle: "Ingresso adulto",
    description: "Ingresso adulto para a data selecionada.",
    voucherType: "norma",
    voucherPrefix: "A",
  },
  "ingresso-crianca": {
    title: "Criança",
    subtitle: "Ingresso infantil",
    description: "Ingresso infantil para a data selecionada.",
    voucherType: "infan",
    voucherPrefix: "C",
  },
  "ingresso-isento": {
    title: "Isento",
    subtitle: "Entrada sem cobrança",
    description: "Ingresso isento para a data selecionada.",
    voucherType: "isent",
    voucherPrefix: "I",
  },
} as const;

function normalizePrice(value: string | null | undefined, fallback: string) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return numeric.toFixed(2);
}

export function buildStandardTicketProducts(
  pricing: StandardTicketPricing,
  availableIds?: string[],
) {
  const allowedIds = new Set(
    availableIds?.length
      ? availableIds
      : ["ingresso-adulto", "ingresso-crianca", "ingresso-isento"],
  );

  const defaultsById = new Map(
    DEFAULT_B2C_PRODUCTS.map((product) => [product.id, product]),
  );

  const adultBase = defaultsById.get("ingresso-adulto") as B2cProduct;
  const childBase = defaultsById.get("ingresso-crianca") as B2cProduct;
  const exemptBase = defaultsById.get("ingresso-isento") as B2cProduct;

  const products: B2cProduct[] = [
    {
      ...adultBase,
      ...STANDARD_TICKET_LABELS["ingresso-adulto"],
      sitePrice: normalizePrice(pricing.siteNormal, adultBase.sitePrice),
      boxOfficePrice: normalizePrice(
        pricing.gateNormal ?? pricing.siteNormal,
        adultBase.boxOfficePrice,
      ),
      fixedPrice: normalizePrice(
        pricing.siteNormal,
        adultBase.fixedPrice ?? adultBase.sitePrice,
      ),
    },
    {
      ...childBase,
      ...STANDARD_TICKET_LABELS["ingresso-crianca"],
      sitePrice: normalizePrice(pricing.siteChild, childBase.sitePrice),
      boxOfficePrice: normalizePrice(
        pricing.gateChild ?? pricing.siteChild,
        childBase.boxOfficePrice,
      ),
      fixedPrice: normalizePrice(
        pricing.siteChild,
        childBase.fixedPrice ?? childBase.sitePrice,
      ),
    },
    {
      ...exemptBase,
      ...STANDARD_TICKET_LABELS["ingresso-isento"],
      sitePrice: "0.00",
      boxOfficePrice: "0.00",
      fixedPrice: "0.00",
    },
  ];

  return products.filter((product) => allowedIds.has(product.id));
}
