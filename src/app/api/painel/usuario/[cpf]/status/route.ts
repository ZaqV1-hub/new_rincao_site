import {
  asPainelUsuariosError,
  togglePainelUsuarioStatus,
} from "@/lib/painel-usuarios";
import { runPainelUsuariosRoute } from "@/lib/painel-usuarios-route";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ cpf: string }> },
) {
  return runPainelUsuariosRoute(request, context, {
    run: ({ params, actor, sessionCpf }) =>
      togglePainelUsuarioStatus({
        actor,
        cpf: params.cpf,
        currentActorCpf: sessionCpf,
      }),
    mapError: asPainelUsuariosError,
    logTag: "painel-usuario-status-toggle-bff-failed",
  });
}
