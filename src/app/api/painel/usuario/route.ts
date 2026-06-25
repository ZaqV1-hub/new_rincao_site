import { asPainelUsuariosError, createPainelUsuario } from "@/lib/painel-usuarios";
import { readJsonPayload } from "@/lib/ops-route-utils";
import { runPainelUsuariosRoute } from "@/lib/painel-usuarios-route";

export const runtime = "nodejs";

type UsuarioPayload = {
  cpf?: unknown;
  senha?: unknown;
  csenha?: unknown;
  nmusuario?: unknown;
  email?: unknown;
  idpapel?: unknown;
};

export async function POST(request: Request) {
  return runPainelUsuariosRoute(request, { params: Promise.resolve({}) }, {
    readPayload: (incomingRequest) => readJsonPayload<UsuarioPayload>(incomingRequest),
    run: ({ payload }) =>
      createPainelUsuario({
        cpf: typeof payload?.cpf === "string" ? payload.cpf : "",
        senha: typeof payload?.senha === "string" ? payload.senha : "",
        csenha: typeof payload?.csenha === "string" ? payload.csenha : "",
        nmusuario: typeof payload?.nmusuario === "string" ? payload.nmusuario : "",
        email: typeof payload?.email === "string" ? payload.email : "",
        idpapel:
          typeof payload?.idpapel === "string" || typeof payload?.idpapel === "number"
            ? String(payload.idpapel)
            : "",
      }),
    mapError: asPainelUsuariosError,
    logTag: "painel-usuario-create-bff-failed",
  });
}
