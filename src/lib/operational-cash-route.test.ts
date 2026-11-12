import { beforeEach, describe, expect, it, vi } from "vitest";
import { createOperationsSessionToken, OPERATIONS_COOKIE_NAME } from "@/lib/ops-session";
import { GET as list, POST as open } from "@/app/api/painel/caixas/route";
import { GET as detail } from "@/app/api/painel/caixas/[periodId]/route";
import { POST as movement } from "@/app/api/painel/caixas/[periodId]/movimentos/route";
import { POST as close } from "@/app/api/painel/caixas/[periodId]/fechar/route";
const mock = vi.hoisted(() => ({ list: vi.fn(), open: vi.fn(), get: vi.fn(), movement: vi.fn(), close: vi.fn() }));
vi.mock("@/lib/operational-cash-session", () => ({
  CashSessionError: class extends Error { constructor(readonly code: string, message: string, readonly status = 409) { super(message); } },
  listCashSessions: mock.list, openCashSession: mock.open, getCashSession: mock.get,
  createCashSessionMovement: mock.movement, closeCashSession: mock.close,
}));
vi.mock("@/lib/painel-acl", () => ({ listLegacyPanelResourcesForRole: async () => [] }));
vi.mock("@/lib/ingresso-db", () => ({ getIngressoSistemaDbPool: () => { throw new Error("Unexpected DB"); } }));
const context = { params: Promise.resolve({ periodId: "7" }) };
const manager = createOperationsSessionToken({ authSource: "panel", role: "admin", legacyRoleId: 1, legacyResources: ["vis_bilhet"], actorName: "Gerente", actorCpf: "52998224725" });
const token = createOperationsSessionToken({ authSource: "token", role: "admin", legacyRoleId: 1, legacyResources: ["vis_bilhet"] });
const denied = createOperationsSessionToken({ authSource: "panel", role: "operator", legacyRoleId: 2, legacyResources: ["vis_agenda"] });
function request(method: string, session?: string, body?: unknown, query = "") {
  return new Request(`https://example.test/api/painel/caixas${query}`, { method, headers: { "Content-Type": "application/json", ...(session ? { cookie: `${OPERATIONS_COOKIE_NAME}=${session}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
beforeEach(() => { vi.clearAllMocks(); for (const fn of Object.values(mock)) fn.mockResolvedValue({ id: 7 }); });
describe("explicit cash session API", () => {
  it.each([undefined, token, denied])("rejects missing/token sessions and unrelated ACL before financial access", async (session) => {
    const responses = await Promise.all([list(request("GET", session, undefined, "?date=2026-11-12")), open(request("POST", session, {})),
      detail(request("GET", session), context), movement(request("POST", session, {}), context), close(request("POST", session, {}), context)]);
    for (const response of responses) { expect(response.status).toBe(session === denied ? 403 : 401); expect(response.headers.get("cache-control")).toBe("private, no-store"); }
    for (const fn of Object.values(mock)) expect(fn).not.toHaveBeenCalled();
  });
  it("derives the actor and period from authenticated context and URL", async () => {
    const body = { type: "sangria", responsible: "Maria", amountCents: 2500, reason: "Retirada", idempotencyKey: "movement-1" };
    const response = await movement(request("POST", manager, body), context);
    expect(response.status).toBe(200);
    expect(mock.movement).toHaveBeenCalledWith({ ...body, periodId: 7 }, { name: "Gerente", cpf: "52998224725" });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect((await movement(request("POST", manager, { ...body, actor: { name: "Spoof" } }), context)).status).toBe(400);
    expect((await movement(request("POST", manager, { ...body, periodId: 8 }), context)).status).toBe(400);
    expect(mock.movement).toHaveBeenCalledTimes(1);
  });
  it("validates civil dates, exact query keys and safe IDs before querying", async () => {
    for (const query of ["", "?date=2026-02-30", "?date=2026-11-12&date=2026-11-13", "?date=2026-11-12&park=estancia"]) expect((await list(request("GET", manager, undefined, query))).status).toBe(400);
    expect((await detail(request("GET", manager), { params: Promise.resolve({ periodId: "9007199254740992" }) })).status).toBe(400);
    expect(mock.list).not.toHaveBeenCalled(); expect(mock.get).not.toHaveBeenCalled();
    expect((await list(request("GET", manager, undefined, "?date=2026-11-12"))).status).toBe(200);
    expect(mock.list).toHaveBeenCalledWith("2026-11-12");
  });
  it("passes explicit opening/counting cents and idempotency keys without inventing defaults", async () => {
    const opening = { date: "2026-11-12", locationId: 2, openingCashCents: 0, idempotencyKey: "opening-1" };
    expect((await open(request("POST", manager, opening))).status).toBe(201);
    expect(mock.open).toHaveBeenCalledWith(opening, { name: "Gerente", cpf: "52998224725" });
    const closing = { countedCashCents: 0, reason: "Conferido", idempotencyKey: "closing-1" };
    expect((await close(request("POST", manager, closing), context)).status).toBe(200);
    expect(mock.close).toHaveBeenCalledWith({ ...closing, periodId: 7 }, { name: "Gerente", cpf: "52998224725" });
    expect((await close(request("POST", manager, { ...closing, automatic: true }), context)).status).toBe(400);
  });
  it("does not expose database failures", async () => {
    mock.get.mockRejectedValueOnce(new Error("private connection"));
    const response = await detail(request("GET", manager), context);
    expect(response.status).toBe(503); expect(JSON.stringify(await response.json())).not.toContain("private connection");
  });
});
