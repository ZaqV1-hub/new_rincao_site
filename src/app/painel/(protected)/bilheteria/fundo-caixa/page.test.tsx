import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import Page from "./page";
import { BilheteriaCashFundPage } from "@/components/bilheteria-cash-fund-page";
const mocks = vi.hoisted(() => ({ access: vi.fn(), summary: vi.fn(), agenda: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock("@/lib/painel-session", () => ({ requirePainelAccess: mocks.access }));
vi.mock("@/lib/bilheteria-cash-data", () => ({ getBilheteriaCashFundSummary: mocks.summary }));
vi.mock("@/lib/bilheteria-agenda", () => ({ getBilheteriaAgendaStatusToday: mocks.agenda }));
vi.mock("@/lib/ops-cash-management", () => ({ asOperationalCashError: (error: { code?: string }) => error }));
beforeEach(() => { vi.clearAllMocks(); mocks.access.mockResolvedValue({ authSource: "panel", actorName: "Gestor", actorCpf: null, legacyRoleId: 1 }); mocks.agenda.mockResolvedValue({ hasOpenAgendaToday: true }); });
it("rejects token sessions before cash or agenda reads", async () => {
  mocks.access.mockResolvedValue({ authSource: "token" });
  await expect(Page()).rejects.toThrow("redirect:/painel/login");
  expect(mocks.summary).not.toHaveBeenCalled(); expect(mocks.agenda).not.toHaveBeenCalled();
});
it.each([
  [{ code: "cash_session_required" }, "Selecione um caixa"],
  [new Error("database unavailable"), "Não foi possível carregar"],
])("renders a real unavailable state without fabricated zero balance or mutation form", async (error, message) => {
  mocks.summary.mockRejectedValue(error);
  const tree = await Page();
  expect(tree.type).not.toBe(BilheteriaCashFundPage);
  const html = renderToStaticMarkup(tree);
  expect(html).toContain(message); expect(html).toContain('href="/painel/caixas"');
  expect(html).not.toContain("0.00"); expect(html).not.toContain("<form");
});
it("preserves an existing legacy summary unchanged", async () => {
  const summary = { period: { id: 7 }, funds: [], sangrias: [], totals: { cashInDrawer: "123.45" } };
  mocks.summary.mockResolvedValue(summary);
  const tree = await Page();
  expect(tree.type).toBe(BilheteriaCashFundPage);
  expect(tree.props.summary).toBe(summary);
  expect(mocks.access).toHaveBeenCalledWith("vis_bilhet", "/painel/bilheteria/fundo-caixa");
});
