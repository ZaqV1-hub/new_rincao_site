import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { PainelBilheteriaReservationPayment } from "./painel-bilheteria-reservation-payment";
import type { PainelBilheteriaPurchaseDetail } from "@/lib/painel-bilheteria";
vi.mock("react", async (original) => ({ ...await original<typeof import("react")>(), useSyncExternalStore: () => true }));
const detail = { purchaseId: 9, cpf: "52998224725", totalValue: "100.00", payableReservation: true, vouchers: [] } as unknown as PainelBilheteriaPurchaseDetail;
it("asks for an explicit cashier and never exposes a payment action without one", () => {
  const html = renderToStaticMarkup(<PainelBilheteriaReservationPayment detail={detail} />);
  expect(html).toContain("Escolher caixa"); expect(html).not.toContain("Confirmar pagamento"); expect(html).toContain("52998224725");
});
it("limits new receipts to the four real methods and shows delivered-value fields", () => {
  const html = renderToStaticMarkup(<PainelBilheteriaReservationPayment detail={detail} periodId={4} />);
  expect(html).toContain("Valor entregue 1"); expect(html).not.toContain("Cheque"); expect(html).not.toContain("Trans. bancária"); expect(html).toContain("Pix"); expect(html).toContain("Confirmar pagamento");
});
it("disables fresh receipts after close while preserving navigation to the same cashier", () => {
  const html = renderToStaticMarkup(<PainelBilheteriaReservationPayment detail={detail} periodId={4} readOnly />);
  expect(html).toContain("fieldset disabled"); expect(html).toContain('href="/painel/caixas/4?tab=reservas"');
});
