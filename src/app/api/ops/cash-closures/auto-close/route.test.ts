import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
const { auth, access, close } = vi.hoisted(() => ({ auth: vi.fn(), access: vi.fn(), close: vi.fn() }));
vi.mock("@/lib/ops-auth", () => ({ authenticateOperationsRequest: auth }));
vi.mock("@/lib/painel-api-auth", () => ({ requirePainelApiAccess: access }));
vi.mock("@/lib/ops-cash-closures", () => ({ autoCloseOperationalCashClosures: close, asOperationalCashClosureError: (error: Error) => error }));
const request = () => new Request("https://example.com/api/ops/cash-closures/auto-close", { method: "POST", headers: { authorization: "Bearer job-token" }, body: JSON.stringify({ reason: "Fechamento automatico diario a meia-noite", actor: { name: "Spoof", cpf: "123" } }) });
describe("cash auto-close job", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.mockReturnValue({ ok: true, via: "bearer" });
    close.mockResolvedValue({ action: "auto_close", closedCount: 0, closedPeriodIds: [], currentSummary: null });
  });
  it("preserves machine auth and script reason while ignoring body actor", async () => {
    const response = await POST(request());
    expect(auth).toHaveBeenCalledWith(expect.any(Request), { requiredPermission: "ops.cash" });
    expect(access).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledWith({ reason: "Fechamento automatico diario a meia-noite", actor: { name: "Fechamento automatico", cpf: null } });
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect((await response.json()).data).toMatchObject({ action: "auto_close", closedCount: 0, currentSummary: null });
  });
  it("derives interactive actor only from a panel manager", async () => {
    auth.mockReturnValue({ ok: true, via: "session" });
    access.mockResolvedValue({ ok: true, session: { legacyRoleId: 1, actorName: "Gestor", actorCpf: "123" } });
    await POST(request());
    expect(close).toHaveBeenCalledWith(expect.objectContaining({ actor: { name: "Gestor", cpf: "123" } }));
  });
  it("rejects a nonmanager session", async () => {
    auth.mockReturnValue({ ok: true, via: "session" });
    access.mockResolvedValue({ ok: true, session: { legacyRoleId: 2 } });
    const response = await POST(request());
    expect(response.status).toBe(403);
    expect(close).not.toHaveBeenCalled();
  });
  it("keeps authentication errors private", async () => {
    auth.mockReturnValue({ ok: false, response: new Response(null, { status: 401 }) });
    const response = await POST(request());
    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(close).not.toHaveBeenCalled();
  });
});
