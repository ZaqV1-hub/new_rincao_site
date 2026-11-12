import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Page from "./page";
const mocks = vi.hoisted(() => ({ read: vi.fn(), navigation: vi.fn(), access: vi.fn() }));
vi.mock("@/lib/painel-session", () => ({ requirePainelAccess: mocks.access }));
vi.mock("@/lib/day-program", () => ({ getDayProgram: mocks.read, DayProgramError: class extends Error {} }));
vi.mock("@/lib/day-program-navigation", () => ({ getDayProgramNavigation: mocks.navigation }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); }, redirect: (url: string) => { throw new Error(`REDIRECT ${url}`); } }));
beforeEach(() => { mocks.access.mockReset().mockResolvedValue({ authSource: "panel", legacyRoleId: 1 }); mocks.read.mockReset().mockResolvedValue({ date: "2099-01-02" }); mocks.navigation.mockReset().mockResolvedValue({ previousDate: null, nextDate: null, dates: [] }); });
const props = { params: Promise.resolve({ date: "2099-01-02" }), searchParams: Promise.resolve({ returnTo: "2098-12-01" }) };
describe("day program server route", () => {
  it("requires both agenda and customer data access and loads the selected date and movement navigation", async () => {
    const element = await Page(props);
    expect(mocks.access).toHaveBeenNthCalledWith(1, "vis_agenda", "/painel/agenda");
    expect(mocks.access).toHaveBeenNthCalledWith(2, ["vis_clientes", "vis_escola"], "/painel/agenda");
    expect(mocks.read).toHaveBeenCalledWith("2099-01-02");
    expect(mocks.navigation).toHaveBeenCalledWith("2099-01-02");
    expect(element.props).toMatchObject({ program: { date: "2099-01-02" }, canManage: true, returnDate: "2098-12-01" });
  });
  it("does not treat an operator as a manager", async () => { mocks.access.mockResolvedValue({ authSource: "panel", legacyRoleId: 3 }); expect((await Page(props)).props.canManage).toBe(false); });
  it("rejects non-panel identities before querying", async () => { mocks.access.mockResolvedValue({ authSource: "operations", legacyRoleId: 1 }); await expect(Page(props)).rejects.toThrow("REDIRECT"); expect(mocks.read).not.toHaveBeenCalled(); });
  it("rejects agenda-only access before reading school contacts", async () => { mocks.access.mockResolvedValueOnce({ authSource: "panel", legacyRoleId: 3 }).mockRejectedValueOnce(new Error("FORBIDDEN")); await expect(Page(props)).rejects.toThrow("FORBIDDEN"); expect(mocks.read).not.toHaveBeenCalled(); });
  it("rejects invalid dates and sanitizes the return target to a civil date", async () => {
    await expect(Page({ ...props, params: Promise.resolve({ date: "2099-02-30" }) })).rejects.toThrow("NOT_FOUND");
    expect(mocks.read).not.toHaveBeenCalled();
    expect((await Page({ ...props, searchParams: Promise.resolve({ returnTo: "https://external.example" }) })).props.returnDate).toBe("2099-01-02");
  });
  it("renders a recoverable failure without exposing the database error", async () => {
    mocks.read.mockRejectedValue(new Error("private postgres endpoint"));
    const html = renderToStaticMarkup(await Page(props));
    expect(html).toContain('role="alert"'); expect(html).toContain("Atualize a página"); expect(html).toContain('href="/painel/agenda/2098-12-01"'); expect(html).not.toContain("private postgres endpoint");
  });
});
