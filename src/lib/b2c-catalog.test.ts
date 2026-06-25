import { describe, expect, it } from "vitest";
import {
  buildB2cCartSummary,
  getB2cProduct,
  listB2cAddons,
  listB2cPassports,
} from "@/lib/b2c-catalog";

describe("b2c catalog", () => {
  it("exposes the Estancia passport and addon catalog", async () => {
    expect((await listB2cPassports()).map((product) => product.id)).toEqual([
      "passaporte-explorador",
      "passaporte-aventura",
      "passaporte-infantil",
    ]);
    expect((await listB2cAddons()).map((product) => product.id)).toEqual([
      "almoco-caipira-buffet",
      "cafe-da-manha",
      "ecobag-algodao",
      "kit-bebidas",
    ]);
    expect((await getB2cProduct("passaporte-explorador"))?.title).toBe(
      "Passaporte Explorador",
    );
  });

  it("calculates cart totals and requires a passport before addons", async () => {
    const summary = await buildB2cCartSummary(
      [
        { productId: "passaporte-explorador", quantity: 2 },
        { productId: "passaporte-infantil", quantity: 1 },
        { productId: "cafe-da-manha", quantity: 3 },
      ],
    );

    expect(summary.totalValue).toBe("345.00");
    expect(summary.voucherCount).toBe(6);
    expect(summary.passportQuantity).toBe(3);
    expect(summary.lines.map((line) => line.description)).toEqual([
      "Passaporte Explorador",
      "Passaporte Infantil",
      "Café da Manhã",
    ]);

    await expect(
      buildB2cCartSummary(
        [{ productId: "cafe-da-manha", quantity: 1 }],
      ),
    ).rejects.toThrow("Selecione pelo menos um passaporte para continuar.");
  });
});
