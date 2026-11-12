import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";
import { POST as panelPost } from "@/app/api/painel/bilheteria/cash-closures/route";
const { access, close, list } = vi.hoisted(() => ({ access: vi.fn(), close: vi.fn(), list: vi.fn() }));
vi.mock("@/lib/painel-api-auth", () => ({ requirePainelApiAccess: access }));
vi.mock("@/lib/ops-cash-closures", () => ({ closeOperationalCashClosure: close, listOperationalCashClosures: list, asOperationalCashClosureError: (error: Error) => error }));
const request = () => new Request("https://example.com/api/ops/cash-closures", { method: "POST", body: JSON.stringify({ reason: "Reconciliacao", operatorName: "Spoof", actor: { name: "Spoof" } }) });
describe("legacy closure access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    access.mockResolvedValue({ ok: true, session: { legacyRoleId: 1, actorName: "Gestor", actorCpf: "123" } });
  });
  it("reads private history using strict panel access", async () => {
    list.mockResolvedValue({ items: [], meta: { limit: 20, offset: 0, total: 0 } });
    const response = await GET(new Request("https://example.com/api/ops/cash-closures"));
    expect(access).toHaveBeenCalledWith(expect.any(Request), "vis_bilhet");
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });
  it.each([POST, panelPost])("uses the authenticated manager for reconciliation", async (post) => {
    close.mockResolvedValue({ action: "close", nextPeriodId: null, currentSummary: null });
    const response = await post(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(close).toHaveBeenCalledWith({ reason: "Reconciliacao", operatorName: "Gestor", actor: { name: "Gestor", cpf: "123" } });
    expect((await response.json()).data.nextPeriodId).toBeNull();
  });
  it("rejects a panel operator even when cash permission is present", async () => {
    access.mockResolvedValue({ ok: true, session: { legacyRoleId: 2 } });
    const response = await POST(request());
    expect(response.status).toBe(403);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(close).not.toHaveBeenCalled();
  });
  it.each([GET, POST])("rejects unauthenticated and bearer-only interactive access", async (handler) => {
    access.mockResolvedValue({ ok: false, response: new Response(null, { status: 401 }) });
    const response = await handler(request());
    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(close).not.toHaveBeenCalled();
    expect(list).not.toHaveBeenCalled();
  });
  it("preserves conflict status privately", async () => {
    close.mockRejectedValue(Object.assign(new Error("Selecione caixa"), { status: 409, code: "cash_session_required" }));
    const response = await POST(request());
    expect(response.status).toBe(409);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });
});
