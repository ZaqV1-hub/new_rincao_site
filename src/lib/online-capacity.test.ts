import { describe, expect, it, vi } from "vitest";
import { assertOnlineCapacityReleased, assertOnlineCapacityAvailable, beginOnlinePaymentAttempt, reconcileOnlineCapacity } from "@/lib/online-capacity";
import type { QueryClient } from "@/lib/payment-reconciliation-contract";

function database(overrides: Record<string, unknown> = {}, occupied = 0) {
  const context = { park: "rincao", date: "2099-07-20", quantity: 2, active: false, unexpired: true, deliveryHold: false, status: "pend", onlineLimit: 2, ...overrides };
  const query = vi.fn(async (sql: string) => {
    if (sql.includes("SUM(")) return { rows: [{ occupied }], rowCount: 1 };
    if (sql.includes("FROM online_capacity_reservations")) return { rows: [context], rowCount: 1 };
    if (sql.includes("FROM operacao_dias")) return { rows: [{ onlineLimit: context.onlineLimit }], rowCount: 1 };
    return { rows: [], rowCount: 1 };
  });
  return { client: { query } as unknown as QueryClient, query, context };
}

describe("online day-use capacity", () => {
  it.each([[null, 100, true], [0, 0, false], [3, 1, true], [3, 2, false]] as const)("limit %s with %s occupied", async (onlineLimit, occupied, allowed) => {
    const { client } = database({}, occupied);
    const promise = assertOnlineCapacityAvailable(client, { park: "rincao", date: "2099-07-20", onlineLimit }, 2);
    if (allowed) await expect(promise).resolves.toBeUndefined();
    else await expect(promise).rejects.toMatchObject({ code: "online_capacity_exceeded" });
  });
  it("blocks delivery while preserving paid state", async () => {
    const { client, query } = database({ deliveryHold: true, status: "conc" });
    await expect(assertOnlineCapacityReleased(client, 1)).rejects.toThrow("online_capacity_delivery_hold");
    expect(query.mock.calls.some(([sql]) => sql.includes("UPDATE compra"))).toBe(false);
  });
  it("does not start an expired checkout", async () => {
    const { client, query } = database({ unexpired: false });
    await expect(beginOnlinePaymentAttempt(client, 1)).rejects.toMatchObject({ code: "online_capacity_expired" });
    expect(query.mock.calls.some(([sql]) => sql.includes("UPDATE online_capacity_reservations"))).toBe(false);
    expect(query).toHaveBeenCalledWith("ROLLBACK");
  });
  it("commits attempt marker before returning to gateway caller", async () => {
    const { client, query } = database({ active: true });
    await beginOnlinePaymentAttempt(client, 1);
    const calls = query.mock.calls.map(([sql]) => sql);
    expect(calls.findIndex((sql) => sql.includes("pg_advisory_xact_lock"))).toBeLessThan(calls.findIndex((sql) => sql.includes("FOR UPDATE OF compra")));
    expect(calls.findIndex((sql) => sql.includes("attempt_started_at ="))).toBeLessThan(calls.indexOf("COMMIT"));
  });
  it("holds a late payment when its released seats were sold", async () => {
    const { client, query, context } = database({}, 2);
    await expect(reconcileOnlineCapacity(client, 1, "conc", context as never)).resolves.toBe(true);
    expect(query.mock.calls.some(([sql]) => sql.includes("UPDATE compra"))).toBe(false);
    expect(query.mock.calls.some(([sql]) => sql.includes("hold_reason"))).toBe(true);
  });
  it("reacquires a released reservation if there is room", async () => {
    const { client, context } = database({}, 0);
    await expect(reconcileOnlineCapacity(client, 1, "conc", context as never)).resolves.toBe(false);
  });
  it("retains an uncertain active payment without reacquiring its own seats", async () => {
    const { client, query, context } = database({ active: true }, 2);
    await expect(reconcileOnlineCapacity(client, 1, "conc", context as never)).resolves.toBe(false);
    expect(query.mock.calls.some(([sql]) => sql.includes("SUM("))).toBe(false);
  });
});
