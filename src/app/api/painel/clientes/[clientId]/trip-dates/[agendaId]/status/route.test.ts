import { beforeEach, describe, expect, it, vi } from "vitest";

const runPainelClientesRoute = vi.fn();

vi.mock("@/lib/painel-clientes-route", () => ({
  runPainelClientesRoute,
}));

describe("api/painel/clientes/[clientId]/trip-dates/[agendaId]/status", () => {
  beforeEach(() => {
    runPainelClientesRoute.mockReset();
  });

  it("encaminha o PATCH para o wrapper de rota do painel", async () => {
    runPainelClientesRoute.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );

    const { PATCH } = await import(
      "@/app/api/painel/clientes/[clientId]/trip-dates/[agendaId]/status/route"
    );

    const request = new Request(
      "https://example.test/api/painel/clientes/248/trip-dates/77/status",
      {
        method: "PATCH",
        body: JSON.stringify({ status: "ina" }),
        headers: {
          "content-type": "application/json",
        },
      },
    );

    await PATCH(request, {
      params: Promise.resolve({ clientId: "248", agendaId: "77" }),
    });

    expect(runPainelClientesRoute).toHaveBeenCalledWith(
      request,
      { params: expect.any(Promise) },
      expect.objectContaining({
        logTag: "painel-clientes-trip-date-status-bff-failed",
      }),
    );
  });
});
