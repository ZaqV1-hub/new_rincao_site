import { describe, expect, it, vi } from "vitest";
import { GET, POST, PATCH } from "./route";
import { createOperationsSessionToken, OPERATIONS_COOKIE_NAME } from "@/lib/ops-session";
vi.mock("@/lib/painel-acl", () => ({ listLegacyPanelResourcesForRole: async () => [] }));
vi.mock("@/lib/ingresso-db", () => ({ getIngressoSistemaDbPool: () => { throw new Error("Unexpected database access"); } }));
const manager = createOperationsSessionToken({ authSource: "panel", role: "admin", legacyRoleId: 1, legacyResources: ["vis_agenda"] });
const operator = createOperationsSessionToken({ authSource: "panel", role: "admin", legacyRoleId: 3, legacyResources: ["vis_agenda"] });
const token = createOperationsSessionToken({ authSource: "token", role: "admin", legacyRoleId: 1, legacyResources: ["vis_agenda"] });
function request(method: string, session?: string, body?: unknown, query = "date=2099-01-01") {
  return new Request(`https://example.test/api/painel/dias?${query}`, { method,
    headers: { "Content-Type": "application/json", ...(session ? { cookie: `${OPERATIONS_COOKIE_NAME}=${session}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body) });
}
describe("operational day routes", () => {
  it.each([undefined, token])("requires panel authentication for all operations", async (session) => {
    for (const response of await Promise.all([GET(request("GET", session)), POST(request("POST", session, {})), PATCH(request("PATCH", session, {}))])) {
      expect(response.status).toBe(401);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
    }
  });
  it("requires agenda permission", async () => {
    const session = createOperationsSessionToken({ authSource: "panel", role: "operator", legacyRoleId: 3, legacyResources: ["vis_bilhet"] });
    expect((await GET(request("GET", session))).status).toBe(403);
  });
  it("requires legacy manager role even with an admin session", async () => {
    expect((await POST(request("POST", operator, {}))).status).toBe(403);
    expect((await PATCH(request("PATCH", operator, {}))).status).toBe(403);
  });
  it("rejects non JSON and malformed JSON", async () => {
    const plain = request("POST", manager, {}); plain.headers.set("Content-Type", "text/plain");
    expect((await POST(plain)).status).toBe(400);
    expect((await POST(new Request(plain.url, { method: "POST", headers: { ...Object.fromEntries(plain.headers), "Content-Type": "application/json" }, body: "{" }))).status).toBe(400);
  });
  it.each(["", "date=2026-02-30", "date=2099-01-01&park=estancia", "startDate=2099-02-01&endDate=2099-01-01"])("rejects invalid read query %s", async (query) => {
    expect((await GET(request("GET", manager, undefined, query))).status).toBe(400);
  });
});
