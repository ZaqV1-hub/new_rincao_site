import {
  asPainelInformacoesError,
  removePainelInformacao,
} from "@/lib/painel-informacoes";
import { runPainelInformacoesRoute } from "@/lib/painel-informacoes-route";

export const runtime = "nodejs";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return runPainelInformacoesRoute(request, context, {
    run: ({ params, actor }) =>
      removePainelInformacao({
        actor,
        id: params.id,
      }),
    mapError: asPainelInformacoesError,
    logTag: "painel-informacao-remove-bff-failed",
  });
}
