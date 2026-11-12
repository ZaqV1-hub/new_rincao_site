import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { PainelBilheteriaPurchaseDetail } from "./painel-bilheteria-purchase-detail";
import type { PainelBilheteriaPurchaseDetail as Detail } from "@/lib/painel-bilheteria";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/components/painel-bilheteria-reservation-payment", () => ({ PainelBilheteriaReservationPayment: ({ periodId, readOnly }: { periodId?: number; readOnly?: boolean }) => <p>receipt:{periodId}:{String(readOnly)}</p> }));
it("uses the shared reservation receipt flow with the selected period", () => {
  const detail = { purchaseId: 9, cpf: null, totalValue: "100.00", type: "reser", payableReservation: true, vouchers: [], payments: [], discountOptions: [] } as unknown as Detail;
  const html = renderToStaticMarkup(<PainelBilheteriaPurchaseDetail detail={detail} actorName="Operador" actorCpf={null} returnHref="/painel/caixas/4?tab=reservas" periodId={4} readOnly mode="reservation" canManageHistory={false} paymentOptions={[]} />);
  expect(html).toContain("receipt:4:true"); expect(html).not.toContain("Distribua o valor da reserva");
});
