import { describe, expect, it, vi } from "vitest";
import { applyOperationalPriceTable, getOperationalDay, listOperationalDays, saveOperationalDay } from "./operational-day";

vi.mock("@/lib/ingresso-db", () => ({
  getIngressoSistemaDbPool: () => { throw new Error("Unexpected database access"); },
  getIngressoSistemaDbDialect: () => "postgres",
}));
const actor = { name: "Gerente", cpf: null };
const input = {
  date: "2099-01-01", version: null, priceTableId: 1, dayUseOpen: true,
  validity: "day", onlineLimit: null, ticketTypes: ["norma", "infan", "isent"], serviceIds: [], reason: "Configurar dia",
};

describe("operational day input boundaries", () => {
  it.each([
    { date: "2099-02-29" }, { date: "2000-01-01" }, { version: undefined }, { version: 0 },
    { priceTableId: null }, { priceTableId: "1" }, { priceTableId: 1.5 }, { dayUseOpen: "true" },
    { validity: "week" }, { onlineLimit: -1 }, { onlineLimit: 0.5 }, { onlineLimit: 2147483648 },
    { ticketTypes: ["norma", "norma"] }, { ticketTypes: ["other"] }, { ticketTypes: null },
    { serviceIds: [1, 1] }, { serviceIds: [0] }, { serviceIds: ["1"] },
    { park: "estancia" }, { actor: { name: "forged" } }, { closed: false },
    { reason: " " }, { reason: "a".repeat(1001) },
  ])("rejects invalid full configuration before touching DB %#", async (fields) => {
    await expect(saveOperationalDay({ ...input, ...fields }, actor)).rejects.toMatchObject({ code: "invalid_input" });
  });
  it.each([
    { dates: [] }, { dates: [{ date: "2000-01-01", version: null }] },
    { dates: [{ date: "2099-01-01" }] },
    { dates: [{ date: "2099-01-01", version: null }, { date: "2099-01-01", version: 1 }] },
    { dates: [{ date: "2099-01-01", version: null, actor: "forged" }] },
    { dates: Array.from({ length: 367 }, () => ({ date: "2099-01-01", version: null })) },
    { priceTableId: 0 }, { park: "estancia" }, { reason: "" },
  ])("rejects invalid batch %#", async (fields) => {
    await expect(applyOperationalPriceTable({ dates: [{ date: input.date, version: null }], priceTableId: 1, reason: "Tabela", ...fields }, actor))
      .rejects.toMatchObject({ code: "invalid_input" });
  });
  it("validates reads without rejecting historical dates", async () => {
    await expect(getOperationalDay("2026-02-30")).rejects.toMatchObject({ code: "invalid_input" });
    await expect(getOperationalDay("2000-01-01")).rejects.toThrow("Unexpected database access");
    await expect(listOperationalDays("2099-02-01", "2099-01-01")).rejects.toMatchObject({ code: "invalid_input" });
  });
});
