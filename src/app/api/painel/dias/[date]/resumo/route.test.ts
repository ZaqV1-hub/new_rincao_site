import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { createOperationsSessionToken, OPERATIONS_COOKIE_NAME } from "@/lib/ops-session";
const mocks = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock("@/lib/operational-day-summary", async (original) => ({ ...await original<object>(), getOperationalDaySummary: mocks.read }));
vi.mock("@/lib/painel-acl", () => ({ listLegacyPanelResourcesForRole: async () => [] }));
const panel = createOperationsSessionToken({ authSource: "panel", role: "operator", legacyRoleId: 3, legacyResources: ["vis_agenda"] });
const token = createOperationsSessionToken({ authSource: "token", role: "admin", legacyRoleId: 1, legacyResources: ["vis_agenda"] });
function request(session?: string, query = "") { return new Request(`https://example.test/api/painel/dias/2099-01-01/resumo${query}`, { headers: session ? { cookie: `${OPERATIONS_COOKIE_NAME}=${session}` } : {} }); }
const context = { params: Promise.resolve({ date: "2099-01-01" }) };
beforeEach(() => { mocks.read.mockReset().mockResolvedValue({ park: "rincao", date: "2099-01-01" }); });
describe("operational summary route", () => {
  it.each([undefined, token])("requires a signed panel session", async (session) => {
    const response = await GET(request(session), context);
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it("requires agenda permission", async () => {
    const session = createOperationsSessionToken({ authSource: "panel", role: "operator", legacyRoleId: 3, legacyResources: ["vis_bilhet"] });
    expect((await GET(request(session), context)).status).toBe(403);
  });
  it("allows an agenda operator to read and uses the route civil date", async () => {
    const response = await GET(request(panel), context);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ ok: true, data: { park: "rincao", date: "2099-01-01" } });
    expect(mocks.read).toHaveBeenCalledWith("2099-01-01");
  });
  it("rejects invalid dates and caller-supplied park fields", async () => {
    expect((await GET(request(panel), { params: Promise.resolve({ date: "2099-02-29" }) })).status).toBe(400);
    expect((await GET(request(panel, "?park=estancia"), context)).status).toBe(400);
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it("does not expose database failures", async () => {
    mocks.read.mockRejectedValue(new Error("internal SQL details"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const response = await GET(request(panel), context);
      expect(response.status).toBe(500);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(JSON.stringify(await response.json())).not.toContain("internal SQL details");
    } finally { log.mockRestore(); }
  });
});
