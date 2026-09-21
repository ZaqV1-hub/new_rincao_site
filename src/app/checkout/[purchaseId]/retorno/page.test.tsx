import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedCustomer: vi.fn(),
  getUserVoucherPurchaseById: vi.fn(),
  getVoucherPurchaseByIdForPaymentReturn: vi.fn(),
  notFound: vi.fn(),
  syncCheckoutStatus: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
}));

vi.mock("@/components/ingresso-shell", () => ({
  IngressoShell: ({ children }: { children: React.ReactNode }) => (
    <main>{children}</main>
  ),
}));

vi.mock("@/lib/customer-area", () => ({
  getAuthenticatedCustomer: mocks.getAuthenticatedCustomer,
}));

vi.mock("@/lib/checkout-status", () => ({
  syncCheckoutStatus: mocks.syncCheckoutStatus,
}));

vi.mock("@/lib/voucher-repository", () => ({
  getUserVoucherPurchaseById: mocks.getUserVoucherPurchaseById,
  getVoucherPurchaseByIdForPaymentReturn:
    mocks.getVoucherPurchaseByIdForPaymentReturn,
}));

const purchase = {
  id: 189741,
  legacyEncodedId: "MTg5NzQx",
  type: "ponli",
  typeLabel: "Compra",
  purchaseDate: "2026-09-21",
  totalValue: "0.50",
  status: "conc",
  statusLabel: "Pago",
  payment: {
    provider: "pagseguro",
    status: 3,
    statusLabel: "Paga",
    methodType: 1,
  },
  unusedVoucherCount: 1,
  voucherCount: 1,
  canGenerateVoucher: true,
  canCancelReservation: false,
  vouchers: [],
};

const successfulSync = {
  mapped: {
    ok: true,
    gatewayStatus: 3,
    gatewayStatusLabel: "Pago",
    purchaseStatus: "conc",
    raw: null,
  },
};

async function renderReturnPage() {
  const page = (await import("@/app/checkout/[purchaseId]/retorno/page"))
    .default;
  const element = await page({
    params: Promise.resolve({ purchaseId: "189741" }),
    searchParams: Promise.resolve({ payment_id: "cielo-payment-id" }),
  });

  return renderToStaticMarkup(
    React.createElement(React.Fragment, null, element),
  );
}

describe("checkout payment return page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.notFound.mockImplementation(() => {
      throw new Error("NEXT_NOT_FOUND");
    });
    mocks.syncCheckoutStatus.mockResolvedValue(successfulSync);
  });

  it("renders the authenticated customer's purchase", async () => {
    mocks.getAuthenticatedCustomer.mockResolvedValue({
      cpf: "52998224725",
      name: "Cliente",
    });
    mocks.getUserVoucherPurchaseById.mockResolvedValue(purchase);

    const html = await renderReturnPage();

    expect(html).toContain("Compra realizada com sucesso");
    expect(html).toContain("Pedido #189741");
    expect(mocks.getVoucherPurchaseByIdForPaymentReturn).not.toHaveBeenCalled();
  });

  it("recovers the return when the session lookup misses a Cielo-verified purchase", async () => {
    mocks.getAuthenticatedCustomer.mockResolvedValue({
      cpf: "52998224725",
      name: "Cliente",
    });
    mocks.getUserVoucherPurchaseById.mockResolvedValue(null);
    mocks.getVoucherPurchaseByIdForPaymentReturn.mockResolvedValue(purchase);

    const html = await renderReturnPage();

    expect(mocks.syncCheckoutStatus).toHaveBeenCalledWith(
      { id: 189741, status: "pend" },
      expect.any(URLSearchParams),
    );
    expect(mocks.getVoucherPurchaseByIdForPaymentReturn).toHaveBeenCalledWith(
      189741,
    );
    expect(html).toContain("Compra realizada com sucesso");
  });

  it("does not load a purchase without ownership when Cielo cannot verify it", async () => {
    mocks.getAuthenticatedCustomer.mockResolvedValue(null);
    mocks.syncCheckoutStatus.mockResolvedValue({
      mapped: {
        ...successfulSync.mapped,
        ok: false,
      },
    });

    await expect(renderReturnPage()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.getVoucherPurchaseByIdForPaymentReturn).not.toHaveBeenCalled();
  });
});
