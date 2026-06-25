import { readJsonPayload } from "@/lib/ops-route-utils";
import {
  asPainelParametrosError,
  savePainelParametros,
} from "@/lib/painel-parametros";
import { runPainelParametrosRoute } from "@/lib/painel-parametros-route";

export const runtime = "nodejs";

type ParametrosPayload = {
  parameters?: unknown;
};

export async function PATCH(request: Request) {
  return runPainelParametrosRoute(request, {
    readPayload: (incomingRequest) => readJsonPayload<ParametrosPayload>(incomingRequest),
    run: ({ payload, actor }) =>
      savePainelParametros({
        actor: {
          name: actor.name,
          cpf: actor.cpf,
        },
        parameters: Array.isArray(payload?.parameters)
          ? (payload.parameters as Array<{
              group?: string;
              id?: string;
              value?: string;
            }>)
          : [],
      }),
    mapError: asPainelParametrosError,
    logTag: "painel-parametros-save-bff-failed",
  });
}
