import {
  asPainelCategoriaSocioError,
  removePainelCategoriaSocio,
} from "@/lib/painel-categoria-socio";
import { runPainelCategoriaSocioRoute } from "@/lib/painel-categoria-socio-route";

export const runtime = "nodejs";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return runPainelCategoriaSocioRoute(request, context, {
    run: ({ params, actor }) =>
      removePainelCategoriaSocio({
        actor,
        id: params.id,
      }),
    mapError: asPainelCategoriaSocioError,
    logTag: "painel-categoria-socio-remove-bff-failed",
  });
}
