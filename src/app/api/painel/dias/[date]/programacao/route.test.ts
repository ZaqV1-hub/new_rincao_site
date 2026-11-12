import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST, PATCH } from "./route";
import { DayProgramError } from "@/lib/day-program";
import { createOperationsSessionToken, OPERATIONS_COOKIE_NAME } from "@/lib/ops-session";
const mock = vi.hoisted(() => ({ get: vi.fn(), create: vi.fn(), save: vi.fn() }));
vi.mock("@/lib/day-program", async (original) => ({ ...await original<typeof import("@/lib/day-program")>(), getDayProgram: mock.get, createDayProgram: mock.create, saveDayProgram: mock.save }));
vi.mock("@/lib/painel-acl", () => ({ listLegacyPanelResourcesForRole: async () => [] }));
vi.mock("@/lib/ingresso-db", () => ({ getIngressoSistemaDbPool: () => { throw new Error("Unexpected database access"); } }));
const manager = createOperationsSessionToken({ authSource: "panel", role: "admin", legacyRoleId: 1, actorName: "Gerente", actorCpf: "00000000001", legacyResources: ["vis_agenda", "vis_clientes"] });
const operator = createOperationsSessionToken({ authSource: "panel", role: "admin", legacyRoleId: 3, legacyResources: ["vis_agenda", "vis_clientes"] });
const token = createOperationsSessionToken({ authSource: "token", role: "admin", legacyRoleId: 1, legacyResources: ["vis_agenda", "vis_clientes"] });
const context = { params: Promise.resolve({ date: "2099-01-01" }) };
function request(method: string, session?: string, body?: unknown) {
  return new Request("https://example.test/api/painel/dias/2099-01-01/programacao", { method,
    headers: { "Content-Type": "application/json", ...(session ? { cookie: `${OPERATIONS_COOKIE_NAME}=${session}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
}
beforeEach(() => { vi.clearAllMocks(); mock.get.mockResolvedValue({ version: 1 }); mock.create.mockResolvedValue({ version: 1 }); mock.save.mockResolvedValue({ version: 2 }); });
describe("day program routes", () => {
  it.each([undefined, token])("requires panel session", async (session) => {
    for (const response of await Promise.all([GET(request("GET", session), context), POST(request("POST", session, {}), context), PATCH(request("PATCH", session, {}), context)])) {
      expect(response.status).toBe(401); expect(response.headers.get("cache-control")).toBe("private, no-store");
    }
    expect(mock.get).not.toHaveBeenCalled();
  });
  it("requires agenda permission and manager writes", async () => {
    const denied = createOperationsSessionToken({ authSource: "panel", role: "operator", legacyRoleId: 3, legacyResources: ["vis_bilhet"] });
    expect((await GET(request("GET", denied), context)).status).toBe(403);
    expect((await POST(request("POST", operator, {}), context)).status).toBe(403);
    expect((await PATCH(request("PATCH", operator, {}), context)).status).toBe(403);
    expect(mock.save).not.toHaveBeenCalled();
  });
  it("requires agenda AND client-or-school permission before returning any program DTO", async () => {
    for (const resources of [["vis_agenda"], ["vis_clientes"], ["vis_escola"]] as const) {
      const session = createOperationsSessionToken({ authSource: "panel", role: "admin", legacyRoleId: 1, legacyResources: [...resources] });
      for (const response of await Promise.all([GET(request("GET", session), context), POST(request("POST", session, {}), context), PATCH(request("PATCH", session, {}), context)])) expect(response.status).toBe(403);
    }
    expect(mock.get).not.toHaveBeenCalled(); expect(mock.create).not.toHaveBeenCalled(); expect(mock.save).not.toHaveBeenCalled();
    const school = createOperationsSessionToken({ authSource: "panel", role: "admin", legacyRoleId: 1, legacyResources: ["vis_agenda", "vis_escola"] });
    expect((await GET(request("GET", school), context)).status).toBe(200);
    expect((await POST(request("POST", school, {}), context)).status).toBe(200);
    expect((await PATCH(request("PATCH", school, {}), context)).status).toBe(200);
  });
  it("passes only the trusted session actor to writes", async () => {
    expect((await PATCH(request("PATCH", manager, { version: 1 }), context)).status).toBe(200);
    expect(mock.save).toHaveBeenCalledWith("2099-01-01", { version: 1 }, { name: "Gerente", cpf: "00000000001" });
  });
  it("rejects query overrides, malformed JSON, wrong content type and invalid date", async () => {
    const req = request("POST", manager, {}); req.headers.set("Content-Type", "text/plain");
    expect((await POST(req, context)).status).toBe(400);
    expect((await POST(new Request(req.url, { method: "POST", headers: { cookie: `${OPERATIONS_COOKIE_NAME}=${manager}`, "Content-Type": "application/json" }, body: "{" }), context)).status).toBe(400);
    expect((await GET(new Request(`${req.url}?park=estancia`, { headers: req.headers }), context)).status).toBe(400);
    expect((await GET(request("GET", manager), { params: Promise.resolve({ date: "2026-02-30" }) })).status).toBe(400);
  });
  it("preserves conflict semantics and exposes unavailable source errors", async () => {
    mock.save.mockRejectedValueOnce(new DayProgramError("version_conflict", "Conflito"));
    expect((await PATCH(request("PATCH", manager, { version: 1 }), context)).status).toBe(409);
    mock.get.mockRejectedValueOnce(Object.assign(new Error("table missing"), { code: "42P01" }));
    const response = await GET(request("GET", manager), context);
    expect(response.status).toBe(503); expect(await response.json()).toMatchObject({ error: { code: "program_unavailable" } });
  });
});
