import { beforeEach, describe, expect, it, vi } from "vitest";
import Page from "./page";
const mocks = vi.hoisted(() => ({ list: vi.fn(), programs: vi.fn(), screen: vi.fn(), session: { authSource: "panel", legacyRoleId: 1, legacyResources: ["vis_agenda", "vis_clientes"] } }));
vi.mock("@/lib/day-program", () => ({ getDayPrograms: mocks.programs }));
vi.mock("@/lib/painel-session", () => ({ requirePainelAccess: async () => mocks.session }));
vi.mock("@/lib/operational-day", () => ({ listOperationalDays: mocks.list, OperationalDayError: class extends Error {} }));
vi.mock("@/lib/operational-date", () => ({ getSaoPauloToday: () => "2099-01-02", isCivilDate: (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) }));
vi.mock("@/lib/painel-agenda", () => ({ getPainelAgendaScreenData: mocks.screen }));
beforeEach(() => { mocks.screen.mockReset().mockResolvedValue({ month: 1, year: 2099, selectedDate: "2099-01-02", selectedDay: null, entries: [], priceTables: [], informationOptions: [] }); mocks.list.mockReset().mockResolvedValue([{ date: "2099-01-02", version: 2 }]); mocks.session.legacyRoleId = 1; mocks.session.authSource = "panel"; mocks.session.legacyResources = ["vis_agenda", "vis_clientes"]; mocks.programs.mockReset().mockResolvedValue([{ date: "2099-01-02", status: "created", groups: [{ phone: "private" }] }]); });
describe("agenda server page configuration", () => {
  it("passes actual month configuration and permission into the calendar", async () => {
    const element = await Page({ searchParams: Promise.resolve({}) });
    expect(mocks.list).toHaveBeenCalledWith("2099-01-01", "2099-01-31");
    expect(element.props).toMatchObject({ operationalDays: [{ date: "2099-01-02", version: 2 }], today: "2099-01-02", canEdit: true });
  });
  it("keeps the calendar readable but marks configuration unavailable when its query fails", async () => {
    mocks.list.mockRejectedValue(new Error("database failure"));
    const element = await Page({ searchParams: Promise.resolve({}) });
    expect(element.props.operationalDays).toBeNull();
    expect(element.props.operationalError).toContain("Não foi possível");
  });
  it("keeps operators read-only", async () => {
    mocks.session.legacyRoleId = 3;
    const element = await Page({ searchParams: Promise.resolve({}) });
    expect(element.props.canEdit).toBe(false);
  });
  it("loads a single month batch and passes only date/status, including current stale-export status", async () => {
    const element = await Page({ searchParams: Promise.resolve({}) });
    expect(mocks.programs).toHaveBeenCalledTimes(1);
    expect(mocks.programs.mock.calls[0][0]).toEqual(Array.from({ length: 31 }, (_, index) => `2099-01-${String(index + 1).padStart(2, "0")}`));
    expect(element.props).toMatchObject({ canAccessProgram: true, programStatuses: { "2099-01-02": "created" } });
    expect(JSON.stringify(element.props)).not.toContain("private");
  });
  it.each([["vis_agenda"], ["vis_clientes"], ["vis_escola"]])("does not fetch program data without both agenda and client permission: %j", async (...resources) => {
    mocks.session.legacyResources = resources;
    const element = await Page({ searchParams: Promise.resolve({}) });
    expect(element.props.canAccessProgram).toBe(false); expect(element.props.programStatuses).toBeNull();
    expect(mocks.programs).not.toHaveBeenCalled();
  });
  it("accepts school access as an alternative, but not a non-panel session", async () => {
    mocks.session.legacyResources = ["vis_agenda", "vis_escola"];
    expect((await Page({ searchParams: Promise.resolve({}) })).props.canAccessProgram).toBe(true);
    mocks.programs.mockClear(); mocks.session.authSource = "token";
    expect((await Page({ searchParams: Promise.resolve({}) })).props.canAccessProgram).toBe(false);
    expect(mocks.programs).not.toHaveBeenCalled();
  });
  it("keeps configuration visible when the program source fails", async () => {
    mocks.programs.mockRejectedValue(new Error("private database endpoint"));
    const element = await Page({ searchParams: Promise.resolve({}) });
    expect(element.props.programStatuses).toBeNull(); expect(element.props.programError).toContain("indisponível");
    expect(element.props.operationalDays).toEqual([{ date: "2099-01-02", version: 2 }]);
    expect(JSON.stringify(element.props)).not.toContain("private database endpoint");
  });

});
