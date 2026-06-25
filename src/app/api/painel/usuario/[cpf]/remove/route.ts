import { asPainelUsuariosError, removePainelUsuario } from "@/lib/painel-usuarios";
import { runPainelUsuariosRoute } from "@/lib/painel-usuarios-route";

export const runtime = "nodejs";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ cpf: string }> },
) {
  return runPainelUsuariosRoute(request, context, {
    run: ({ params, actor }) =>
      removePainelUsuario({
        actor,
        cpf: params.cpf,
      }),
    mapError: asPainelUsuariosError,
    logTag: "painel-usuario-remove-bff-failed",
  });
}
