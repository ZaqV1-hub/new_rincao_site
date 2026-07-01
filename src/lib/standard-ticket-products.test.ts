import { describe, expect, it } from "vitest";
import { buildStandardTicketProducts } from "@/lib/standard-ticket-products";

describe("buildStandardTicketProducts", () => {
  it("builds the fixed public ticket set Adulto, Criança and Isento", () => {
    const products = buildStandardTicketProducts({
      siteNormal: "80.00",
      siteChild: "60.00",
      gateNormal: "90.00",
      gateChild: "70.00",
    });

    expect(products.map((product) => product.title)).toEqual([
      "Adulto",
      "Criança",
      "Isento",
    ]);
    expect(products.map((product) => product.id)).toEqual([
      "ingresso-adulto",
      "ingresso-crianca",
      "ingresso-isento",
    ]);
  });
});
