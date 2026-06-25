import {
  asPainelClientesError,
  togglePainelClientStatus,
} from "@/lib/painel-clientes";
import { readJsonPayload } from "@/lib/ops-route-utils";
import { runPainelClientesRoute } from "@/lib/painel-clientes-route";

export const runtime = "nodejs";

type ClientStatusPayload = {
  reason?: unknown;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ clientId: string }> },
) {
  return runPainelClientesRoute(request, context, {
    readPayload: (incomingRequest) =>
      readJsonPayload<ClientStatusPayload>(incomingRequest),
    run: ({ params, payload, actor }) =>
      togglePainelClientStatus({
        clientId: params.clientId,
        reason:
          typeof payload?.reason === "string" ? payload.reason.trim() : null,
        actor,
      }),
    mapError: asPainelClientesError,
    logTag: "painel-clientes-status-toggle-bff-failed",
  });
}
