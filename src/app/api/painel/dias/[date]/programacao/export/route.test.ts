import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ access: vi.fn(), get: vi.fn(), render: vi.fn(), mark: vi.fn() }));
vi.mock("@/lib/painel-api-auth", () => ({ requirePainelApiAccess: mock.access }));
vi.mock("@/lib/day-program", () => ({ getDayProgram: mock.get,markDayProgramExported: mock.mark,DayProgramError: class extends Error { constructor(readonly code: string,message: string) { super(message); } } }));
vi.mock("@/lib/day-program-export", () => ({ renderDayProgramBundle: mock.render }));
import { POST } from "./route";
import { DayProgramError } from "@/lib/day-program";
const fingerprint = "a".repeat(64);
const context = { params: Promise.resolve({ date: "2099-11-15" }) };
const request = (body: unknown = { version: 2,sourceFingerprint: fingerprint }) => new Request("https://local.test/api/painel/dias/2099-11-15/programacao/export", {
  method: "POST",headers: { "Content-Type": "application/json" },body: JSON.stringify(body),
});
beforeEach(() => {
  vi.clearAllMocks();
  mock.access.mockResolvedValue({ ok: true,session: { legacyRoleId: 1,actorName: "Gerente",actorCpf: "52998224725" } });
  mock.get.mockResolvedValue({ version: 2,sourceFingerprint: fingerprint,closed: false });
  mock.render.mockResolvedValue(Buffer.from("zip-content"));
  mock.mark.mockResolvedValue({ exportId: 7 });
});
describe("program export", () => {
  it("renders all files before recording the exact source revision with the session actor", async () => {
    mock.mark.mockImplementation(async (...args) => { expect(mock.render).toHaveBeenCalledOnce(); expect(args).toEqual(["2099-11-15",2,{ name: "Gerente",cpf: "52998224725" },{ expectedFingerprint: fingerprint,allowPast: false,reason: undefined }]); return { exportId: 7 }; });
    const response = await POST(request(),context);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/zip");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Content-Disposition")).toContain("programacao-2099-11-15-r2.zip");
    expect(await response.text()).toBe("zip-content");
  });
  it("does not mark generated when PNG/PDF rendering fails", async () => {
    mock.render.mockRejectedValueOnce(new Error("render failure"));
    expect((await POST(request(),context)).status).toBe(503);
    expect(mock.mark).not.toHaveBeenCalled();
  });
  it("does not send obsolete files when the source changes during rendering", async () => {
    mock.mark.mockRejectedValueOnce(new DayProgramError("version_conflict","Os dados mudaram."));
    const response = await POST(request(),context);
    expect(response.status).toBe(409);
    expect(response.headers.get("Content-Type")).toContain("application/json");
  });
  it("rejects a stale preview before rendering", async () => {
    expect((await POST(request({ version: 1,sourceFingerprint: fingerprint }),context)).status).toBe(409);
    expect(mock.render).not.toHaveBeenCalled();
  });
  it.each([{ version: 2,sourceFingerprint: "bad" },{ version: 2,sourceFingerprint: fingerprint,actor: "forged" },{ version: 2,sourceFingerprint: fingerprint,allowPast: true }])("rejects invalid input %j", async (body) => {
    expect((await POST(request(body),context)).status).toBe(body.allowPast ? 403 : 400);
    expect(mock.render).not.toHaveBeenCalled();
  });
  it("requires manager and client/school access", async () => {
    mock.access.mockResolvedValueOnce({ ok: true,session: { legacyRoleId: 3 } });
    expect((await POST(request(),context)).status).toBe(403);
    mock.access.mockResolvedValueOnce({ ok: true,session: { legacyRoleId: 1 } }).mockResolvedValueOnce({ ok: false,response: new Response(null,{ status: 403 }) });
    expect((await POST(request(),context)).status).toBe(403);
    expect(mock.get).not.toHaveBeenCalled();
  });
  it("rejects unauthenticated access before any data or rendering", async () => {
    mock.access.mockResolvedValueOnce({ ok: false,response: new Response(null,{ status: 401 }) });
    expect((await POST(request(),context)).status).toBe(401);
    expect(mock.get).not.toHaveBeenCalled();
  });
});
