import { beforeEach, describe, expect, it, vi } from "vitest";
import { OperationalVoucherWhatsappError, normalizeOperationalVoucherWhatsapp } from "@/lib/operational-voucher-whatsapp";
const mock = vi.hoisted(() => ({ access: vi.fn(),send: vi.fn() }));
vi.mock("@/lib/painel-api-auth", () => ({ requirePainelApiAccess: mock.access }));
vi.mock("@/lib/operational-voucher-whatsapp", async original => ({
  ...await original<typeof import("@/lib/operational-voucher-whatsapp")>(),sendOperationalVoucherWhatsapp: mock.send,
}));
import { POST } from "./route";
const body = { voucherIds: [1,2],phoneNumber: "11987654321",destinationConfirmed: true,idempotencyKey: "request-1" };
const result = { requestId: "request",status: "queued",destinationMasked: "••••••4321",voucherIds: [1,2],message: "Solicitação enfileirada." };
const context = { params: Promise.resolve({ purchaseId: "1" }) };
const request = (value: unknown = body) => new Request("https://local.invalid/api/painel/compras/1/whatsapp",{ method: "POST",headers: { "content-type": "application/json" },body: JSON.stringify(value) });
beforeEach(() => {
  mock.access.mockReset().mockResolvedValue({ ok: true,session: { authSource: "panel",actorName: "Operador",actorCpf: "52998224725" } });
  mock.send.mockReset().mockImplementation(async (_purchaseId,input) => { normalizeOperationalVoucherWhatsapp(input); return result; });
});
describe("durable WhatsApp route", () => {
  it("requires BOTH resources and derives the actor from the panel session", async () => {
    const response = await POST(request(),context);
    expect(mock.access.mock.calls.map(call => call[1])).toEqual(["vis_compra","vis_bilhet"]);
    expect(mock.send).toHaveBeenCalledWith(1,body,{ name: "Operador",cpf: "52998224725" });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ ok: true,data: result });
  });
  it.each([401,403])("blocks the first authorization failure %s", async status => {
    mock.access.mockResolvedValueOnce({ ok: false,response: new Response(null,{ status }) });
    const response = await POST(request(),context);
    expect(response.status).toBe(status); expect(mock.access).toHaveBeenCalledOnce(); expect(mock.send).not.toHaveBeenCalled();
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
  it("does not treat vis_compra as an alternative to vis_bilhet", async () => {
    mock.access.mockResolvedValueOnce({ ok: true,session: {} }).mockResolvedValueOnce({ ok: false,response: new Response(null,{ status: 403 }) });
    expect((await POST(request(),context)).status).toBe(403); expect(mock.send).not.toHaveBeenCalled();
  });
  it.each(["0","1.5","1e2","01","9007199254740992"])("rejects unsafe path ID %s", async purchaseId => {
    const response = await POST(request(),{ params: Promise.resolve({ purchaseId }) });
    expect(response.status).toBe(400); expect(mock.send).not.toHaveBeenCalled();
    expect((await response.json()).error.code).toBe("whatsapp_invalid_input");
  });
  it.each([{ ...body,actor: { name: "forged" } },{ ...body,voucherIds: ["1"] },{ ...body,destinationConfirmed: "true" },{ ...body,phoneNumber: "invalid" }])("rejects strict JSON input %# using the domain boundary", async input => {
    const response = await POST(request(input),context);
    expect(response.status).toBe(400); expect((await response.json()).error.code).toBe("whatsapp_invalid_input");
  });
  it.each([
    () => new Request("https://local.invalid/?actor=x",{ method: "POST",headers: { "content-type": "application/json" },body: JSON.stringify(body) }),
    () => new Request("https://local.invalid/",{ method: "POST",body: JSON.stringify(body) }),
    () => new Request("https://local.invalid/",{ method: "POST",headers: { "content-type": "application/json" },body: "{" }),
    () => new Request("https://local.invalid/",{ method: "POST",headers: { "content-type": "application/json","content-length": "524289" },body: "{}" }),
    () => new Request("https://local.invalid/",{ method: "POST",headers: { "content-type": "application/json" },body: " ".repeat(524289) }),
  ])("rejects invalid media, extra query, malformed or oversized body %# before dispatch", async makeRequest => {
    const response = await POST(makeRequest(),context);
    expect(response.status).toBe(400); expect(mock.send).not.toHaveBeenCalled();
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect((await response.json()).error.code).toBe("whatsapp_invalid_input");
  });
  it("preserves conflicts and unknown infrastructure errors without exposing private payloads", async () => {
    mock.send.mockRejectedValueOnce(new OperationalVoucherWhatsappError("whatsapp_idempotency_conflict","Esta chave já pertence a outra solicitação."));
    const conflict = await POST(request(),context); expect(conflict.status).toBe(409);
    mock.send.mockRejectedValueOnce(new Error("private phone 11987654321"));
    const failure = await POST(request(),context); expect(failure.status).toBe(503);
    expect(await failure.text()).not.toContain("11987654321");
    expect(failure.headers.get("cache-control")).toBe("private, no-store");
  });
});
