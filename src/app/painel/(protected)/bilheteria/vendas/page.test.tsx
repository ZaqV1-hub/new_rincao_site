import React from "react";
import { beforeEach, expect, it, vi } from "vitest";
import SalesPage from "./page";
import FinalizePage from "../finalizar/page";
import ReservationPage from "../reservas/[purchaseId]/page";
import PaymentPage from "../pagar-reserva/[purchaseId]/page";
import { PainelBilheteriaSalesBuilder } from "@/components/painel-bilheteria-sales-builder";
import { PainelBilheteriaSaleFinalize } from "@/components/painel-bilheteria-sale-finalize";
import { PainelBilheteriaReservationPayment } from "@/components/painel-bilheteria-reservation-payment";
import { PainelBilheteriaPurchaseDetail } from "@/components/painel-bilheteria-purchase-detail";
const mocks = vi.hoisted(() => ({ cash: vi.fn(), offer: vi.fn(), access: vi.fn(), agendas: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); }, notFound: () => { throw new Error("notFound"); } }));
vi.mock("@/lib/operational-cash-session", () => ({ getCashSession: mocks.cash }));
vi.mock("@/lib/operational-day-offer", () => ({ loadOperationalDayOffer: mocks.offer }));
vi.mock("@/lib/painel-session", () => ({ requirePainelAccess: mocks.access }));
vi.mock("@/lib/bilheteria-agenda", () => ({ getBilheteriaAgendaStatusToday: mocks.agendas }));
vi.mock("@/lib/operational-date", () => ({ getSaoPauloToday: () => "2099-01-01" }));
vi.mock("@/lib/painel-bilheteria", () => ({ getPainelBilheteriaPurchaseDetail: async () => ({ purchaseId: 7, type: "reser" }), getPainelBilheteriaPaymentOptions: () => [] }));
vi.mock("@/lib/painel-bilheteria-page", () => ({ loadPainelBilheteriaPurchaseDetailFromParams: async () => ({ detail: { purchaseId: 7, type: "reser" } }) }));
type Node = React.ReactElement<Record<string, unknown>>;
function find(value: unknown, type: unknown): Node | undefined { if (Array.isArray(value)) return value.map((item) => find(item, type)).find(Boolean); if (!React.isValidElement(value)) return; const node = value as Node; return node.type === type ? node : find(node.props.children, type); }
beforeEach(() => {
  vi.clearAllMocks(); mocks.access.mockResolvedValue({ actorName: "Operador", actorCpf: "52998224725", legacyRoleId: 2 });
  mocks.cash.mockResolvedValue({ id: 4, type: "sales", date: "2099-01-01", closedAt: null });
  mocks.agendas.mockResolvedValue({ today: "2099-01-01", openAgendas: [{ id: 2, status: "lot", date: "2099-01-01", priceTable: {} }] });
  mocks.offer.mockResolvedValue({ products: [{ id: "servico:7", operationalServiceId: 7, boxOfficePrice: "0.00", sitePrice: "" }] });
});
it("requires an explicit session and uses authoritative gate offerings even when online capacity is full", async () => {
  await expect(SalesPage({})).rejects.toThrow("redirect:/painel/caixas"); expect(mocks.cash).not.toHaveBeenCalled();
  const tree = await SalesPage({ searchParams: Promise.resolve({ periodId: "4" }) });
  expect(mocks.access).toHaveBeenCalledWith("vis_bilhet", "/painel/bilheteria/vendas");
  expect(mocks.offer).toHaveBeenCalledWith(expect.objectContaining({ id: 2, status: "lot" }), undefined, "gate");
  expect(find(tree, PainelBilheteriaSalesBuilder)?.props).toMatchObject({ periodId: 4, products: [{ operationalServiceId: 7, boxOfficePrice: "0.00" }] });
});
it.each([{ closedAt: "2099-01-01T20:00Z" }, { date: "2098-12-31" }, { type: "trips" }])("blocks a new cart for unavailable cash %j", async (patch) => {
  mocks.cash.mockResolvedValue({ id: 4, type: "sales", date: "2099-01-01", closedAt: null, ...patch });
  await expect(SalesPage({ searchParams: Promise.resolve({ periodId: "4" }) })).rejects.toThrow("redirect:/painel/caixas/4"); expect(mocks.offer).not.toHaveBeenCalled();
});
it("keeps finalization reachable read-only after close so an uncertain command can replay", async () => {
  mocks.cash.mockResolvedValue({ id: 4, type: "sales", date: "2099-01-01", closedAt: "closed" });
  expect(find(await FinalizePage({ searchParams: Promise.resolve({ periodId: "4" }) }), PainelBilheteriaSaleFinalize)?.props).toMatchObject({ periodId: 4, readOnly: true });
});
it("passes explicit period context through both reservation entry points without choosing one implicitly", async () => {
  const params = Promise.resolve({ purchaseId: "7" });
  expect(find(await ReservationPage({ params }), PainelBilheteriaPurchaseDetail)?.props).toMatchObject({ periodId: undefined, readOnly: true });
  const searchParams = Promise.resolve({ periodId: "4" });
  expect(find(await ReservationPage({ params, searchParams }), PainelBilheteriaPurchaseDetail)?.props).toMatchObject({ periodId: 4, readOnly: false, returnHref: "/painel/caixas/4?tab=reservas" });
  expect(find(await PaymentPage({ params, searchParams }), PainelBilheteriaReservationPayment)?.props).toMatchObject({ periodId: 4, readOnly: false });
});
it("propagates unavailable data instead of fabricating an open cashier", async () => {
  mocks.cash.mockRejectedValue(new Error("database unavailable"));
  await expect(FinalizePage({ searchParams: Promise.resolve({ periodId: "4" }) })).rejects.toThrow("database unavailable"); expect(mocks.offer).not.toHaveBeenCalled();
});
