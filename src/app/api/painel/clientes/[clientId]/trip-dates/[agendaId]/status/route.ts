import {
  asPainelClientesError,
  togglePainelClientTripDateStatus,
} from "@/lib/painel-clientes";
import { runPainelClientesRoute } from "@/lib/painel-clientes-route";
import { readJsonPayload } from "@/lib/ops-route-utils";

export const runtime = "nodejs";

type TripDateStatusPayload = {
  status?: unknown;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ clientId: string; agendaId: string }> },
) {
  return runPainelClientesRoute(request, context, {
    readPayload: (incomingRequest) =>
      readJsonPayload<TripDateStatusPayload>(incomingRequest),
    run: ({ params, payload, actor }) =>
      togglePainelClientTripDateStatus({
        clientId: params.clientId,
        agendaId: params.agendaId,
        actor,
        values: payload,
      }),
    mapError: asPainelClientesError,
    logTag: "painel-clientes-trip-date-status-bff-failed",
  });
}
