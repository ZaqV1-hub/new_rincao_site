import { expect, it, vi } from "vitest";
import Page from "./page";
const redirect = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/painel-bilheteria-page", () => ({ requirePainelBilheteriaHistorySession: async () => ({}), loadPainelBilheteriaPurchaseDetailFromParams: async () => ({ detail: { purchaseId: 7 } }), readPainelBilheteriaFlashState: () => ({ flashSuccess: null, flashWarnings: [] }) }));
it("preserves explicit cashier context in the history redirect", async () => {
  await Page({ params: Promise.resolve({ purchaseId: "7" }), searchParams: Promise.resolve({ periodId: "4" }) });
  expect(redirect).toHaveBeenLastCalledWith("/painel/bilheteria/historico?purchase=7&periodId=4");
});
