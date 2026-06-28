import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildB2cCartSummary,
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
        description: "Ingresso adulto para a data selecionada.",
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
        description: "Ingresso infantil para a data selecionada.",
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
        description: "Ingresso isento para a data selecionada.",
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
