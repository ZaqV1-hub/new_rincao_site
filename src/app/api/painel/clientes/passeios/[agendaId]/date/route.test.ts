import { beforeEach, describe, expect, it, vi } from "vitest";

const runPainelClientesRoute = vi.fn();

vi.mock("@/lib/painel-clientes-route", () => ({
  runPainelClientesRoute,
}));

describe("api/painel/clientes/passeios/[agendaId]/date", () => {
  beforeEach(() => {
    runPainelClientesRoute.mockReset();
  });

  it("encaminha o POST para o wrapper de rota do painel", async () => {
    runPainelClientesRoute.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );

    const { POST } = await import(
      "@/app/api/painel/clientes/passeios/[agendaId]/date/route"
    );

    const request = new Request(
      "https://example.test/api/painel/clientes/passeios/77/date",
      {
        method: "POST",
        body: JSON.stringify({ clientId: 248, datapasseio: "15/05/2026" }),
        headers: {
          "content-type": "application/json",
        },
      },
    );

    await POST(request, {
      params: Promise.resolve({ agendaId: "77" }),
    });

    expect(runPainelClientesRoute).toHaveBeenCalledWith(
      request,
      { params: expect.any(Promise) },
      expect.objectContaining({
        logTag: "painel-clientes-trip-move-date-bff-failed",
      }),
    );
  });
});
