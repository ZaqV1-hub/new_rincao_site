import {
  asPainelInformacoesError,
  togglePainelInformacaoStatus,
} from "@/lib/painel-informacoes";
import { runPainelInformacoesRoute } from "@/lib/painel-informacoes-route";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return runPainelInformacoesRoute(request, context, {
    run: ({ params, actor }) =>
      togglePainelInformacaoStatus({
        actor,
        id: params.id,
      }),
    mapError: asPainelInformacoesError,
    logTag: "painel-informacao-status-toggle-bff-failed",
  });
}
