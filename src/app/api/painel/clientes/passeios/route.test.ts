import { beforeEach, describe, expect, it, vi } from "vitest";

const runPainelClientesRoute = vi.fn();

vi.mock("@/lib/painel-clientes-route", () => ({
  runPainelClientesRoute,
}));

describe("api/painel/clientes/passeios", () => {
  beforeEach(() => {
    runPainelClientesRoute.mockReset();
  });

  it("encaminha o POST para o wrapper de rota do painel", async () => {
    runPainelClientesRoute.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );

    const { POST } = await import("@/app/api/painel/clientes/passeios/route");

    const request = new Request(
      "https://example.test/api/painel/clientes/passeios",
      {
        method: "POST",
        body: JSON.stringify({
          agendaId: 77,
          clientId: 248,
          acceptsFamily: true,
          faixas: [{ minAge: 6, maxAge: 12, value: "25.00" }],
        }),
        headers: {
          "content-type": "application/json",
        },
      },
    );

    await POST(request);

    expect(runPainelClientesRoute).toHaveBeenCalledWith(
      request,
      { params: expect.any(Promise) },
      expect.objectContaining({
        logTag: "painel-clientes-trip-create-bff-failed",
      }),
    );
  });
});
