import { beforeEach, expect, it, vi } from "vitest";
import CashSessionsPage from "./page";
import CashSessionPage from "./[periodId]/page";
import CashSessionPrintPage from "@/app/painel/(print)/caixas/[periodId]/imprimir/page";
const mocks = vi.hoisted(() => ({ access: vi.fn(), list: vi.fn(), detail: vi.fn(), locations: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); }, notFound: () => { throw new Error("notFound"); } }));
vi.mock("@/lib/painel-session", () => ({ requirePainelAccess: mocks.access }));
vi.mock("@/lib/operational-cash-session", () => ({ listCashSessions: mocks.list, getCashSession: mocks.detail, CashSessionError: class extends Error {} }));
vi.mock("@/lib/painel-cash-locations", () => ({ listPainelCashLocations: mocks.locations }));
vi.mock("@/lib/operational-date", async (original) => ({ ...await original<typeof import("@/lib/operational-date")>(), getSaoPauloToday: () => "2026-11-12" }));
beforeEach(() => { vi.clearAllMocks(); mocks.access.mockResolvedValue({ authSource: "panel", legacyRoleId: 3 }); mocks.list.mockResolvedValue([]); mocks.locations.mockResolvedValue([]); });
it("requires a panel session for listing, detail and printable financial data before reading the database", async () => {
  mocks.access.mockResolvedValue({ authSource: "token" });
  await expect(CashSessionsPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("redirect:/painel/login");
  await expect(CashSessionPage({ params: Promise.resolve({ periodId: "1" }), searchParams: Promise.resolve({}) })).rejects.toThrow("redirect:/painel/login");
  await expect(CashSessionPrintPage({ params: Promise.resolve({ periodId: "1" }) })).rejects.toThrow("redirect:/painel/login");
  expect(mocks.access.mock.calls.every(([permission]) => permission === "vis_bilhet")).toBe(true);
  expect(mocks.list).not.toHaveBeenCalled(); expect(mocks.detail).not.toHaveBeenCalled(); expect(mocks.locations).not.toHaveBeenCalled();
});
it("rejects invalid civil dates and identities before querying financial data", async () => {
  await expect(CashSessionsPage({ searchParams: Promise.resolve({ date: "2026-02-30" }) })).rejects.toThrow("notFound");
  await expect(CashSessionPage({ params: Promise.resolve({ periodId: "1e2" }), searchParams: Promise.resolve({}) })).rejects.toThrow("notFound");
  expect(mocks.list).not.toHaveBeenCalled(); expect(mocks.detail).not.toHaveBeenCalled();
});
it("lists the requested date without opening a session", async () => {
  const page = await CashSessionsPage({ searchParams: Promise.resolve({ date: "2026-11-11" }) });
  expect(mocks.list).toHaveBeenCalledWith("2026-11-11"); expect(page.props).toMatchObject({ date: "2026-11-11", today: "2026-11-12", sessions: [], locations: [] });
});
