import {
  addPainelClientTripDate,
  asPainelClientesError,
} from "@/lib/painel-clientes";
import { runPainelClientesRoute } from "@/lib/painel-clientes-route";
import { readJsonPayload } from "@/lib/ops-route-utils";

export const runtime = "nodejs";

type TripDatePayload = {
  datapasseio?: unknown;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ clientId: string }> },
) {
  return runPainelClientesRoute(request, context, {
    readPayload: (incomingRequest) => readJsonPayload<TripDatePayload>(incomingRequest),
    run: ({ params, payload, actor }) =>
      addPainelClientTripDate({
        clientId: params.clientId,
        actor,
        values: payload,
      }),
    mapError: asPainelClientesError,
    logTag: "painel-clientes-trip-date-create-bff-failed",
  });
}
