import { readJsonPayload } from "@/lib/ops-route-utils";
import {
  asPainelUsuarioSiteError,
  updatePainelUsuarioSiteStatus,
} from "@/lib/painel-usuario-site";
import { runPainelUsuarioSiteRoute } from "@/lib/painel-usuario-site-route";

export const runtime = "nodejs";

type StatusPayload = {
  status?: unknown;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ cpf: string }> },
) {
  return runPainelUsuarioSiteRoute(request, context, {
    readPayload: (incomingRequest) => readJsonPayload<StatusPayload>(incomingRequest),
    run: ({ params, payload, actor }) =>
      updatePainelUsuarioSiteStatus({
        cpf: params.cpf,
        status: payload?.status,
        actorCpf: actor.cpf,
      }),
    mapError: asPainelUsuarioSiteError,
    logTag: "painel-usuario-site-status-bff-failed",
  });
}
