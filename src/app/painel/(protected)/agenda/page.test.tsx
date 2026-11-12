import { beforeEach, describe, expect, it, vi } from "vitest";
import Page from "./page";
const mocks = vi.hoisted(() => ({ list: vi.fn(), screen: vi.fn(), session: { authSource: "panel", legacyRoleId: 1 } }));
vi.mock("@/lib/painel-session", () => ({ requirePainelAccess: async () => mocks.session }));
vi.mock("@/lib/operational-day", () => ({ listOperationalDays: mocks.list, OperationalDayError: class extends Error {} }));
vi.mock("@/lib/operational-date", () => ({ getSaoPauloToday: () => "2099-01-02", isCivilDate: (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) }));
vi.mock("@/lib/painel-agenda", () => ({ getPainelAgendaScreenData: mocks.screen }));
beforeEach(() => { mocks.screen.mockReset().mockResolvedValue({ month: 1, year: 2099, selectedDate: "2099-01-02", selectedDay: null, entries: [], priceTables: [], informationOptions: [] }); mocks.list.mockReset().mockResolvedValue([{ date: "2099-01-02", version: 2 }]); mocks.session.legacyRoleId = 1; });
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
});
