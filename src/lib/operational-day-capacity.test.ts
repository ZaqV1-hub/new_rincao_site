import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ query: vi.fn(), occupied: vi.fn(), audit: vi.fn() }));
vi.mock("@/lib/painel-operational-catalog", () => ({
  catalogId: Number,
  withOperationalCatalogTransaction: (work: (client: { query: typeof mocks.query }) => unknown) => work({ query: mocks.query }),
}));
vi.mock("@/lib/online-capacity", () => ({ getOnlineCapacityOccupied: mocks.occupied }));
vi.mock("@/lib/ops-audit-log", () => ({ registerOpsAuditLog: mocks.audit }));
import { saveOperationalDay } from "./operational-day";
const input = { date: "2099-01-01", version: null, priceTableId: 1, dayUseOpen: false, validity: "day",
  onlineLimit: 2, ticketTypes: ["norma", "infan", "isent"], serviceIds: [], reason: "Ajustar limite" };
describe("online limit changes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.occupied.mockResolvedValue(3);
    mocks.query.mockImplementation(async (sql: string) => ({ rowCount: 1,
      rows: sql.includes("RETURNING versao") ? [{ version: 1 }] : [],
    }));
  });
  it("rejects a limit below occupied capacity under the day lock before writes", async () => {
    await expect(saveOperationalDay(input, { name: "Gerente", cpf: null })).rejects.toMatchObject({ code: "invalid_input" });
    expect(mocks.query.mock.calls[0][0]).toContain("pg_advisory_xact_lock");
    expect(mocks.occupied).toHaveBeenCalledWith(expect.anything(), "rincao", input.date);
    expect(mocks.query.mock.calls.some(([sql]) => String(sql).includes("INSERT INTO"))).toBe(false);
  });
  it("allows the exact occupied count and no limit", async () => {
    expect(await saveOperationalDay({ ...input, onlineLimit: 3 }, { name: "Gerente", cpf: null })).toMatchObject({ onlineLimit: 3 });
    mocks.occupied.mockClear();
    expect(await saveOperationalDay({ ...input, onlineLimit: null }, { name: "Gerente", cpf: null })).toMatchObject({ onlineLimit: null });
    expect(mocks.occupied).not.toHaveBeenCalled();
  });
});
