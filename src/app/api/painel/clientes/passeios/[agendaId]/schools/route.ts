import {
  asPainelClientesError,
  listPainelTripSchools,
} from "@/lib/painel-clientes";
import { runPainelClientesRoute } from "@/lib/painel-clientes-route";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ agendaId: string }> },
) {
  return runPainelClientesRoute(request, context, {
    run: ({ params }) =>
      listPainelTripSchools({
        agendaId: params.agendaId,
      }),
    mapError: asPainelClientesError,
    logTag: "painel-clientes-trip-schools-bff-failed",
  });
}
