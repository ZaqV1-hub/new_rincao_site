import { beforeEach, describe, expect, it, vi } from "vitest";

const runPainelClientesRoute = vi.fn();

vi.mock("@/lib/painel-clientes-route", () => ({
  runPainelClientesRoute,
}));

describe("api/painel/clientes", () => {
  beforeEach(() => {
    runPainelClientesRoute.mockReset();
  });

  it("encaminha o POST para o wrapper de rota do painel", async () => {
    runPainelClientesRoute.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );

    const { POST } = await import("@/app/api/painel/clientes/route");

    const request = new Request("https://example.test/api/painel/clientes", {
      method: "POST",
      body: JSON.stringify({ idtipo: 4, nome: "Cliente", status: "1" }),
      headers: {
        "content-type": "application/json",
      },
    });

    await POST(request);

    expect(runPainelClientesRoute).toHaveBeenCalledWith(
      request,
      { params: expect.any(Promise) },
      expect.objectContaining({
        logTag: "painel-clientes-create-bff-failed",
      }),
    );
  });
});
