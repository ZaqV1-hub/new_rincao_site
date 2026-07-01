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

describe("agenda-repository SQL timezone rules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    legacyQuery.mockResolvedValue({ rows: [] });
    systemQuery.mockResolvedValue({ rows: [] });
  });

  it("uses the Sao Paulo business date when listing public agenda events", async () => {
    const { getPublicAgendaEvents } = await import("@/lib/agenda-repository");

    await getPublicAgendaEvents(6, 2026);

    expect(systemQuery).toHaveBeenCalledWith(
      expect.stringContaining(
        "agenda.dtagenda >= (now() AT TIME ZONE 'America/Sao_Paulo')::date",
      ),
      [6, 2026],
    );
    expect(legacyQuery).not.toHaveBeenCalled();
  });

  it("uses the Sao Paulo business date when loading same-day reservation details", async () => {
    const { getPublicAgendaReservationById } = await import("@/lib/agenda-repository");

    await getPublicAgendaReservationById(44);

    expect(systemQuery).toHaveBeenCalledWith(
      expect.stringContaining(
        "agenda.dtagenda >= (now() AT TIME ZONE 'America/Sao_Paulo')::date",
      ),
      [44],
    );
    expect(legacyQuery).not.toHaveBeenCalled();
  });
});
