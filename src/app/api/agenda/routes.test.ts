import { beforeEach, describe, expect, it, vi } from "vitest";

const getPublicAgendaEvents = vi.fn();
const getPublicAgendaEventById = vi.fn();

vi.mock("@/lib/agenda-repository", () => ({
  getPublicAgendaEvents,
  getPublicAgendaEventById,
}));

describe("agenda BFF routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns normalized public agenda payload", async () => {
    const events = [
      {
        id: 10,
        legacyEncodedId: "MTA=",
        date: "2026-07-25",
        day: 25,
        month: 7,
        year: 2026,
        type: "padra",
        status: "abe",
        statusLabel: "Aberto",
        priceTable: null,
        promotional: {
          name: null,
          description: null,
        },
      },
    ];
    getPublicAgendaEvents.mockResolvedValue(events);

    const { GET } = await import("@/app/api/agenda/publica/route");
    const response = await GET(
      new Request("https://example.com/api/agenda/publica?mes=7&ano=2026"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(getPublicAgendaEvents).toHaveBeenCalledWith(7, 2026);
    expect(body).toEqual({
      ok: true,
      data: {
        month: 7,
        year: 2026,
        events,
      },
    });
  });

  it("rejects invalid month and year", async () => {
    const { GET } = await import("@/app/api/agenda/publica/route");
    const response = await GET(
      new Request("https://example.com/api/agenda/publica?mes=13&ano=2010"),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      ok: false,
      error: {
        code: "invalid_month_year",
        message: "Informe mes e ano validos para consultar a agenda publica.",
      },
    });
  });

  it("accepts base64 legacy ids on agenda detail", async () => {
    const event = {
      id: 123,
      legacyEncodedId: "MTIz",
      date: "2026-01-01",
      day: 1,
      month: 1,
      year: 2026,
      type: "padra",
      status: "abe",
      statusLabel: "Aberto",
      priceTable: null,
      promotional: {
        name: null,
        description: null,
      },
    };
    getPublicAgendaEventById.mockResolvedValue(event);

    const { GET } = await import("@/app/api/agenda/[id]/route");
    const response = await GET(new Request("https://example.com/api/agenda/MTIz"), {
      params: Promise.resolve({ id: "MTIz" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(getPublicAgendaEventById).toHaveBeenCalledWith(123);
    expect(body).toEqual({
      ok: true,
      data: event,
    });
  });

  it("accepts percent-encoded base64 legacy ids on agenda detail", async () => {
    const event = {
      id: 2283,
      legacyEncodedId: "MjI4Mw==",
      date: "2026-04-25",
      day: 25,
      month: 4,
      year: 2026,
      type: "padra",
      status: "abe",
      statusLabel: "Aberto",
      priceTable: null,
      promotional: {
        name: null,
        description: null,
      },
    };
    getPublicAgendaEventById.mockResolvedValue(event);

    const { GET } = await import("@/app/api/agenda/[id]/route");
    const response = await GET(
      new Request("https://example.com/api/agenda/MjI4Mw%3D%3D"),
      {
        params: Promise.resolve({ id: "MjI4Mw%3D%3D" }),
      },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(getPublicAgendaEventById).toHaveBeenCalledWith(2283);
    expect(body).toEqual({
      ok: true,
      data: event,
    });
  });

  it("normalizes invalid agenda detail ids", async () => {
    const { GET } = await import("@/app/api/agenda/[id]/route");
    const response = await GET(new Request("https://example.com/api/agenda/xxx"), {
      params: Promise.resolve({ id: "xxx" }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      ok: false,
      error: {
        code: "invalid_agenda_id",
        message: "Informe um identificador de agenda valido.",
      },
    });
  });
});
