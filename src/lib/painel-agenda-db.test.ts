import { beforeEach, describe, expect, it, vi } from "vitest";

const { auditLog, legacyQuery, systemClient, systemQuery } = vi.hoisted(() => ({
  auditLog: vi.fn(),
  legacyQuery: vi.fn(),
  systemClient: {
    query: vi.fn(),
    release: vi.fn(),
  },
  systemQuery: vi.fn(),
}));

vi.mock("@/lib/ops-audit-log", () => ({
  registerOpsAuditLog: auditLog,
}));

vi.mock("@/lib/ingresso-db", () => ({
  getIngressoDbPool: () => ({
    query: legacyQuery,
  }),
  getIngressoSistemaDbPool: () => ({
    connect: vi.fn(async () => systemClient),
    query: systemQuery,
  }),
}));

describe("painel-agenda database routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auditLog.mockResolvedValue(undefined);
    legacyQuery.mockResolvedValue({ rows: [] });
    systemClient.query.mockResolvedValue({ rows: [] });
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

  it("writes agenda changes through the sistema database and audits as postgres", async () => {
    const { upsertPainelAgendaRange } = await import("@/lib/painel-agenda");

    await upsertPainelAgendaRange({
      startDate: "2026-07-18",
      endDate: "2026-07-18",
      priceTableId: 1,
      informationId: 1,
      type: "padra",
      status: "abe",
      reason: "Teste local",
      actor: {
        name: "Operador",
      },
    });

    expect(systemQuery).toHaveBeenCalledWith(
      expect.stringContaining("FROM agenda"),
      ["2026-07-18", "2026-07-18", null],
    );
    expect(systemClient.query).toHaveBeenCalledWith("BEGIN");
    expect(systemClient.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO agenda"),
      ["2026-07-18", 1, 1, "padra", "abe", null, null],
    );
    expect(auditLog).toHaveBeenCalledWith(
      systemClient,
      expect.objectContaining({
        origem: "painel-agenda",
        acao: "upsert_range",
      }),
      "postgres",
    );
    expect(systemClient.query).toHaveBeenCalledWith("COMMIT");
    expect(legacyQuery).not.toHaveBeenCalled();
  });

  it("skips non-standard dates when applying a range from the admin agenda", async () => {
    systemQuery.mockResolvedValueOnce({
      rows: [
        { dtagenda: "2026-08-08", tpagenda: "promo" },
        { dtagenda: "2026-08-09", tpagenda: "padra" },
      ],
    });
    systemClient.query.mockImplementation(async (sql: string) => {
      if (sql.includes("SELECT idagenda")) {
        return {
          rows: [
            { idagenda: 10, dtagenda: "2026-08-08", tpagenda: "promo" },
            { idagenda: 11, dtagenda: "2026-08-09", tpagenda: "padra" },
          ],
        };
      }

      return { rows: [] };
    });

    const { upsertPainelAgendaRange } = await import("@/lib/painel-agenda");

    const result = await upsertPainelAgendaRange({
      startDate: "2026-08-08",
      endDate: "2026-08-09",
      priceTableId: 7,
      informationId: 1,
      type: "padra",
      status: "abe",
      confirmOverwrite: true,
      reason: "Teste local",
      actor: {
        name: "Operador",
      },
    });

    const updateCalls = systemClient.query.mock.calls.filter(([sql]) =>
      String(sql).includes("UPDATE agenda"),
    );

    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0]?.[1]).toEqual([7, 1, "padra", "abe", null, null, 11]);
    expect(result.touchedDates).toEqual(["2026-08-09"]);
    expect(auditLog).toHaveBeenCalledWith(
      systemClient,
      expect.objectContaining({
        detalhes: expect.objectContaining({
          overwrittenDates: ["2026-08-09"],
          skippedDates: ["2026-08-08"],
        }),
      }),
      "postgres",
    );
  });
});
