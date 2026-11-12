import { describe, expect, it, vi } from "vitest";
import { GET, PATCH, POST } from "./route";
import { createOperationsSessionToken, OPERATIONS_COOKIE_NAME } from "@/lib/ops-session";

vi.mock("@/lib/painel-acl", () => ({ listLegacyPanelResourcesForRole: async () => [] }));
vi.mock("@/lib/ingresso-db", () => ({
  getIngressoSistemaDbPool: () => { throw new Error("Unexpected database access"); },
}));

const manager = createOperationsSessionToken({
  authSource: "panel", role: "admin", legacyRoleId: 1, legacyResources: ["vis_ingesp"],
});
const operator = createOperationsSessionToken({
  authSource: "panel", role: "admin", legacyRoleId: 3, legacyResources: ["vis_ingesp"],
});
const token = createOperationsSessionToken({
  authSource: "token", role: "admin", legacyRoleId: 1, legacyResources: ["vis_ingesp"],
});
const service = { name: "Armário", description: "", active: true, sitePriceCents: null, gatePriceCents: 0 };

function request(method: string, session?: string, body?: unknown) {
  return new Request("https://example.test/api/painel/servicos", {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(session ? { cookie: `${OPERATIONS_COOKIE_NAME}=${session}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("service catalog routes", () => {
  it.each([undefined, token])("requires a panel session for reads and writes", async (session) => {
    const responses = await Promise.all([GET(request("GET", session)), POST(request("POST", session, service))]);
    for (const response of responses) {
      expect(response.status).toBe(401);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(await response.json()).toMatchObject({ ok: false, error: { code: "painel_auth_required" } });
    }
  });

  it("requires the special ticket resource to list services", async () => {
    const session = createOperationsSessionToken({
      authSource: "panel", role: "operator", legacyRoleId: 3, legacyResources: ["vis_bilhet"],
    });
    expect((await GET(request("GET", session))).status).toBe(403);
  });

  it("does not treat an operator with catalog access and ops admin role as a manager", async () => {
    expect((await POST(request("POST", operator, service))).status).toBe(403);
    expect((await PATCH(request("PATCH", operator, { ...service, id: 1, version: 1 }))).status).toBe(403);
  });

  it.each([-1, 1.5, 1_000_000_000_000, "0", null])("rejects invalid gate price %j", async (gatePriceCents) => {
    const response = await POST(request("POST", manager, { ...service, gatePriceCents }));
    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toMatchObject({ ok: false, error: { code: "invalid_input" } });
  });

  it.each([
    { sitePriceCents: -1 },
    { sitePriceCents: 0.5 },
    { sitePriceCents: undefined },
    { name: " " },
    { name: "a".repeat(121) },
    { description: "a".repeat(1001) },
    { active: "true" },
    { applyToOpenDates: "true" },
    { actorCpf: "00000000000" },
    { park: "estancia" },
    { id: 1, version: 1 },
  ])("rejects invalid or out of scope creation fields %#", async (fields) => {
    expect((await POST(request("POST", manager, { ...service, ...fields }))).status).toBe(400);
  });

  it("requires a version for updates and keeps date assignment on create only", async () => {
    expect((await PATCH(request("PATCH", manager, { ...service, id: 1 }))).status).toBe(400);
    expect((await PATCH(request("PATCH", manager, { ...service, id: 1, version: 0 }))).status).toBe(400);
    expect((await PATCH(request("PATCH", manager, { ...service, id: 1, version: 1, applyToOpenDates: true }))).status).toBe(400);
  });

  it("refuses a form content type even with a JSON body", async () => {
    const input = request("POST", manager, service);
    input.headers.set("Content-Type", "text/plain");
    expect((await POST(input)).status).toBe(400);
  });
});
