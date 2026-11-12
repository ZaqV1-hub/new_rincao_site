import { describe, expect, it, vi } from "vitest";
import { GET, PATCH, POST } from "./route";
import { createOperationsSessionToken, OPERATIONS_COOKIE_NAME } from "@/lib/ops-session";

vi.mock("@/lib/painel-acl", () => ({ listLegacyPanelResourcesForRole: async () => [] }));
vi.mock("@/lib/ingresso-db", () => ({
  getIngressoSistemaDbPool: () => { throw new Error("Unexpected database access"); },
}));

const location = { name: "Bilheteria", description: "", active: true };
const manager = createOperationsSessionToken({
  authSource: "panel", role: "admin", legacyRoleId: 1, legacyResources: ["vis_bilhet"],
});

function request(method: string, session: string, body?: unknown) {
  return new Request("https://example.test/api/painel/locais-caixa", {
    method,
    headers: { cookie: `${OPERATIONS_COOKIE_NAME}=${session}`, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("cash location catalog routes", () => {
  it("returns a private 401 for a signed operations token outside the panel", async () => {
    const token = createOperationsSessionToken({ role: "admin", legacyRoleId: 1, legacyResources: ["vis_bilhet"] });
    const response = await GET(request("GET", token));
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toMatchObject({ ok: false, error: { code: "painel_auth_required" } });
  });

  it("requires the box office resource to list locations", async () => {
    const token = createOperationsSessionToken({
      authSource: "panel", role: "operator", legacyRoleId: 4, legacyResources: ["vis_contra"],
    });
    const response = await GET(request("GET", token));
    expect(response.status).toBe(403);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("allows only a manager to create or update locations", async () => {
    const token = createOperationsSessionToken({
      authSource: "panel", role: "admin", legacyRoleId: 3, legacyResources: ["vis_bilhet"],
    });
    expect((await POST(request("POST", token, location))).status).toBe(403);
    expect((await PATCH(request("PATCH", token, { ...location, id: 1, version: 1 }))).status).toBe(403);
  });

  it("rejects a forged identity and an invalid version without touching the catalog", async () => {
    expect((await POST(request("POST", manager, { ...location, cpf: "00000000000" }))).status).toBe(400);
    expect((await PATCH(request("PATCH", manager, { ...location, id: 1, version: -1 }))).status).toBe(400);
  });
});
