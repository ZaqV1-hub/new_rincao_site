import {
  asPainelClientesError,
  removePainelClient,
  updatePainelClient,
} from "@/lib/painel-clientes";
import { runPainelClientesRoute } from "@/lib/painel-clientes-route";
import { readJsonPayload } from "@/lib/ops-route-utils";

export const runtime = "nodejs";

type ClientPayload = {
  idtipo?: unknown;
  nome?: unknown;
  status?: unknown;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ clientId: string }> },
) {
  return runPainelClientesRoute(request, context, {
    readPayload: (incomingRequest) => readJsonPayload<ClientPayload>(incomingRequest),
    run: ({ params, payload }) =>
      updatePainelClient({
        clientId: params.clientId,
        values: payload,
      }),
    mapError: asPainelClientesError,
    logTag: "painel-clientes-update-bff-failed",
  });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ clientId: string }> },
) {
  return runPainelClientesRoute(request, context, {
    run: ({ params }) =>
      removePainelClient({
        clientId: params.clientId,
      }),
    mapError: asPainelClientesError,
    logTag: "painel-clientes-delete-bff-failed",
  });
}
