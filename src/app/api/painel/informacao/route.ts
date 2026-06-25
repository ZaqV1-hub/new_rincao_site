import {
  asPainelInformacoesError,
  createPainelInformacao,
} from "@/lib/painel-informacoes";
import { readJsonPayload } from "@/lib/ops-route-utils";
import { runPainelInformacoesRoute } from "@/lib/painel-informacoes-route";

export const runtime = "nodejs";

type InformacaoPayload = {
  nome?: unknown;
  texto?: unknown;
};

export async function POST(request: Request) {
  return runPainelInformacoesRoute(request, { params: Promise.resolve({}) }, {
    readPayload: (incomingRequest) => readJsonPayload<InformacaoPayload>(incomingRequest),
    run: ({ payload }) =>
      createPainelInformacao({
        nome: typeof payload?.nome === "string" ? payload.nome : "",
        texto: typeof payload?.texto === "string" ? payload.texto : "",
      }),
    mapError: asPainelInformacoesError,
    logTag: "painel-informacao-create-bff-failed",
  });
}
