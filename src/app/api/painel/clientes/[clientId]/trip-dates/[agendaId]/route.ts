import {
  asPainelClientesError,
  removePainelClientTripDate,
} from "@/lib/painel-clientes";
import { runPainelClientesRoute } from "@/lib/painel-clientes-route";

export const runtime = "nodejs";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ clientId: string; agendaId: string }> },
) {
  return runPainelClientesRoute(request, context, {
    run: ({ params }) =>
      removePainelClientTripDate({
        clientId: params.clientId,
        agendaId: params.agendaId,
      }),
    mapError: asPainelClientesError,
    logTag: "painel-clientes-trip-date-delete-bff-failed",
  });
}
