import {
  asPainelUsuariosError,
  updatePainelMinhaContaSenha,
} from "@/lib/painel-usuarios";
import { readJsonPayload } from "@/lib/ops-route-utils";
import { runPainelUsuariosRoute } from "@/lib/painel-usuarios-route";

export const runtime = "nodejs";

type MinhaContaPayload = {
  senha?: unknown;
  csenha?: unknown;
};

export async function PATCH(request: Request) {
  return runPainelUsuariosRoute(request, { params: Promise.resolve({}) }, {
    readPayload: (incomingRequest) => readJsonPayload<MinhaContaPayload>(incomingRequest),
    run: ({ payload, sessionCpf }) =>
      updatePainelMinhaContaSenha({
        cpf: sessionCpf,
        values: {
          senha: typeof payload?.senha === "string" ? payload.senha : "",
          csenha: typeof payload?.csenha === "string" ? payload.csenha : "",
        },
      }),
    mapError: asPainelUsuariosError,
    logTag: "painel-usuario-account-password-bff-failed",
  });
}
