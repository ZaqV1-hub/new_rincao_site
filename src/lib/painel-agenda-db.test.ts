import { beforeEach, describe, expect, it, vi } from "vitest";

const { legacyQuery, systemQuery } = vi.hoisted(() => ({
  legacyQuery: vi.fn(),
  systemQuery: vi.fn(),
}));

vi.mock("@/lib/ingresso-db", () => ({
  getIngressoDbPool: () => ({
    query: legacyQuery,
  }),
  getIngressoSistemaDbPool: () => ({
    query: systemQuery,
  }),
}));

describe("painel-agenda database routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    legacyQuery.mockResolvedValue({ rows: [] });
    systemQuery.mockResolvedValue({ rows: [] });
  });

  it("lists painel agenda dates from the sistema database", async () => {
    const { listPainelAgendaMonth } = await import("@/lib/painel-agenda");

    await listPainelAgendaMonth(7, 2026);

    expect(systemQuery).toHaveBeenCalledWith(expect.stringContaining("FROM agenda"), [
      7,
      2026,
    ]);
    expect(legacyQuery).not.toHaveBeenCalled();
  });
});
