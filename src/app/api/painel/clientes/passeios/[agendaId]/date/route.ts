import {
  asOpsClientTripError,
  moveOpsClientTripDate,
} from "@/lib/ops-client-trips";
import { runPainelClientesRoute } from "@/lib/painel-clientes-route";
import { readJsonPayload } from "@/lib/ops-route-utils";

export const runtime = "nodejs";

type MoveDatePayload = {
  clientId?: unknown;
  datapasseio?: unknown;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ agendaId: string }> },
) {
  return runPainelClientesRoute(request, context, {
    readPayload: (incomingRequest) => readJsonPayload<MoveDatePayload>(incomingRequest),
    run: ({ params, payload, actor }) =>
      moveOpsClientTripDate({
        agendaId: params.agendaId,
        clientId: payload?.clientId,
        tripDate: payload?.datapasseio,
        actor,
      }),
    mapError: asOpsClientTripError,
    logTag: "painel-clientes-trip-move-date-bff-failed",
  });
}
