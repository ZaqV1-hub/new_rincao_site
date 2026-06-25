import {
  asPainelTabelaPrecoError,
  removePainelTabelaPreco,
} from "@/lib/painel-tabela-preco";
import { runPainelTabelaPrecoRoute } from "@/lib/painel-tabela-preco-route";

export const runtime = "nodejs";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return runPainelTabelaPrecoRoute(request, context, {
    run: ({ params, actor }) =>
      removePainelTabelaPreco({
        actor,
        id: params.id,
      }),
    mapError: asPainelTabelaPrecoError,
    logTag: "painel-tabela-preco-remove-bff-failed",
  });
}
