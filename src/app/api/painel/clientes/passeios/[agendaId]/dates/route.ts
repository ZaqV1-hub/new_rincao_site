import {
  asPainelClientesError,
  listPainelTripSchoolDates,
} from "@/lib/painel-clientes";
import { runPainelClientesRoute } from "@/lib/painel-clientes-route";
import { readJsonPayload } from "@/lib/ops-route-utils";

export const runtime = "nodejs";

type TripDatesPayload = {
  clientId?: unknown;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ agendaId: string }> },
) {
  return runPainelClientesRoute(request, context, {
    readPayload: (incomingRequest) => readJsonPayload<TripDatesPayload>(incomingRequest),
    run: ({ payload }) =>
      listPainelTripSchoolDates({
        clientId: payload?.clientId,
      }),
    mapError: asPainelClientesError,
    logTag: "painel-clientes-trip-dates-bff-failed",
  });
}
