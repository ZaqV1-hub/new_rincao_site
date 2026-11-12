import { beforeEach, describe, expect, it, vi } from "vitest";
import Page from "./page";
const mocks = vi.hoisted(() => ({ session: {} as Record<string, unknown>, load: vi.fn() }));
vi.mock("@/lib/painel-session", () => ({ requirePainelSession: async () => mocks.session }));
vi.mock("@/lib/painel-home", () => ({ loadPainelHomePageData: mocks.load }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); } }));
beforeEach(() => { mocks.load.mockReset().mockResolvedValue({}); });
describe("panel home agenda entry", () => {
  it("starts an authenticated panel user with agenda permission in the agenda", async () => {
    mocks.session = { authSource: "panel", legacyRoleId: 1, legacyResources: ["vis_agenda"] };
    await expect(Page()).rejects.toThrow("REDIRECT:/painel/agenda");
    expect(mocks.load).not.toHaveBeenCalled();
  });
  it("preserves the cashier's destination without agenda permission", async () => {
    mocks.session = { authSource: "panel", legacyRoleId: 3, legacyResources: ["vis_bilhet"] };
    await expect(Page()).rejects.toThrow("REDIRECT:/painel/bilheteria");
  });
  it("keeps the existing home for sessions without agenda permission or a panel source", async () => {
    for (const session of [
      { authSource: "panel", legacyRoleId: 1, legacyResources: ["vis_bilhet"] },
      { authSource: "token", legacyRoleId: 1, legacyResources: ["vis_agenda"] },
    ]) {
      mocks.session = session;
      expect(await Page()).not.toBeNull();
    }
  });
});
