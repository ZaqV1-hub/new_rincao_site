import { beforeEach, describe, expect, it, vi } from "vitest";
import { VoucherOperationError } from "@/lib/ops-voucher-validation-contract";
import { CashSessionError } from "@/lib/operational-cash-session";
const mock = vi.hoisted(() => ({ access: vi.fn(), validate: vi.fn(), unvalidate: vi.fn() }));
vi.mock("@/lib/painel-api-auth", () => ({ requirePainelApiAccess: mock.access }));
vi.mock("@/lib/ops-voucher-validation", async (original) => ({
  ...await original<typeof import("@/lib/ops-voucher-validation")>(),
  validateSelectedVouchers: mock.validate, unvalidateSelectedVouchers: mock.unvalidate,
}));
const actor = { name: "Operador autenticado", cpf: "52998224725" };
const result = { action: "validate", mode: "selection", processedCount: 1, affectedVoucherIds: [10], warnings: ["Aviso preservado"], message: "Registrado" };
async function call(body: unknown = { voucherIds: [10], periodId: 7 }, action = "validate", purchaseId = "42", options: { query?: string; contentType?: string; raw?: string } = {}) {
  const { POST } = await import("./route");
  return POST(new Request(`https://local.invalid/api/painel/compras/${purchaseId}/vouchers/${action}${options.query ?? ""}`, {
    method: "POST", headers: { "Content-Type": options.contentType ?? "application/json" }, body: options.raw ?? JSON.stringify(body),
  }), { params: Promise.resolve({ purchaseId, action }) });
}
describe("purchase-scoped selected voucher actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mock.access.mockResolvedValue({ ok: true, legacyResources: ["vis_compra", "vis_bilhet"], session: { authSource: "panel", actorName: actor.name, actorCpf: actor.cpf } });
    mock.validate.mockResolvedValue(result); mock.unvalidate.mockResolvedValue({ ...result, action: "unvalidate" });
  });
  it.each(["validate", "unvalidate"])("dispatches only the selected IDs with the authenticated actor and purchase scope: %s", async (action) => {
    const response = await call(undefined, action);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ ok: true, data: { ...result, action } });
    expect(action === "validate" ? mock.validate : mock.unvalidate).toHaveBeenCalledWith([10], actor, 7, 42);
    expect(action === "validate" ? mock.unvalidate : mock.validate).not.toHaveBeenCalled();
  });
  it.each([401,403])("preserves the strict panel access rejection %s", async (status) => {
    mock.access.mockResolvedValue({ ok: false, response: Response.json({ ok: false }, { status }) });
    const response = await call();
    expect(response.status).toBe(status);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(mock.access).toHaveBeenCalledWith(expect.any(Request), "vis_compra");
    expect(mock.validate).not.toHaveBeenCalled();
  });
  it("also requires bilheteria access after purchase access", async () => {
    mock.access.mockResolvedValue({ ok: true, legacyResources: ["vis_compra"], session: {} });
    const response = await call();
    expect(response.status).toBe(403); expect(mock.validate).not.toHaveBeenCalled();
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });
  it.each([
    null, [], {}, { voucherIds: [], periodId: 7 }, { voucherIds: [10,10], periodId: 7 },
    { voucherIds: ["10"], periodId: 7 }, { voucherIds: [0], periodId: 7 }, { voucherIds: [1.5], periodId: 7 },
    { voucherIds: [2147483648], periodId: 7 }, { voucherIds: [10] }, { voucherIds: [10], periodId: "7" },
    { voucherIds: [10], periodId: 0 }, { voucherIds: Array.from({ length: 1001 }, (_, i) => i + 1), periodId: 7 },
    { voucherIds: [10], periodId: 7, actor: { name: "Falso" } }, { voucherIds: [10], periodId: 7, purchaseId: 99 },
    { voucherIds: [10], periodId: 7, park: "estancia" },
  ])("rejects malformed or extra body fields %#", async (payload) => {
    const response = await call(payload);
    expect(response.status).toBe(400); expect(mock.validate).not.toHaveBeenCalled();
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });
  it.each(["0", "01", "1e2", "1.5", "2147483648"])("rejects noncanonical or unsupported purchase ID %s", async (id) => {
    expect((await call(undefined, "validate", id)).status).toBe(400); expect(mock.validate).not.toHaveBeenCalled();
  });
  it.each([
    { query: "?actor=someone" }, { contentType: "text/plain" }, { raw: "{" },
  ])("rejects invalid request transport %#", async (options) => {
    expect((await call(undefined, "validate", "42", options)).status).toBe(400); expect(mock.validate).not.toHaveBeenCalled();
  });
  it.each([undefined, "1"])("caps streamed bytes even when Content-Length is %s", async (length) => {
    const cancel = vi.fn();
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({ start(controller) {
      controller.enqueue(encoder.encode(" ".repeat(40000)));
      controller.enqueue(encoder.encode(" ".repeat(30000)));
      controller.enqueue(encoder.encode('{"voucherIds":[10],"periodId":7}'));
      controller.close();
    }, cancel });
    const { POST } = await import("./route");
    const headers = new Headers({ "Content-Type": "application/json" });
    if (length !== undefined) headers.set("Content-Length", length);
    const request = new Request("https://local.invalid/api/painel/compras/42/vouchers/validate", {
      method: "POST", headers, body: stream, duplex: "half",
    } as RequestInit);
    const response = await POST(request, { params: Promise.resolve({ purchaseId: "42", action: "validate" }) });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "invalid_operations_payload" } });
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(cancel).toHaveBeenCalledOnce(); expect(mock.validate).not.toHaveBeenCalled();
  });
  it.each([[65536, 200], [65537, 400]])("enforces the actual %i-byte boundary without a length header", async (size, status) => {
    const body = '{"voucherIds":[10],"periodId":7}';
    const response = await call(undefined, "validate", "42", { raw: body.padEnd(size, " ") });
    expect(response.status).toBe(status);
    expect(mock.validate).toHaveBeenCalledTimes(status === 200 ? 1 : 0);
  });
  it("counts UTF-8 bytes rather than string characters", async () => {
    // JSON permits duplicate keys; the last periodId keeps the decoded domain input valid.
    const body = '{"voucherIds":[10],"periodId":"' + "é".repeat(35000) + '","periodId":7}';
    expect(body.length).toBeLessThan(65536);
    expect(new TextEncoder().encode(body).byteLength).toBeGreaterThan(65536);
    expect((await call(undefined, "validate", "42", { raw: body })).status).toBe(400);
    expect(mock.validate).not.toHaveBeenCalled();
  });
  it.each([false, true])("decodes split UTF-8 strictly (malformed=%s)", async (malformed) => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({ start(controller) {
      controller.enqueue(encoder.encode('{"voucherIds":[10],"periodId":"'));
      controller.enqueue(new Uint8Array([0xc3]));
      if (!malformed) controller.enqueue(new Uint8Array([0xa9]));
      controller.enqueue(encoder.encode('","periodId":7}'));
      controller.close();
    } });
    const { POST } = await import("./route");
    const response = await POST(new Request("https://local.invalid/api/painel/compras/42/vouchers/validate", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: stream, duplex: "half",
    } as RequestInit), { params: Promise.resolve({ purchaseId: "42", action: "validate" }) });
    expect(response.status).toBe(malformed ? 400 : 200);
    expect(mock.validate).toHaveBeenCalledTimes(malformed ? 0 : 1);
  });
  it("does not expose an invalidate or arbitrary action", async () => {
    expect((await call(undefined, "invalidate")).status).toBe(400);
    expect(mock.validate).not.toHaveBeenCalled(); expect(mock.unvalidate).not.toHaveBeenCalled();
  });
  it.each([
    new VoucherOperationError("voucher_purchase_mismatch", "Seleção inválida", 409),
    new CashSessionError("cash_closed", "Caixa fechado", 409),
    new Error("private database contents"),
  ])("preserves domain failures privately without leaking unexpected details %#", async (error) => {
    mock.validate.mockRejectedValue(error);
    const response = await call(); const body = await response.json();
    expect(response.status).toBe(error instanceof VoucherOperationError || error instanceof CashSessionError ? 409 : 502);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(body.ok).toBe(false); expect(JSON.stringify(body)).not.toContain("private database contents");
  });
});
