import {
  asPainelTabelaPrecoError,
  updatePainelTabelaPreco,
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
  sttabpreco?: unknown;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return runPainelTabelaPrecoRoute(request, context, {
    readPayload: (incomingRequest) =>
      readJsonPayload<TabelaPrecoPayload>(incomingRequest),
    run: ({ params, payload }) =>
      updatePainelTabelaPreco(params.id, {
        nmtabpreco: typeof payload?.nmtabpreco === "string" ? payload.nmtabpreco : "",
        vlnormal: typeof payload?.vlnormal === "string" ? payload.vlnormal : "",
        vlinfant: typeof payload?.vlinfant === "string" ? payload.vlinfant : "",
        vlnormalbil:
          typeof payload?.vlnormalbil === "string" ? payload.vlnormalbil : "",
        vlinfantbil:
          typeof payload?.vlinfantbil === "string" ? payload.vlinfantbil : "",
        sttabpreco:
          typeof payload?.sttabpreco === "string" ? payload.sttabpreco : "",
      }),
    mapError: asPainelTabelaPrecoError,
    logTag: "painel-tabela-preco-update-bff-failed",
  });
}
