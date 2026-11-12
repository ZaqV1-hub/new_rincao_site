import { describe, expect, it } from "vitest";
import { canContinuePayment } from "@/lib/checkout-expiration";

describe("canContinuePayment", () => {
  const purchase = {
    type: "ponli" as const,
    status: "pend",
    checkoutExpiresAt: "2026-10-27T12:00:00.000Z",
  };

  it("permits payment before the 12-hour deadline and blocks it at the deadline", () => {
    expect(canContinuePayment(purchase, Date.parse("2026-10-27T11:59:59.999Z"))).toBe(true);
    expect(canContinuePayment(purchase, Date.parse("2026-10-27T12:00:00.000Z"))).toBe(false);
  });

  it("never reopens a paid purchase or one without a reliable deadline", () => {
    expect(canContinuePayment({ ...purchase, status: "conc" }, 0)).toBe(false);
    expect(canContinuePayment({ ...purchase, checkoutExpiresAt: null }, 0)).toBe(false);
  });
});
