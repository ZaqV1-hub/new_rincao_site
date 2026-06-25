import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildCheckoutReturnUrl,
  mapCheckoutStatusPayload,
} from "@/lib/checkout-status";

const mocks = vi.hoisted(() => ({
  getNativeCieloCheckoutStatus: vi.fn(),
  isCieloEcommerceConfigured: vi.fn(),
  reconcilePaymentFromGatewayPayload: vi.fn(),
}));

vi.mock("@/lib/cielo-ecommerce", () => ({
  getNativeCieloCheckoutStatus: mocks.getNativeCieloCheckoutStatus,
  isCieloEcommerceConfigured: mocks.isCieloEcommerceConfigured,
}));

vi.mock("@/lib/payment-reconciliation", async () => {
  const actual = await vi.importActual<typeof import("@/lib/payment-reconciliation")>(
    "@/lib/payment-reconciliation",
  );

  return {
    ...actual,
    reconcilePaymentFromGatewayPayload: mocks.reconcilePaymentFromGatewayPayload,
  };
});

describe("checkout-status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NODE_ENV = "test";
  });

  it("maps paid gateway statuses to confirmed purchases", () => {
    expect(
      mapCheckoutStatusPayload({
        status: "00",
        dados: {
          status: 3,
        },
      }),
    ).toMatchObject({
      ok: true,
      gatewayStatus: 3,
      gatewayStatusLabel: "Pago",
      purchaseStatus: "conc",
    });

    expect(
      mapCheckoutStatusPayload({
        status: "00",
        dados: {
          status: 2,
        },
      }),
    ).toMatchObject({
      ok: true,
      gatewayStatus: 2,
      purchaseStatus: "conc",
    });
  });

  it("maps pending gateway statuses to pending purchases", () => {
    expect(
      mapCheckoutStatusPayload({
        status: "00",
        dados: {
          status: 1,
        },
      }),
    ).toMatchObject({
      ok: true,
      gatewayStatus: 1,
      purchaseStatus: "pend",
    });
  });

  it("maps cancelled gateway statuses to cancelled purchases", () => {
    expect(
      mapCheckoutStatusPayload({
        status: "00",
        dados: {
          status: 7,
        },
      }),
    ).toMatchObject({
      ok: true,
      gatewayStatus: 7,
      purchaseStatus: "canc",
    });
  });

  it("builds the native checkout return URL", () => {
    expect(buildCheckoutReturnUrl(123, "https://example.com")).toBe(
      "https://example.com/checkout/123/retorno",
    );
  });

  it("returns local mock checkout status when Cielo ecommerce is not configured outside production", async () => {
    mocks.isCieloEcommerceConfigured.mockReturnValue(false);
    vi.stubGlobal("fetch", vi.fn());

    const { syncCheckoutStatus } = await import("@/lib/checkout-status");
    const result = await syncCheckoutStatus(
      { id: 456, status: "pend" },
      new URLSearchParams("reference=456"),
    );

    expect(result).toMatchObject({
      status: 200,
      contentType: "application/json; charset=UTF-8",
      body: {
        ok: true,
        mock: true,
        purchaseId: 456,
      },
      mapped: {
        purchaseStatus: "pend",
        gatewayStatus: 1,
      },
      reconciliation: null,
    });
    expect(fetch).not.toHaveBeenCalled();
    expect(mocks.getNativeCieloCheckoutStatus).not.toHaveBeenCalled();
    expect(mocks.reconcilePaymentFromGatewayPayload).not.toHaveBeenCalled();
  });
});
