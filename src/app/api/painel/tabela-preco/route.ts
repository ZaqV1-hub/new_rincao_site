import {
  asPainelTabelaPrecoError,
  createPainelTabelaPreco,
} from "@/lib/painel-tabela-preco";
import { readJsonPayload } from "@/lib/ops-route-utils";
import { runPainelTabelaPrecoRoute } from "@/lib/painel-tabela-preco-route";

export const runtime = "nodejs";

type TabelaPrecoPayload = {
  nmtabpreco?: unknown;
  vlnormal?: unknown;
  vlinfant?: unknown;
  vlnormalbil?: unknown;
  vlinfantbil?: unknown;
};

export async function POST(request: Request) {
  return runPainelTabelaPrecoRoute(request, { params: Promise.resolve({}) }, {
    readPayload: (incomingRequest) =>
      readJsonPayload<TabelaPrecoPayload>(incomingRequest),
    run: ({ payload }) =>
      createPainelTabelaPreco({
        nmtabpreco: typeof payload?.nmtabpreco === "string" ? payload.nmtabpreco : "",
        vlnormal: typeof payload?.vlnormal === "string" ? payload.vlnormal : "",
        vlinfant: typeof payload?.vlinfant === "string" ? payload.vlinfant : "",
        vlnormalbil:
          typeof payload?.vlnormalbil === "string" ? payload.vlnormalbil : "",
        vlinfantbil:
          typeof payload?.vlinfantbil === "string" ? payload.vlinfantbil : "",
      }),
    mapError: asPainelTabelaPrecoError,
    logTag: "painel-tabela-preco-create-bff-failed",
  });
}
