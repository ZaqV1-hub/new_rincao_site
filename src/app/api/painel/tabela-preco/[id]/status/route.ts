import {
  asPainelTabelaPrecoError,
  togglePainelTabelaPrecoStatus,
} from "@/lib/painel-tabela-preco";
import { runPainelTabelaPrecoRoute } from "@/lib/painel-tabela-preco-route";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return runPainelTabelaPrecoRoute(request, context, {
    run: ({ params, actor }) =>
      togglePainelTabelaPrecoStatus({
        actor,
        id: params.id,
      }),
    mapError: asPainelTabelaPrecoError,
    logTag: "painel-tabela-preco-status-toggle-bff-failed",
  });
}
