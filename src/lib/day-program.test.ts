import { describe, expect, it, vi } from "vitest";
import { createDayProgram, getDayPrograms, saveDayProgram, markDayProgramExported } from "./day-program";
vi.mock("@/lib/ingresso-db", () => ({ getIngressoSistemaDbPool: () => { throw new Error("Unexpected database access"); }, getIngressoSistemaDbDialect: () => "postgres" }));
const group = { agendaId: 1, clientId: 1, plannedPeople: null, contact: null, phone: null, transportMode: "client", carrierId: null, carrierContact: null, carrierPhone: null, boardingTime: null, observations: null, buses: 0, vans: 0 };
const actor = { name: "Gerente", cpf: "00000000001" };
describe("day program input boundary", () => {
  it("bounds bulk reads to unique valid dates", async () => {
    await expect(getDayPrograms([])).rejects.toMatchObject({ code: "invalid_input" });
    await expect(getDayPrograms(Array(32).fill("2099-01-01"))).rejects.toMatchObject({ code: "invalid_input" });
    await expect(getDayPrograms(["2099-01-01", "2099-01-01"])).rejects.toMatchObject({ code: "invalid_input" });
    await expect(getDayPrograms(["2026-02-30"])).rejects.toMatchObject({ code: "invalid_input" });
  });
  it("rejects invalid dates, spoofed actors, empty past reasons and invalid versions before DB", async () => {
    await expect(createDayProgram("2026-02-30", {}, actor)).rejects.toMatchObject({ code: "invalid_input" });
    await expect(createDayProgram("2099-01-01", { actor: {} }, actor)).rejects.toMatchObject({ code: "invalid_input" });
    await expect(createDayProgram("2000-01-01", { allowPast: true, reason: " " }, actor)).rejects.toMatchObject({ code: "invalid_input" });
    await expect(saveDayProgram("2099-01-01", { version: 0 }, actor)).rejects.toMatchObject({ code: "invalid_input" });
    await expect(markDayProgramExported("2099-01-01", 0, actor, { expectedFingerprint: "a".repeat(64) })).rejects.toMatchObject({ code: "invalid_input" });
  });
  it.each([{ groups: Array(201).fill({}) }, { observations: "x".repeat(2001) }, { hiringItems: Array(101).fill({}) }])("bounds payloads", async (extra) => {
    await expect(saveDayProgram("2099-01-01", { version: 1, ...extra }, actor)).rejects.toMatchObject({ code: "invalid_input" });
  });
  it.each([{ buses: -1 }, { vans: 101 }, { boardingTime: "24:00" }, { plannedPeople: 0.5 }, { phone: "x".repeat(41) }, { carrierContact: "x".repeat(161) }, { carrierPhone: "x".repeat(41) },
    { transportMode: "carrier" }, { transportMode: "client", carrierId: 1 }, { carrier: { name: " ", contact: null, phone: null } }])("rejects invalid operational group fields", async (extra) => {
    await expect(saveDayProgram("2099-01-01", { version: 1, groups: [{ ...group, ...extra }] }, actor)).rejects.toMatchObject({ code: "invalid_input" });
  });
  it("rejects duplicate group identities and hiring items", async () => {
    await expect(saveDayProgram("2099-01-01", { version: 1, groups: [group, group] }, actor)).rejects.toMatchObject({ code: "invalid_input" });
    await expect(saveDayProgram("2099-01-01", { version: 1, hiringItems: [{ id: 1, value: "Ana" }, { id: 1, value: null }] }, actor)).rejects.toMatchObject({ code: "invalid_input" });
  });
});
