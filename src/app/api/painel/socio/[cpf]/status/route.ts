import { asPainelSociosError, updatePainelSocioStatus } from "@/lib/painel-socios";
import { readJsonPayload } from "@/lib/ops-route-utils";
import { runPainelSociosRoute } from "@/lib/painel-socios-route";

export const runtime = "nodejs";

type StatusPayload = {
  status?: unknown;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ cpf: string }> },
) {
  return runPainelSociosRoute(request, context, {
    readPayload: (incomingRequest) => readJsonPayload<StatusPayload>(incomingRequest),
    run: ({ params, payload }) => updatePainelSocioStatus(params.cpf, payload?.status),
    mapError: asPainelSociosError,
    logTag: "painel-socio-status-bff-failed",
  });
}
