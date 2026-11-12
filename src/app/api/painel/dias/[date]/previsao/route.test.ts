import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";
import { createOperationsSessionToken, OPERATIONS_COOKIE_NAME } from "@/lib/ops-session";
const mock = vi.hoisted(() => ({ get: vi.fn(), refresh: vi.fn() }));
vi.mock("@/lib/weather-forecast", async (original) => ({ ...await original<typeof import("@/lib/weather-forecast")>(), getCachedWeatherForecast: mock.get, refreshWeatherForecast: mock.refresh }));
vi.mock("@/lib/painel-acl", () => ({ listLegacyPanelResourcesForRole: async () => [] }));
vi.mock("@/lib/ingresso-db", () => ({ getIngressoSistemaDbPool: () => { throw new Error("Unexpected database access"); } }));
const manager = createOperationsSessionToken({ authSource: "panel", role: "admin", legacyRoleId: 1, legacyResources: ["vis_agenda"] });
const operator = createOperationsSessionToken({ authSource: "panel", role: "operator", legacyRoleId: 3, legacyResources: ["vis_agenda"] });
const token = createOperationsSessionToken({ authSource: "token", role: "admin", legacyRoleId: 1, legacyResources: ["vis_agenda"] });
const context = { params: Promise.resolve({ date: "2026-11-12" }) };
function request(method: string, session?: string, suffix = "", body?: string) {
  return new Request(`https://example.test/api/painel/dias/2026-11-12/previsao${suffix}`, { method, headers: session ? { cookie: `${OPERATIONS_COOKIE_NAME}=${session}` } : {}, body });
}
beforeEach(() => { vi.clearAllMocks(); mock.get.mockResolvedValue({ status: "unavailable" }); mock.refresh.mockResolvedValue({ status: "available", summary: "Às 12:00: 23 °C" }); });
describe("weather routes", () => {
  it.each([undefined, token])("requires a panel session", async (session) => {
    for (const response of [await GET(request("GET", session), context), await POST(request("POST", session), context)]) {
      expect(response.status).toBe(401); expect(response.headers.get("cache-control")).toBe("private, no-store");
    }
    expect(mock.get).not.toHaveBeenCalled(); expect(mock.refresh).not.toHaveBeenCalled();
  });
  it("permits only agenda readers and manager refreshes, without requiring client data permission", async () => {
    const denied = createOperationsSessionToken({ authSource: "panel", role: "admin", legacyRoleId: 1, legacyResources: ["vis_bilhet"] });
    expect((await GET(request("GET", denied), context)).status).toBe(403);
    expect((await POST(request("POST", denied), context)).status).toBe(403);
    expect((await POST(request("POST", operator), context)).status).toBe(403);
    expect((await GET(request("GET", operator), context)).status).toBe(200);
    expect(mock.refresh).not.toHaveBeenCalled();
    const response = await POST(request("POST", manager), context);
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ ok: true, data: { status: "available", summary: "Às 12:00: 23 °C" } });
    expect(mock.refresh).toHaveBeenCalledWith("2026-11-12");
  });
  it("GET never invokes refresh and neither method accepts query overrides", async () => {
    await GET(request("GET", manager), context); expect(mock.refresh).not.toHaveBeenCalled();
    for (const method of [GET, POST]) expect((await method(request(method === GET ? "GET" : "POST", manager, "?park=estancia"), context)).status).toBe(400);
    expect(mock.refresh).not.toHaveBeenCalled();
  });
  it("rejects invalid dates and any POST body before refresh", async () => {
    expect((await POST(request("POST", manager, "", "{}"), context)).status).toBe(400);
    expect((await POST(request("POST", manager), { params: Promise.resolve({ date: "2026-02-30" }) })).status).toBe(400);
    expect(mock.refresh).not.toHaveBeenCalled();
  });
  it("accepts a zero-byte body stream", async () => {
    const empty = request("POST", manager, "", "");
    expect(empty.body).not.toBeNull();
    expect((await POST(empty, context)).status).toBe(200);
    expect(mock.refresh).toHaveBeenCalledWith("2026-11-12");
  });
  it("accepts empty chunks followed by EOF and rejects any first byte without consuming the rest", async () => {
    const empty = request("POST", manager);
    Object.defineProperty(empty, "body", { value: new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array()); controller.close(); } }) });
    expect((await POST(empty, context)).status).toBe(200);
    mock.refresh.mockClear();
    const cancel = vi.fn();
    const nonempty = request("POST", manager);
    Object.defineProperty(nonempty, "body", { value: new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array([32])); }, cancel }) });
    expect((await POST(nonempty, context)).status).toBe(400);
    expect(cancel).toHaveBeenCalled(); expect(mock.refresh).not.toHaveBeenCalled();
  });
  it("bounds repeated empty chunks and a body that never reaches EOF", async () => {
    const repeated = request("POST", manager);
    Object.defineProperty(repeated, "body", { value: new ReadableStream({ pull(controller) { controller.enqueue(new Uint8Array()); } }) });
    expect((await POST(repeated, context)).status).toBe(400);
    vi.useFakeTimers();
    try {
      const stalled = request("POST", manager);
      Object.defineProperty(stalled, "body", { value: new ReadableStream() });
      const response = POST(stalled, context);
      await vi.advanceTimersByTimeAsync(2001);
      expect((await response).status).toBe(400);
      expect(mock.refresh).not.toHaveBeenCalled();
    } finally { vi.useRealTimers(); }
  });
  it("does not expose database or upstream errors", async () => {
    mock.get.mockRejectedValueOnce(new Error("private database detail"));
    const response = await GET(request("GET", manager), context);
    expect(response.status).toBe(503); expect(await response.json()).toMatchObject({ error: { code: "weather_unavailable" } });
  });
});
