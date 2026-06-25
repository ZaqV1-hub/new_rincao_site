import { beforeEach, describe, expect, it, vi } from "vitest";

const authorizePainelClientesRoute = vi.fn();
const handleOpsTripSchoolReportRoute = vi.fn();

vi.mock("@/lib/painel-clientes-route", () => ({
  authorizePainelClientesRoute,
}));

vi.mock("@/lib/ops-trip-school-report-route", () => ({
  handleOpsTripSchoolReportRoute,
}));

describe("api/painel/clientes/passeios/[agendaId]/report", () => {
  beforeEach(() => {
    authorizePainelClientesRoute.mockReset();
    handleOpsTripSchoolReportRoute.mockReset();
    authorizePainelClientesRoute.mockResolvedValue({
      ok: true,
      session: {
        actorName: "Operador",
        actorCpf: null,
      },
    });
  });

  it("encaminha o GET para o handler de relatorio do painel", async () => {
    handleOpsTripSchoolReportRoute.mockResolvedValue(
      new Response("ok", { status: 200 }),
    );

    const { GET } = await import(
      "@/app/api/painel/clientes/passeios/[agendaId]/report/route"
    );

    const request = new Request(
      "https://example.test/api/painel/clientes/passeios/77/report?clientId=248&format=csv",
    );

    await GET(request, {
      params: Promise.resolve({ agendaId: "77" }),
    });

    expect(authorizePainelClientesRoute).toHaveBeenCalledWith(request);
    expect(handleOpsTripSchoolReportRoute).toHaveBeenCalled();
  });
});
