import {
  asPainelClientesError,
  createPainelClient,
} from "@/lib/painel-clientes";
import { readJsonPayload } from "@/lib/ops-route-utils";
import { runPainelClientesRoute } from "@/lib/painel-clientes-route";

export const runtime = "nodejs";

type ClientPayload = {
  idtipo?: unknown;
  nome?: unknown;
  status?: unknown;
};

export async function POST(request: Request) {
  return runPainelClientesRoute(request, { params: Promise.resolve({}) }, {
    readPayload: (incomingRequest) => readJsonPayload<ClientPayload>(incomingRequest),
    run: ({ payload }) =>
      createPainelClient({
        values: payload,
      }),
    mapError: asPainelClientesError,
    logTag: "painel-clientes-create-bff-failed",
  });
}
