import { describe, expect, it, vi } from "vitest";
import { getOperationalDaySummary, readOperationalDaySummary } from "./operational-day-summary";
vi.mock("@/lib/ingresso-db", () => ({ getIngressoSistemaDbPool: () => { throw new Error("Unexpected database access"); }, getIngressoSistemaDbDialect: () => "postgres" }));
const client = { query: vi.fn(() => { throw new Error("Unexpected query"); }) };
describe("operational summary trust boundary", () => {
  it.each(["2026-02-30", "2026-1-01", "2026-01-01T00:00:00Z", "0000-01-01"])("rejects invalid date %s before opening a connection", async (date) => {
    await expect(getOperationalDaySummary(date)).rejects.toMatchObject({ code: "invalid_input" });
  });
  it("does not label the current legacy database as a different park", async () => {
    vi.stubEnv("OPERATIONAL_PARK_ID", "rincao");
    try { await expect(readOperationalDaySummary(client as never, "2099-01-01", "estancia")).rejects.toMatchObject({ code: "park_forbidden" }); }
    finally { vi.unstubAllEnvs(); }
  });
});
