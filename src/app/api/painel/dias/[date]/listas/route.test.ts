import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ access: vi.fn(), list: vi.fn() }));
vi.mock("@/lib/painel-api-auth", () => ({ requirePainelApiAccess: mocks.access }));
vi.mock("@/lib/operational-day-lists", async (original) => ({
  ...await original<typeof import("@/lib/operational-day-lists")>(), getOperationalDayList: mocks.list,
}));
import { GET } from "./route";
const context = { params: Promise.resolve({ date: "2099-11-15" }) };
const request = (query: string) => new Request(`https://local.test/api/painel/dias/2099-11-15/listas?${query}`);
beforeEach(() => { vi.clearAllMocks(); mocks.access.mockResolvedValue({ ok: true }); mocks.list.mockResolvedValue({ items: [],total: 0 }); });
describe("day lists access", () => {
  it.each([{ kind: "purchases", permission: "vis_compra" },{ kind: "groups", permission: ["vis_clientes", "vis_escola"] }])("requires agenda and $kind detail permission", async ({ kind, permission }) => {
    const response = await GET(request(`kind=${kind}&page=2`),context);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(mocks.access.mock.calls.map((call) => call[1])).toEqual(["vis_agenda",permission]);
    expect(mocks.list).toHaveBeenCalledWith("2099-11-15",kind,2,kind === "purchases" ? { origin: "all", type: "all", query: "" } : undefined);
  });
  it("accepts normalized purchase filters and preserves both required permissions", async () => {
    const response = await GET(request("kind=purchases&origin=gate&type=group&query=%20Ana%20&page=3"), context);
    expect(response.status).toBe(200);
    expect(mocks.access.mock.calls.map(call => call[1])).toEqual(["vis_agenda", "vis_compra"]);
    expect(mocks.list).toHaveBeenCalledWith("2099-11-15", "purchases", 3, { origin: "gate", type: "group", query: "Ana" });
  });
  it.each([
    "kind=groups&origin=all", "kind=groups&type=all", "kind=groups&query=", "kind=purchases&origin=bad", "kind=purchases&type=service",
    "kind=purchases&origin=all&origin=site", "kind=purchases&type=all&type=group", "kind=purchases&query=a&query=b",
    "kind=purchases&page=1&page=2", "kind=purchases&page=1000001", "kind=purchases&query=" + "x".repeat(121),
  ])("rejects filters, duplicate keys and limits: %s", async (query) => {
    const response = await GET(request(query), context);
    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(mocks.list).not.toHaveBeenCalled();
  });
  it("rejects an invalid civil date before querying lists", async () => {
    const response = await GET(request("kind=purchases"), { params: Promise.resolve({ date: "2099-02-30" }) });
    expect(response.status).toBe(400); expect(mocks.list).not.toHaveBeenCalled();
  });
  it("does not load personal lists when only agenda access is allowed", async () => {
    mocks.access.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: false,response: new Response(null,{ status: 403 }) });
    const response = await GET(request("kind=purchases"),context);
    expect(response.status).toBe(403);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(mocks.list).not.toHaveBeenCalled();
  });
  it("requires authentication before reading or parsing the list", async () => {
    mocks.access.mockResolvedValueOnce({ ok: false,response: new Response(null,{ status: 401 }) });
    expect((await GET(request("kind=groups"),context)).status).toBe(401);
    expect(mocks.list).not.toHaveBeenCalled();
  });
  it.each(["kind=groups&page=0","kind=purchases&page=1.2","kind=groups&park=estancia","kind=groups&kind=purchases","kind=anything"])("rejects unsupported input %s", async (query) => {
    expect((await GET(request(query),context)).status).toBe(400);
    expect(mocks.list).not.toHaveBeenCalled();
  });
});
