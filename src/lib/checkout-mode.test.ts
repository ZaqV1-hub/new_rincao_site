import { beforeEach, describe, expect, it, vi } from "vitest";

const isCieloEcommerceConfigured = vi.fn();

vi.mock("@/lib/cielo-ecommerce", () => ({
  isCieloEcommerceConfigured,
}));

describe("checkout-mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NODE_ENV = "test";
  });

  it("enables the widget when Cielo ecommerce is configured", async () => {
    isCieloEcommerceConfigured.mockReturnValue(true);

    const { resolveCheckoutMode } = await import("@/lib/checkout-mode");

    expect(resolveCheckoutMode()).toBe("widget");
  });

  it("uses the local mock when Cielo ecommerce is not configured outside production", async () => {
    isCieloEcommerceConfigured.mockReturnValue(false);

    const { resolveCheckoutMode } = await import("@/lib/checkout-mode");

    expect(resolveCheckoutMode()).toBe("mock");
  });

  it("keeps checkout unavailable in production when Cielo ecommerce is not configured", async () => {
    process.env.NODE_ENV = "production";
    isCieloEcommerceConfigured.mockReturnValue(false);

    const { resolveCheckoutMode } = await import("@/lib/checkout-mode");

    expect(resolveCheckoutMode()).toBe("unavailable");
  });
});
