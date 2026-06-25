import {
  asOpsClientTripError,
  unlinkOpsClientTrip,
  updateOpsClientTrip,
} from "@/lib/ops-client-trips";
import { runPainelClientesRoute } from "@/lib/painel-clientes-route";
import { readJsonPayload } from "@/lib/ops-route-utils";

export const runtime = "nodejs";

type ClientTripPayload = {
  clientId?: unknown;
  acceptsFamily?: unknown;
  faixas?: unknown;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ agendaId: string }> },
) {
  return runPainelClientesRoute(request, context, {
    readPayload: (incomingRequest) => readJsonPayload<ClientTripPayload>(incomingRequest),
    run: ({ params, payload, actor }) =>
      updateOpsClientTrip({
        agendaId: params.agendaId,
        clientId: payload?.clientId,
        acceptsFamily: payload?.acceptsFamily,
        faixas: payload?.faixas,
        actor,
      }),
    mapError: asOpsClientTripError,
    logTag: "painel-clientes-trip-update-bff-failed",
  });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ agendaId: string }> },
) {
  return runPainelClientesRoute(request, context, {
    readPayload: (incomingRequest) => readJsonPayload<ClientTripPayload>(incomingRequest),
    run: ({ params, payload, actor }) =>
      unlinkOpsClientTrip({
        agendaId: params.agendaId,
        clientId: payload?.clientId,
        actor,
      }),
    mapError: asOpsClientTripError,
    logTag: "painel-clientes-trip-unlink-bff-failed",
  });
}
