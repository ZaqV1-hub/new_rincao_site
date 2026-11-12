import { beforeEach, describe, expect, it, vi } from "vitest";
import { prepareStoredCashCommand, readStoredCashCommand, submitCashCommand } from "./cash-command-client";
const memory = new Map<string, string>();
const fetchMock = vi.fn();
beforeEach(() => {
  memory.clear(); fetchMock.mockReset();
  vi.stubGlobal("sessionStorage", { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => memory.set(key, value), removeItem: (key: string) => memory.delete(key) });
  vi.stubGlobal("fetch", fetchMock);
});
describe("cash command immutable client attempts", () => {
  it("snapshots before sending, replays exactly after loss and isolates periods", async () => {
    const payload = { periodId: 4, payments: [{ method: "pix", value: "10.00" }] };
    const prepared = prepareStoredCashCommand("sale:4", payload);
    payload.payments[0].value = "20.00";
    expect(readStoredCashCommand("sale:4")?.payload.payments).toEqual([{ method: "pix", value: "10.00" }]);
    expect(prepareStoredCashCommand("sale:5", { periodId: 5 }).idempotencyKey).not.toBe(prepared.idempotencyKey);
    fetchMock.mockRejectedValueOnce(new Error("network"));
    expect(await submitCashCommand({ storageKey: "sale:4", url: "/sale" })).toMatchObject({ ok: false, uncertain: true });
    fetchMock.mockResolvedValueOnce(Response.json({ ok: true, data: { purchaseId: 8 } }));
    expect(await submitCashCommand({ storageKey: "sale:4", url: "/sale" })).toEqual({ ok: true, data: { purchaseId: 8 } });
    expect(fetchMock.mock.calls[0][1].body).toBe(fetchMock.mock.calls[1][1].body);
    expect(readStoredCashCommand("sale:4")).toBeNull(); expect(readStoredCashCommand("sale:5")).not.toBeNull();
  });
  it("rejects changed payload without sending the old or new cart", async () => {
    prepareStoredCashCommand("sale", { total: 10 });
    expect(await submitCashCommand({ storageKey: "sale", url: "/sale", payload: { total: 20 } })).toMatchObject({ ok: false, uncertain: true });
    expect(fetchMock).not.toHaveBeenCalled(); expect(readStoredCashCommand("sale")?.payload).toEqual({ total: 10 });
  });
  it.each([500, 502, 200, 409])("retains an ambiguous response %s", async (status) => {
    fetchMock.mockResolvedValue(new Response("not JSON", { status }));
    expect(await submitCashCommand({ storageKey: "sale", url: "/sale", payload: { periodId: 4 } })).toMatchObject({ ok: false, uncertain: true });
    expect(readStoredCashCommand("sale")).not.toBeNull();
  });
  it("clears a definitive rejection and allocates a new key for the corrected attempt", async () => {
    const first = prepareStoredCashCommand("sale", { periodId: 4 });
    fetchMock.mockResolvedValue(Response.json({ ok: false, error: { message: "Caixa fechado" } }, { status: 409 }));
    expect(await submitCashCommand({ storageKey: "sale", url: "/sale" })).toEqual({ ok: false, uncertain: false, message: "Caixa fechado" });
    expect(prepareStoredCashCommand("sale", { periodId: 5 }).idempotencyKey).not.toBe(first.idempotencyKey);
  });
  it("fails closed on corrupt or inaccessible storage", async () => {
    memory.set("sale", "bad JSON");
    expect(() => readStoredCashCommand("sale")).toThrow();
    expect(await submitCashCommand({ storageKey: "sale", url: "/sale", payload: {} })).toMatchObject({ uncertain: true });
    expect(memory.get("sale")).toBe("bad JSON"); expect(fetchMock).not.toHaveBeenCalled();
    vi.stubGlobal("sessionStorage", { getItem() { throw new Error("denied"); } });
    expect(await submitCashCommand({ storageKey: "sale", url: "/sale", payload: {} })).toMatchObject({ uncertain: true });
  });
});
