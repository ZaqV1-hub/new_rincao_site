import { beforeEach, describe, expect, it, vi } from "vitest";

const { query } = vi.hoisted(() => ({
  query: vi.fn(),
}));

vi.mock("@/lib/ingresso-db", () => ({
  getIngressoDbPool: () => ({
    query,
  }),
}));

describe("agenda-repository SQL timezone rules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    query.mockResolvedValue({ rows: [] });
  });

  it("uses the Sao Paulo business date when listing public agenda events", async () => {
    const { getPublicAgendaEvents } = await import("@/lib/agenda-repository");

    await getPublicAgendaEvents(6, 2026);

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining(
        "agenda.dtagenda >= (now() AT TIME ZONE 'America/Sao_Paulo')::date",
      ),
      [6, 2026],
    );
  });

  it("uses the Sao Paulo business date when loading same-day reservation details", async () => {
    const { getPublicAgendaReservationById } = await import("@/lib/agenda-repository");

    await getPublicAgendaReservationById(44);

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining(
        "agenda.dtagenda >= (now() AT TIME ZONE 'America/Sao_Paulo')::date",
      ),
      [44],
    );
  });
});
