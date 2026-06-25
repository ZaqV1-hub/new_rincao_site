import { beforeEach, describe, expect, it, vi } from "vitest";

const authorizeOpsRouteAccess = vi.fn();
const requirePainelApiAccess = vi.fn();
const readRouteParams = vi.fn();
const runOpsRoute = vi.fn();
const readRouteActor = vi.fn();

vi.mock("@/lib/ops-route-utils", () => ({
  authorizeOpsRouteAccess,
  readRouteParams,
  runOpsRoute,
  readRouteActor,
}));

vi.mock("@/lib/painel-api-auth", () => ({
  requirePainelApiAccess,
}));

describe("painel-bilheteria-route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("authorizes painel bilheteria routes with the cluster permissions", async () => {
    authorizeOpsRouteAccess.mockResolvedValue({
      ok: false,
      response: new Response(null, { status: 403 }),
    });

    const { authorizePainelBilheteriaOpsRoute } = await import(
      "@/lib/painel-bilheteria-route"
    );

    const request = new Request("https://example.com/api/painel/bilheteria");
    const result = await authorizePainelBilheteriaOpsRoute(request);

    expect(authorizeOpsRouteAccess).toHaveBeenCalledWith(request, {
      requiredPermission: "ops.purchases",
      painelPermissions: ["vis_compra", "vis_bilhet"],
    });
    expect(result).toEqual({
      ok: false,
      response: expect.any(Response),
    });
  });

  it("reads params and optional payload before delegating to runOpsRoute", async () => {
    authorizeOpsRouteAccess.mockResolvedValue({ ok: true });
    readRouteParams.mockResolvedValue({ purchaseId: "10" });
    runOpsRoute.mockImplementation(async (action: () => Promise<unknown>) => {
      const data = await action();

      return Response.json({ ok: true, data });
    });

    const { runPainelBilheteriaOpsRoute } = await import(
      "@/lib/painel-bilheteria-route"
    );

    const request = new Request("https://example.com/api/painel/bilheteria", {
      method: "POST",
      body: JSON.stringify({ amount: "99,80" }),
    });
    const response = await runPainelBilheteriaOpsRoute(
      request,
      {
        params: Promise.resolve({ purchaseId: "10" }),
      },
      {
        readPayload: async () => ({ amount: "99,80" }),
        run: async ({ params, payload }) => ({
          purchaseId: Number(params.purchaseId),
          amount: payload.amount,
        }),
        mapError: (error) => error as never,
        logTag: "test-log-tag",
      },
    );
    const body = await response.json();

    expect(readRouteParams).toHaveBeenCalledWith({
      params: expect.any(Promise),
    });
    expect(runOpsRoute).toHaveBeenCalledWith(expect.any(Function), {
      mapError: expect.any(Function),
      logTag: "test-log-tag",
    });
    expect(body).toEqual({
      ok: true,
      data: {
        purchaseId: 10,
        amount: "99,80",
      },
    });
  });

  it("injects actor data from the panel session when using painel-only routes", async () => {
    requirePainelApiAccess.mockResolvedValue({
      ok: true,
      session: {
        actorName: "Operador",
        actorCpf: "52998224725",
      },
      legacyResources: ["vis_bilhet"],
    });
    readRouteParams.mockResolvedValue({});
    readRouteActor.mockReturnValue({
      name: "Operador",
      cpf: "52998224725",
    });
    runOpsRoute.mockImplementation(async (action: () => Promise<unknown>) => {
      const data = await action();

      return Response.json({ ok: true, data });
    });

    const { runPainelBilheteriaRoute } = await import(
      "@/lib/painel-bilheteria-route"
    );
    const response = await runPainelBilheteriaRoute(
      new Request("https://example.com/api/painel/bilheteria/sales", {
        method: "POST",
        body: JSON.stringify({ agendaId: 88 }),
      }),
      {
        params: Promise.resolve({}),
      },
      {
        readPayload: async () => ({ agendaId: 88 }),
        run: async ({ payload, actor }) => ({
          agendaId: payload.agendaId,
          actor,
        }),
        mapError: (error) => error as never,
        logTag: "test-painel-log",
      },
    );
    const body = await response.json();

    expect(requirePainelApiAccess).toHaveBeenCalledWith(
      expect.any(Request),
      ["vis_compra", "vis_bilhet"],
    );
    expect(readRouteActor).toHaveBeenCalledWith({
      name: "Operador",
      cpf: "52998224725",
    });
    expect(body).toEqual({
      ok: true,
      data: {
        agendaId: 88,
        actor: {
          name: "Operador",
          cpf: "52998224725",
        },
      },
    });
  });
});
