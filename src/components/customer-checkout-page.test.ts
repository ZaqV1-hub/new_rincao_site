import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CustomerCheckoutPage } from "@/components/customer-checkout-page";

vi.mock("@/components/ingresso-shell", () => ({
  IngressoShell: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
    replace: vi.fn(),
  }),
}));

describe("CustomerCheckoutPage", () => {
  it("renders local mock payment actions when running in mock mode", () => {
    const html = renderToStaticMarkup(
      React.createElement(CustomerCheckoutPage, {
        mode: "mock",
        user: {
          cpfMasked: "***.982.247-**",
          name: "Cliente Teste",
          email: "cliente@example.com",
        },
        customer: {
          name: "Cliente Teste",
          email: "cliente@example.com",
          cpf: "52998224725",
          phone: null,
        },
        purchase: {
          id: 456,
          legacyEncodedId: "encoded-456",
          type: "ponli",
          typeLabel: "Compra online",
          purchaseDate: null,
          status: "pend",
          statusLabel: "Aguardando pagamento",
          totalValue: "129.90",
          payment: {
            provider: "pagseguro",
            status: 1,
            statusLabel: "Aguardando pagamento",
            methodType: null,
          },
          unusedVoucherCount: 2,
          voucherCount: 2,
          canGenerateVoucher: false,
          canCancelReservation: false,
          vouchers: [],
        },
        returnUrl: "https://example.com/checkout/456/retorno",
        threeDsEnabled: false,
      }),
    );

    expect(html).toContain("Checkout de Pagamento - Estância");
    expect(html).toContain("Escolha a forma de pagamento");
    expect(html).toContain("Continuar pagamento");
    expect(html).toContain("Pix");
    expect(html).toContain("Cartão de Crédito");
    expect(html).toContain("Cartão de Débito");
  });

  it("still shows unavailable state when checkout is blocked entirely", () => {
    const html = renderToStaticMarkup(
      React.createElement(CustomerCheckoutPage, {
        mode: "unavailable",
        user: {
          cpfMasked: "***.982.247-**",
          name: "Cliente Teste",
          email: "cliente@example.com",
        },
        customer: {
          name: "Cliente Teste",
          email: "cliente@example.com",
          cpf: "52998224725",
          phone: null,
        },
        purchase: {
          id: 456,
          legacyEncodedId: "encoded-456",
          type: "ponli",
          typeLabel: "Compra online",
          purchaseDate: null,
          status: "pend",
          statusLabel: "Aguardando pagamento",
          totalValue: "129.90",
          payment: {
            provider: "pagseguro",
            status: 1,
            statusLabel: "Aguardando pagamento",
            methodType: null,
          },
          unusedVoucherCount: 2,
          voucherCount: 2,
          canGenerateVoucher: false,
          canCancelReservation: false,
          vouchers: [],
        },
        returnUrl: "https://example.com/checkout/456/retorno",
        threeDsEnabled: false,
      }),
    );

    expect(html).toContain("Checkout indisponível");
    expect(html).toContain("pagamento não está disponível");
  });
});
