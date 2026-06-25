import { asPainelUsuariosError, updatePainelUsuario } from "@/lib/painel-usuarios";
import { readJsonPayload } from "@/lib/ops-route-utils";
import { runPainelUsuariosRoute } from "@/lib/painel-usuarios-route";

export const runtime = "nodejs";

type UsuarioPayload = {
  nmusuario?: unknown;
  email?: unknown;
  idpapel?: unknown;
  stusuario?: unknown;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ cpf: string }> },
) {
  return runPainelUsuariosRoute(request, context, {
    readPayload: (incomingRequest) => readJsonPayload<UsuarioPayload>(incomingRequest),
    run: ({ params, payload }) =>
      updatePainelUsuario(params.cpf, {
        cpf: params.cpf,
        senha: "",
        csenha: "",
        nmusuario: typeof payload?.nmusuario === "string" ? payload.nmusuario : "",
        email: typeof payload?.email === "string" ? payload.email : "",
        idpapel:
          typeof payload?.idpapel === "string" || typeof payload?.idpapel === "number"
            ? String(payload.idpapel)
            : "",
        stusuario: typeof payload?.stusuario === "string" ? payload.stusuario : "",
      }),
    mapError: asPainelUsuariosError,
    logTag: "painel-usuario-update-bff-failed",
  });
}
