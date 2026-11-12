import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import Page from "./page";
import { BilheteriaCashClosurePage } from "@/components/bilheteria-cash-closure-page";
const mocks = vi.hoisted(() => ({ access: vi.fn(), report: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock("@/lib/painel-session", () => ({ requirePainelAccess: mocks.access }));
vi.mock("@/lib/bilheteria-cash-data", () => ({ getBilheteriaCashClosureReport: mocks.report }));
vi.mock("@/lib/ops-cash-management", () => ({ asOperationalCashError: (error: { code?: string }) => error }));
beforeEach(() => { vi.clearAllMocks(); mocks.access.mockResolvedValue({ authSource: "panel", actorName: "Gestor", actorCpf: null, legacyRoleId: 1 }); });
it("rejects token sessions before historical financial data reads", async () => {
  mocks.access.mockResolvedValue({ authSource: "token" });
  await expect(Page({ searchParams: Promise.resolve({ fechamento_id: "9" }) })).rejects.toThrow("redirect:/painel/login");
  expect(mocks.report).not.toHaveBeenCalled();
});
it.each([
  [{ code: "cash_session_required" }, "Selecione um caixa"],
  [new Error("database unavailable"), "Não foi possível carregar"],
])("renders a real unavailable state without zero report or closing form", async (error, message) => {
  mocks.report.mockRejectedValue(error);
  const tree = await Page({ searchParams: Promise.resolve({}) });
  expect(tree.type).not.toBe(BilheteriaCashClosurePage);
  const html = renderToStaticMarkup(tree);
  expect(html).toContain(message); expect(html).toContain('href="/painel/caixas"');
  expect(html).not.toContain("0.00"); expect(html).not.toContain("<form");
});
it("preserves valid historical closure as read-only and keeps its print link", async () => {
  const report = { period: { openedAt: "2026-11-01", closedAt: "2026-11-02" } };
  mocks.report.mockResolvedValue({ closureId: 9, isHistorical: true, printHref: "/painel/fechamentos/9/imprimir", report });
  const tree = await Page({ searchParams: Promise.resolve({ fechamento_id: "9" }) });
  expect(mocks.report).toHaveBeenCalledWith(9);
  expect(tree.type).toBe(BilheteriaCashClosurePage);
  expect(tree.props).toMatchObject({ closureId: 9, isHistorical: true, report, printHref: "/painel/fechamentos/9/imprimir" });
});
it("does not replace a failed historical lookup with the current period", async () => {
  mocks.report.mockRejectedValue(new Error("historical data unavailable"));
  const tree = await Page({ searchParams: Promise.resolve({ fechamento_id: "9" }) });
  expect(mocks.report).toHaveBeenCalledExactlyOnceWith(9);
  expect(tree.type).not.toBe(BilheteriaCashClosurePage);
});
