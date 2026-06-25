import { beforeEach, describe, expect, it, vi } from "vitest";

const runPainelClientesRoute = vi.fn();

vi.mock("@/lib/painel-clientes-route", () => ({
  runPainelClientesRoute,
}));

describe("api/painel/clientes/passeios/[agendaId]/dates", () => {
  beforeEach(() => {
    runPainelClientesRoute.mockReset();
    runPainelClientesRoute.mockResolvedValue(new Response("ok"));
  });

  it("encaminha o POST para o wrapper do painel", async () => {
    const { POST } = await import(
      "@/app/api/painel/clientes/passeios/[agendaId]/dates/route"
    );

    const request = new Request(
      "https://example.test/api/painel/clientes/passeios/77/dates",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ clientId: 248 }),
      },
    );

    await POST(request, {
      params: Promise.resolve({ agendaId: "77" }),
    });

    expect(runPainelClientesRoute).toHaveBeenCalledWith(
      request,
      { params: expect.any(Promise) },
      expect.objectContaining({
        logTag: "painel-clientes-trip-dates-bff-failed",
      }),
    );
  });
});
