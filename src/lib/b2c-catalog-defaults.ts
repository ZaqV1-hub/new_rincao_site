export type B2cProductType = "passport" | "addon";
export type B2cVoucherType = "norma" | "infan" | "espec" | "isent";

export type B2cProductId =
  | "ingresso-adulto"
  | "ingresso-crianca"
  | "ingresso-isento"
  | (string & {});

export type B2cProduct = {
  id: B2cProductId;
  type: B2cProductType;
  title: string;
  subtitle: string;
  description: string;
  imageSrc: string;
  sitePrice: string;
  boxOfficePrice: string;
  fixedPrice?: string;
  voucherType: B2cVoucherType;
  voucherPrefix: string;
  active: boolean;
  sortOrder?: number;
};

export function getB2cSitePrice(product: Pick<B2cProduct, "sitePrice" | "fixedPrice">) {
  return String(product.sitePrice || product.fixedPrice || "0.00");
}

export function getB2cBoxOfficePrice(
  product: Pick<B2cProduct, "sitePrice" | "boxOfficePrice" | "fixedPrice">,
) {
  return String(product.boxOfficePrice || product.sitePrice || product.fixedPrice || "0.00");
}

export const DEFAULT_B2C_PRODUCTS: B2cProduct[] = [
  {
    id: "ingresso-adulto",
    type: "passport",
    title: "Adulto",
    subtitle: "Ingresso adulto",
    description: "Ingresso adulto para a data selecionada.",
    imageSrc: "/theme/clube-park-rincao.jpg",
    sitePrice: "100.00",
    boxOfficePrice: "100.00",
    fixedPrice: "100.00",
    voucherType: "norma",
    voucherPrefix: "A",
    active: true,
    sortOrder: 1,
  },
  {
    id: "ingresso-crianca",
    type: "passport",
    title: "Criança",
    subtitle: "Ingresso infantil",
    description: "Ingresso infantil para a data selecionada.",
    imageSrc: "/theme/clube-park-rincao.jpg",
    sitePrice: "70.00",
    boxOfficePrice: "70.00",
    fixedPrice: "70.00",
    voucherType: "infan",
    voucherPrefix: "C",
    active: true,
    sortOrder: 2,
  },
  {
    id: "ingresso-isento",
    type: "passport",
    title: "Isento",
    subtitle: "Entrada sem cobrança",
    description: "Ingresso isento para a data selecionada.",
    imageSrc: "/theme/clube-park-rincao.jpg",
    sitePrice: "0.00",
    boxOfficePrice: "0.00",
    fixedPrice: "0.00",
    voucherType: "isent",
    voucherPrefix: "I",
    active: true,
    sortOrder: 3,
  },
];
