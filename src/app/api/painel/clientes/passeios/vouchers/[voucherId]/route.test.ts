import { beforeEach, describe, expect, it, vi } from "vitest";

const runPainelClientesRoute = vi.fn();

vi.mock("@/lib/painel-clientes-route", () => ({
  runPainelClientesRoute,
}));

describe("api/painel/clientes/passeios/vouchers/[voucherId]", () => {
  beforeEach(() => {
    runPainelClientesRoute.mockReset();
    runPainelClientesRoute.mockResolvedValue(new Response("ok"));
  });

  it("encaminha o PATCH para o wrapper do painel", async () => {
    const { PATCH } = await import(
      "@/app/api/painel/clientes/passeios/vouchers/[voucherId]/route"
    );

    const request = new Request(
      "https://example.test/api/painel/clientes/passeios/vouchers/1001",
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          purchaseId: 901,
          studentName: "Ana Souza",
          educationType: "fund1",
          educationYear: "3",
          classLetter: "B",
          schoolId: 248,
          agendaId: 77,
          value: "49,90",
          purchaseStatus: "conc",
        }),
      },
    );

    await PATCH(request, {
      params: Promise.resolve({ voucherId: "1001" }),
    });

    expect(runPainelClientesRoute).toHaveBeenCalledWith(
      request,
      { params: expect.any(Promise) },
      expect.objectContaining({
        logTag: "painel-clientes-trip-voucher-bff-failed",
      }),
    );
  });
});
