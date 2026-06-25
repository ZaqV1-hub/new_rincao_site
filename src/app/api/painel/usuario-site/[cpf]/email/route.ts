import { readJsonPayload } from "@/lib/ops-route-utils";
import {
  asPainelUsuarioSiteError,
  updatePainelUsuarioSiteEmail,
} from "@/lib/painel-usuario-site";
import { runPainelUsuarioSiteRoute } from "@/lib/painel-usuario-site-route";

export const runtime = "nodejs";

type EmailPayload = {
  email?: unknown;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ cpf: string }> },
) {
  return runPainelUsuarioSiteRoute(request, context, {
    readPayload: (incomingRequest) => readJsonPayload<EmailPayload>(incomingRequest),
    run: ({ params, payload }) => updatePainelUsuarioSiteEmail(params.cpf, payload?.email),
    mapError: asPainelUsuarioSiteError,
    logTag: "painel-usuario-site-email-bff-failed",
  });
}
