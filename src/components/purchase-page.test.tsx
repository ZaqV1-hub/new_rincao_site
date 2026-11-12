import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PurchasePage, buildClientCartSummary, applyPurchasePreviewLines } from "@/components/purchase-page";
import { DEFAULT_B2C_PRODUCTS, type B2cProduct } from "@/lib/b2c-catalog-defaults";
import type { PurchaseAgendaDetail } from "@/lib/purchase-contracts";
vi.mock("@/components/ingresso-shell", () => ({ IngressoShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }), usePathname: () => "/comprar/12" }));
const service: B2cProduct = { id: "servico:17", type: "addon", title: "Armário", subtitle: "Serviço adicional", description: "Guarde seus pertences.", imageSrc: "", sitePrice: "12.50", boxOfficePrice: "15.00", active: true, voucherType: "espec", voucherPrefix: "S", operationalServiceId: 17 };
const props = { agenda: { id: 12, date: "2099-01-31" } as PurchaseAgendaDetail, user: { name: "Cliente", cpfMasked: "***", email: null }, products: [DEFAULT_B2C_PRODUCTS[0], service] };

describe("purchase page date offer", () => {
  it("shows assigned services and the inclusive ticket interval before checkout", () => {
    const html = renderToStaticMarkup(<PurchasePage {...props} validity={{ validFrom: "2099-01-31", validUntil: "2099-02-06" }} />);
    expect(html).toContain("Armário"); expect(html).toContain("Guarde seus pertences.");
    expect(html).toContain("Serviços adicionais");
    expect(html).toContain("31/01/2099"); expect(html).toContain("06/02/2099");
    expect(html).toContain("sem reagendamento"); expect(html).toContain("qualquer dia com day use aberto");
    expect(html).not.toContain("Adicionar Criança"); expect(html).not.toContain("Adicionar Isento");
  });
  it("makes an explicitly empty entrance offer visible instead of restoring default tickets", () => {
    const html = renderToStaticMarkup(<PurchasePage {...props} products={[]} validity={null} />);
    expect(html).toContain("Nenhum ingresso disponível para esta data");
    expect(html).not.toContain("Adicionar Adulto");
  });
  it("does not imply a managed validity for legacy dates", () => {
    const html = renderToStaticMarkup(<PurchasePage {...props} validity={null} />);
    expect(html).not.toContain("sem reagendamento");
  });
  it("counts only passports as entrances, even when selecting extras first", () => {
    expect(buildClientCartSummary(props.products, [{ productId: service.id, quantity: 2 }])).toMatchObject({ ticketQuantity: 0, addonQuantity: 2, totalValue: "25.00" });
    expect(buildClientCartSummary(props.products, [{ productId: service.id, quantity: 2 }, { productId: "ingresso-adulto", quantity: 1 }])).toMatchObject({ ticketQuantity: 1, addonQuantity: 2, totalValue: "125.00" });
  });
  it("uses fresh preview service prices without applying a service discount", () => {
    const cart = buildClientCartSummary(props.products, [{ productId: "ingresso-adulto", quantity: 1 }, { productId: service.id, quantity: 2 }]);
    const lines = applyPurchasePreviewLines(cart.lines, [
      { productId: "ingresso-adulto", unitPrice: "90.00", totalValue: "90.00", adjustmentValue: "-10.00" },
      { productId: service.id, unitPrice: "17.35", totalValue: "34.70", adjustmentValue: "-1.00" },
    ]);
    expect(lines[1]).toMatchObject({ unitPrice: "17.35", totalValue: "34.70", adjustmentValue: "0.00" });
    expect(lines[0].adjustmentValue).toBe("-10.00");
    expect(lines.reduce((sum, line) => sum + Number(line.totalValue), 0).toFixed(2)).toBe("124.70");
  });
  it("shows and enforces the shared 500-unit request limit in the client cart", () => {
    const html = renderToStaticMarkup(<PurchasePage {...props} validity={null} />);
    expect(html).toContain("500 unidades por pedido");
    expect(buildClientCartSummary(props.products, [{ productId: "ingresso-adulto", quantity: 1 }, { productId: service.id, quantity: 499 }])).toMatchObject({ ticketQuantity: 1, addonQuantity: 499 });
    expect(() => buildClientCartSummary(props.products, [{ productId: "ingresso-adulto", quantity: 1 }, { productId: service.id, quantity: 500 }])).toThrow("500 unidades");
    expect(() => buildClientCartSummary(props.products, [{ productId: "ingresso-adulto", quantity: Number.MAX_SAFE_INTEGER + 1 }])).toThrow();
  });

});
