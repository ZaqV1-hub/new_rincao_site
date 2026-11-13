import { beforeEach, expect, it, vi } from "vitest";
import Page from "./page";

const mocks = vi.hoisted(() => ({ access: vi.fn(), detail: vi.fn() }));
vi.mock("@/lib/painel-session", () => ({ requirePainelAccess: mocks.access }));
vi.mock("@/lib/painel-compras", () => ({ getPainelPurchaseDetail: mocks.detail }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); }, redirect: (url: string) => { throw new Error(`REDIRECT ${url}`); } }));
beforeEach(() => {
  mocks.access.mockReset().mockResolvedValue({ authSource: "panel", legacyRoleId: 1, legacyResources: ["vis_compra"], actorName: "Operador", actorCpf: "52998224725" });
  mocks.detail.mockReset().mockResolvedValue({ purchaseId: 7 });
});

it("requires panel identity before reading a purchase", async () => {
  mocks.access.mockResolvedValue({ authSource: "operations", legacyResources: ["vis_compra"] });
  await expect(Page({ params: Promise.resolve({ purchaseId: "7" }) })).rejects.toThrow("REDIRECT");
  expect(mocks.detail).not.toHaveBeenCalled();
});
it.each(["0", "-1", "1e2", "7x", "9007199254740992"])("rejects malformed ID %s before querying", async (purchaseId) => {
  await expect(Page({ params: Promise.resolve({ purchaseId }) })).rejects.toThrow("NOT_FOUND");
  expect(mocks.detail).not.toHaveBeenCalled();
});
it("preserves structured return context without granting destination permissions by role", async () => {
  const page = await Page({ params: Promise.resolve({ purchaseId: "7" }), searchParams: Promise.resolve({ returnDate: "2026-11-12", returnPage: "3", returnOrigin: "gate", returnType: "dayuse", returnQuery: "Ana & João" }) });
  expect(mocks.access).toHaveBeenCalledWith("vis_compra", "/painel/compras");
  expect(mocks.detail).toHaveBeenCalledWith(7);
  expect(page.props).toMatchObject({ canAccessCustomer: false, canAccessSchool: false, canOperateVouchers: false, returnContext: { date: "2026-11-12", page: 3, filters: { origin: "gate", type: "dayuse", query: "Ana & João" } } });
});
it("grants each action only from its resource and ignores an external return URL", async () => {
  mocks.access.mockResolvedValue({ authSource: "panel", legacyRoleId: 3, legacyResources: ["vis_compra", "vis_situsu", "vis_escola", "vis_bilhet"] });
  const page = await Page({ params: Promise.resolve({ purchaseId: "7" }), searchParams: Promise.resolve({ returnDate: "https://example.com" }) });
  expect(page.props).toMatchObject({ canAccessCustomer: true, canAccessSchool: true, canOperateVouchers: true, returnContext: null });
});
