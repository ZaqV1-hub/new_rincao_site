import { asPainelSociosError, removePainelSocio } from "@/lib/painel-socios";
import { runPainelSociosRoute } from "@/lib/painel-socios-route";

export const runtime = "nodejs";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ cpf: string }> },
) {
  return runPainelSociosRoute(request, context, {
    run: ({ params }) => removePainelSocio(params.cpf),
    mapError: asPainelSociosError,
    logTag: "painel-socio-remove-bff-failed",
  });
}
