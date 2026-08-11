import { readJsonPayload } from "@/lib/ops-route-utils";
import {
  asPainelUsuarioSiteError,
  updatePainelUsuarioSitePassword,
} from "@/lib/painel-usuario-site";
import { runPainelUsuarioSiteRoute } from "@/lib/painel-usuario-site-route";

export const runtime = "nodejs";

type PasswordPayload = {
  senha?: unknown;
  csenha?: unknown;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ cpf: string }> },
) {
  return runPainelUsuarioSiteRoute(request, context, {
    readPayload: (incomingRequest) => readJsonPayload<PasswordPayload>(incomingRequest),
    run: ({ params, payload }) =>
      updatePainelUsuarioSitePassword(params.cpf, {
        senha: payload?.senha,
        csenha: payload?.csenha,
      }),
    mapError: asPainelUsuarioSiteError,
    logTag: "painel-usuario-site-password-bff-failed",
  });
}
