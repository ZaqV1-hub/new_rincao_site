import { describe, expect, it, vi } from "vitest";
import { closeCashSession, createCashSessionMovement, listCashSessions, openCashSession } from "./operational-cash-session";

vi.mock("@/lib/painel-operational-catalog", () => ({ getOperationalCatalogPool: () => { throw new Error("Invalid input reached database"); } }));
const actor = { name: "Operador", cpf: "00000000001" };
const opening = { date: "2026-11-12", locationId: 1, openingCashCents: 0, idempotencyKey: "open-1" };

describe("cash session input boundaries", () => {
  it.each([-1, 0.1, NaN, Infinity, 10000000000, "100"])("rejects invalid opening cents %s before connecting", async (openingCashCents) => {
    await expect(openCashSession({ ...opening, openingCashCents: openingCashCents as number }, actor)).rejects.toMatchObject({ code: "invalid_input", status: 400 });
  });
  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])( "rejects unsafe location identity %s", async (locationId) => {
    await expect(openCashSession({ ...opening, locationId }, actor)).rejects.toMatchObject({ code: "invalid_input" });
  });
  it("rejects impossible dates, missing keys, absent actors and oversized movement fields", async () => {
    await expect(listCashSessions("2026-02-30")).rejects.toMatchObject({ code: "invalid_input" });
    await expect(openCashSession({ ...opening, idempotencyKey: "" }, actor)).rejects.toMatchObject({ code: "invalid_input" });
    await expect(openCashSession(opening, { name: null, cpf: null })).rejects.toMatchObject({ code: "invalid_input" });
    await expect(createCashSessionMovement({ periodId: 1, type: "fundo", responsible: "x".repeat(101), amountCents: 100, reason: "Reforço", idempotencyKey: "fund" }, actor)).rejects.toMatchObject({ code: "invalid_input" });
    await expect(createCashSessionMovement({ periodId: 1, type: "fundo", responsible: "Operador", amountCents: 0, reason: "Reforço", idempotencyKey: "fund" }, actor)).rejects.toMatchObject({ code: "invalid_input" });
  });
  it("does not permit uncounted or negative manual closing", async () => {
    for (const countedCashCents of [null, -1, 1.5]) await expect(closeCashSession({ periodId: 1, countedCashCents: countedCashCents as number, reason: "Fim do turno", idempotencyKey: "close" }, actor)).rejects.toMatchObject({ code: "invalid_input", status: 400 });
  });
});
