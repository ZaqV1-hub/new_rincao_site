import { beforeEach, describe, expect, it, vi } from "vitest";

const runPainelClientesRoute = vi.fn();

vi.mock("@/lib/painel-clientes-route", () => ({
  runPainelClientesRoute,
}));

describe("api/painel/clientes/passeios/[agendaId]", () => {
  beforeEach(() => {
    runPainelClientesRoute.mockReset();
  });

  it("encaminha o DELETE para o wrapper de rota do painel", async () => {
    runPainelClientesRoute.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );

    const { DELETE } = await import(
      "@/app/api/painel/clientes/passeios/[agendaId]/route"
    );

    const request = new Request(
      "https://example.test/api/painel/clientes/passeios/77",
      {
        method: "DELETE",
        body: JSON.stringify({ clientId: 248 }),
        headers: {
          "content-type": "application/json",
        },
      },
    );

    await DELETE(request, {
      params: Promise.resolve({ agendaId: "77" }),
    });

    expect(runPainelClientesRoute).toHaveBeenCalledWith(
      request,
      { params: expect.any(Promise) },
      expect.objectContaining({
        logTag: "painel-clientes-trip-unlink-bff-failed",
      }),
    );
  });
});
