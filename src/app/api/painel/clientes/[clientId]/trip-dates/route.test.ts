import { beforeEach, describe, expect, it, vi } from "vitest";

const runPainelClientesRoute = vi.fn();

vi.mock("@/lib/painel-clientes-route", () => ({
  runPainelClientesRoute,
}));

describe("api/painel/clientes/[clientId]/trip-dates", () => {
  beforeEach(() => {
    runPainelClientesRoute.mockReset();
  });

  it("encaminha o POST para o wrapper de rota do painel", async () => {
    runPainelClientesRoute.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );

    const { POST } = await import(
      "@/app/api/painel/clientes/[clientId]/trip-dates/route"
    );

    const request = new Request(
      "https://example.test/api/painel/clientes/248/trip-dates",
      {
        method: "POST",
        body: JSON.stringify({ datapasseio: "10/05/2026" }),
        headers: {
          "content-type": "application/json",
        },
      },
    );

    await POST(request, {
      params: Promise.resolve({ clientId: "248" }),
    });

    expect(runPainelClientesRoute).toHaveBeenCalledWith(
      request,
      { params: expect.any(Promise) },
      expect.objectContaining({
        logTag: "painel-clientes-trip-date-create-bff-failed",
      }),
    );
  });
});
