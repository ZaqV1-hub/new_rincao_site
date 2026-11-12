import { DEFAULT_B2C_PRODUCTS, type B2cProduct } from "@/lib/b2c-catalog-defaults";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildB2cCartSummary,
  buildB2cCartSummaryForProducts,
  getB2cProduct,
  listB2cAddons,
  listB2cPassports,
} from "@/lib/b2c-catalog";

vi.mock("@/lib/rincao-content-store", () => ({
  getManagedB2cProducts: async (type?: "passport" | "addon") => {
    const products = [
      {
        id: "ingresso-adulto",
        type: "passport",
        title: "Adulto",
        subtitle: "Ingresso adulto",
        description: "A partir de 10 anos.",
        imageSrc: "/theme/clube-park-rincao.jpg",
        sitePrice: "100.00",
        boxOfficePrice: "100.00",
        fixedPrice: "100.00",
        voucherType: "norma",
        voucherPrefix: "A",
        active: true,
      },
      {
        id: "ingresso-crianca",
        type: "passport",
        title: "Criança",
        subtitle: "Ingresso infantil",
        description: "De 4 a 9 anos.",
        imageSrc: "/theme/clube-park-rincao.jpg",
        sitePrice: "70.00",
        boxOfficePrice: "70.00",
        fixedPrice: "70.00",
        voucherType: "infan",
        voucherPrefix: "C",
        active: true,
      },
      {
        id: "ingresso-isento",
        type: "passport",
        title: "Isento",
        subtitle: "Entrada sem cobrança",
        description: "De 0 a 3 anos.",
        imageSrc: "/theme/clube-park-rincao.jpg",
        sitePrice: "0.00",
        boxOfficePrice: "0.00",
        fixedPrice: "0.00",
        voucherType: "isent",
        voucherPrefix: "I",
        active: true,
      },
    ];

    return type ? products.filter((product) => product.type === type) : products;
  },
}));

describe("b2c catalog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exposes the Rincao ticket catalog", async () => {
    expect((await listB2cPassports()).map((product) => product.id)).toEqual([
      "ingresso-adulto",
      "ingresso-crianca",
      "ingresso-isento",
    ]);
    expect((await listB2cAddons()).map((product) => product.id)).toEqual([]);
    expect((await getB2cProduct("ingresso-adulto"))?.title).toBe("Adulto");
    expect((await getB2cProduct("ingresso-adulto"))?.description).toBe(
      "A partir de 10 anos.",
    );
    expect((await getB2cProduct("ingresso-crianca"))?.description).toBe(
      "De 4 a 9 anos.",
    );
    expect((await getB2cProduct("ingresso-isento"))?.description).toBe(
      "De 0 a 3 anos.",
    );
  });

  it("calculates cart totals and requires at least one ticket", async () => {
    const summary = await buildB2cCartSummary([
      { productId: "ingresso-adulto", quantity: 2 },
      { productId: "ingresso-crianca", quantity: 1 },
      { productId: "ingresso-isento", quantity: 3 },
    ]);

    expect(summary.totalValue).toBe("270.00");
    expect(summary.voucherCount).toBe(6);
    expect(summary.ticketQuantity).toBe(6);
    expect(summary.lines.map((line) => line.description)).toEqual([
      "Adulto",
      "Criança",
      "Isento",
    ]);

    await expect(
      buildB2cCartSummary([{ productId: "ingresso-adulto", quantity: 0 }]),
    ).rejects.toThrow("Informe quantidades validas para continuar.");
  });
});

const service: B2cProduct = { id: "servico:17", type: "addon", title: "Armário", subtitle: "Serviço adicional", description: "Uso do armário na data da compra", imageSrc: "", sitePrice: "12.50", boxOfficePrice: "15.00", active: true, voucherType: "espec", voucherPrefix: "S", operationalServiceId: 17 };
describe("operational services in the cart", () => {
  it("counts people separately from services and preserves operational identity", () => {
    const cart = buildB2cCartSummaryForProducts([
      { productId: "ingresso-adulto", quantity: 1 }, { productId: "ingresso-isento", quantity: 2 }, { productId: "servico:17", quantity: 4 },
    ], [...DEFAULT_B2C_PRODUCTS, service]);
    expect(cart).toMatchObject({ ticketQuantity: 3, passportQuantity: 3, addonQuantity: 4, voucherCount: 7, totalValue: "150.00" });
    expect(cart.lines[2]).toMatchObject({ operationalServiceId: 17, type: "addon", unitPrice: "12.50", totalValue: "50.00", voucherType: "espec", voucherPrefix: "S" });
  });
  it("keeps a zero-priced service free while requiring an actual entrance", () => {
    const free = { ...service, sitePrice: "0.00" };
    expect(buildB2cCartSummaryForProducts([{ productId: "ingresso-adulto", quantity: 1 }, { productId: service.id, quantity: 1 }], [...DEFAULT_B2C_PRODUCTS, free]).totalValue).toBe("100.00");
    expect(() => buildB2cCartSummaryForProducts([{ productId: service.id, quantity: 1 }], [service])).toThrow("Selecione pelo menos um ingresso");
  });
  it("refuses inactive products and duplicate IDs before referral pricing can see them", () => {
    expect(() => buildB2cCartSummaryForProducts([{ productId: "ingresso-adulto", quantity: 1 }], [{ ...DEFAULT_B2C_PRODUCTS[0], active: false }])).toThrow("Produto indisponivel");
    expect(() => buildB2cCartSummaryForProducts([{ productId: "ingresso-adulto", quantity: 1 }, { productId: "ingresso-adulto", quantity: 2 }], DEFAULT_B2C_PRODUCTS)).toThrow("Produto repetido");
  });
  it("caps all vouchers at 500 while leaving services out of the people count", () => {
    const free = { ...service, sitePrice: "0.00" };
    const products = [...DEFAULT_B2C_PRODUCTS, free];
    expect(buildB2cCartSummaryForProducts([{ productId: "ingresso-adulto", quantity: 1 }, { productId: free.id, quantity: 499 }], products))
      .toMatchObject({ voucherCount: 500, ticketQuantity: 1, addonQuantity: 499 });
    for (const quantity of [500, 1_000_000]) {
      expect(() => buildB2cCartSummaryForProducts([{ productId: "ingresso-adulto", quantity: 1 }, { productId: free.id, quantity }], products)).toThrow("500 unidades");
    }
  });
  it.each([Number.MAX_SAFE_INTEGER + 1, Infinity, 1.5])("rejects unsafe or nonintegral quantities %s", (quantity) => {
    expect(() => buildB2cCartSummaryForProducts([{ productId: "ingresso-adulto", quantity }], DEFAULT_B2C_PRODUCTS)).toThrow("quantidades validas");
  });
  it("rejects price and total overflow before voucher creation", () => {
    expect(() => buildB2cCartSummaryForProducts([{ productId: "ingresso-adulto", quantity: 1 }], [{ ...DEFAULT_B2C_PRODUCTS[0], sitePrice: "1e308" }])).toThrow();
    expect(() => buildB2cCartSummaryForProducts([{ productId: "ingresso-adulto", quantity: 1 }, { productId: service.id, quantity: 1 }], [{ ...DEFAULT_B2C_PRODUCTS[0], sitePrice: "50000000000000.00" }, { ...service, sitePrice: "50000000000000.00" }])).toThrow();
  });

});
