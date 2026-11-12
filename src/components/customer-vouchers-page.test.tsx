import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { UserVoucher, UserVoucherPurchase } from "@/lib/voucher-contracts";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }) }));
vi.mock("@/components/ingresso-shell", () => ({ IngressoShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
import { VoucherRow } from "./customer-vouchers-page";
const voucher: UserVoucher = { id: 1, type: "norma", typeLabel: "Adulto", number: "123", visitDate: "2099-01-31", useDate: null,
  unitValue: "100.00", used: false, useStatus: "n", agendaType: "padra", schoolName: null, participantName: null,
  sent: false, validFrom: "2099-01-31", validUntil: "2099-02-06", canSelectForVoucher: true, canReschedule: false, expiredForGeneration: false };
function render(changes: Partial<UserVoucher> = {}) {
  const purchase: UserVoucherPurchase = { id: 1, legacyEncodedId: "1", type: "ponli", typeLabel: "Online", purchaseDate: "2099-01-01",
    totalValue: "100.00", status: "conc", statusLabel: "Pago", payment: { provider: "pagseguro", status: 3, statusLabel: "Pago", methodType: 1 },
    unusedVoucherCount: 1, voucherCount: 1, canGenerateVoucher: !changes.deliveryHold, canCancelReservation: false, vouchers: [{ ...voucher, ...changes }] };
  return renderToStaticMarkup(<VoucherRow voucher={purchase.vouchers[0]} purchase={purchase} selectable={!changes.deliveryHold} selected={false} onToggle={() => {}} layout="card" />);
}
describe("customer voucher validity", () => {
  it("shows the sold interval and use on an open day without rescheduling", () => {
    const html = render();
    expect(html).toContain("31/01/2099 a");
    expect(html).toContain("06/02/2099");
    expect(html).toContain("sem reagendamento");
  });
  it("preserves paid status and explains delivery hold without offering another payment", () => {
    const html = render({ deliveryHold: true, canSelectForVoucher: false });
    expect(html).toContain("Pagamento recebido");
    expect(html).toContain("não realize outro pagamento");
    expect(html).not.toContain('type="checkbox"');
  });
  it("does not apply new interval language to legacy vouchers", () => {
    expect(render({ validFrom: null })).not.toContain("sem reagendamento");
  });
});
