import {
  asOpsClientTripError,
  createOpsClientTrip,
} from "@/lib/ops-client-trips";
import { runPainelClientesRoute } from "@/lib/painel-clientes-route";
import { readJsonPayload } from "@/lib/ops-route-utils";

export const runtime = "nodejs";

type ClientTripPayload = {
  agendaId?: unknown;
  clientId?: unknown;
  acceptsFamily?: unknown;
  faixas?: unknown;
};

export async function POST(request: Request) {
  return runPainelClientesRoute(request, { params: Promise.resolve({}) }, {
    readPayload: (incomingRequest) => readJsonPayload<ClientTripPayload>(incomingRequest),
    run: ({ payload, actor }) =>
      createOpsClientTrip({
        agendaId: payload?.agendaId,
        clientId: payload?.clientId,
        acceptsFamily: payload?.acceptsFamily,
        faixas: payload?.faixas,
        actor,
      }),
    mapError: asOpsClientTripError,
    logTag: "painel-clientes-trip-create-bff-failed",
  });
}
