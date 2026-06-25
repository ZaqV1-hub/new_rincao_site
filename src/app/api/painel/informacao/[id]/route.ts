import {
  asPainelInformacoesError,
  updatePainelInformacao,
} from "@/lib/painel-informacoes";
import { readJsonPayload } from "@/lib/ops-route-utils";
import { runPainelInformacoesRoute } from "@/lib/painel-informacoes-route";

export const runtime = "nodejs";

type InformacaoPayload = {
  nome?: unknown;
  texto?: unknown;
  status?: unknown;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return runPainelInformacoesRoute(request, context, {
    readPayload: (incomingRequest) => readJsonPayload<InformacaoPayload>(incomingRequest),
    run: ({ params, payload }) =>
      updatePainelInformacao(params.id, {
        nome: typeof payload?.nome === "string" ? payload.nome : "",
        texto: typeof payload?.texto === "string" ? payload.texto : "",
        status: typeof payload?.status === "string" ? payload.status : "",
      }),
    mapError: asPainelInformacoesError,
    logTag: "painel-informacao-update-bff-failed",
  });
}
