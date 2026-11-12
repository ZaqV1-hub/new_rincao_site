import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Page from "./page";
const mocks = vi.hoisted(() => ({ read: vi.fn(), program: vi.fn(), access: vi.fn() }));
vi.mock("@/lib/day-program", () => ({ getDayProgram: mocks.program }));
vi.mock("@/lib/painel-session", () => ({ requirePainelAccess: mocks.access }));
vi.mock("@/lib/operational-day-summary", () => ({ getOperationalDaySummary: mocks.read, OperationalDaySummaryError: class extends Error {} }));
vi.mock("@/lib/operational-day", () => ({ OperationalDayError: class extends Error {} }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); }, redirect: (url: string) => { throw new Error(`REDIRECT ${url}`); } }));
beforeEach(() => { mocks.access.mockReset().mockResolvedValue({ authSource: "panel", legacyRoleId: 1, legacyResources: ["vis_agenda", "vis_clientes"] }); mocks.read.mockReset().mockResolvedValue({ date: "2099-01-02" }); mocks.program.mockReset().mockResolvedValue({ date: "2099-01-02", status: "exported", groups: [{ phone: "private" }] }); });
const props = { params: Promise.resolve({ date: "2099-01-02" }) };
describe("operational day route", () => {
  it("requires agenda access and passes real summary with manager capability", async () => {
    const element = await Page(props);
    expect(mocks.access).toHaveBeenCalledWith("vis_agenda", "/painel/agenda");
    expect(mocks.read).toHaveBeenCalledWith("2099-01-02");
    expect(element.props).toMatchObject({ summary: { date: "2099-01-02" }, canManage: true });
  });
  it("does not grant management to operators", async () => {
    mocks.access.mockResolvedValue({ authSource: "panel", legacyRoleId: 3 });
    expect((await Page(props)).props.canManage).toBe(false);
  });
  it("rejects a non-panel session before reading private data", async () => {
    mocks.access.mockResolvedValue({ authSource: "operations", legacyRoleId: 1 });
    await expect(Page(props)).rejects.toThrow("REDIRECT");
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it("rejects impossible civil dates before querying", async () => {
    await expect(Page({ params: Promise.resolve({ date: "2099-02-30" }) })).rejects.toThrow("NOT_FOUND");
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it("shows a recoverable error without leaking the database message or fabricating totals", async () => {
    mocks.read.mockRejectedValue(new Error("private database endpoint"));
    const html = renderToStaticMarkup(await Page(props));
    expect(html).toContain('role="alert"');
    expect(html).toContain("Atualize a página");
    expect(html).toContain("Voltar ao calendário");
    expect(html).not.toContain("private database endpoint");
    expect(html).not.toContain("R$");
  });
  it("passes only the program status and preserves the financial summary when program loading fails", async () => {
    const element = await Page(props);
    expect(element.props).toMatchObject({ programStatus: "exported", canAccessProgram: true });
    expect(JSON.stringify(element.props)).not.toContain("private");
    mocks.program.mockRejectedValue(new Error("private endpoint"));
    const failed = await Page(props);
    expect(failed.props).toMatchObject({ summary: { date: "2099-01-02" }, programStatus: null, canAccessProgram: true });
    expect(failed.props.programError).toContain("indisponível");
  });
  it.each([["vis_agenda"], ["vis_clientes"], ["vis_escola"]])("does not read program details without both resource permissions: %j", async (...resources) => {
    mocks.access.mockResolvedValue({ authSource: "panel", legacyRoleId: 1, legacyResources: resources });
    expect((await Page(props)).props.canAccessProgram).toBe(false);
    expect(mocks.program).not.toHaveBeenCalled();
  });
  it("allows the school alternative without granting manager capabilities", async () => {
    mocks.access.mockResolvedValue({ authSource: "panel", legacyRoleId: 3, legacyResources: ["vis_agenda", "vis_escola"] });
    expect((await Page(props)).props).toMatchObject({ canManage: false, canAccessProgram: true, programStatus: "exported" });
  });

});
